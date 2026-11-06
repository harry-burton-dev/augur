import { Readable } from 'node:stream';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import {
  callerFromHeaders,
  FloorsUnavailable,
  GrantsUnavailable,
  health,
  identifyService,
  packageVersion,
  PeopleUnavailable,
  ServiceAuthUnavailable,
  problemDetails,
  serviceFastifyOptions,
  serviceName,
  WORKSPACE_HEADERS,
  type Caller,
  type FloorLookup,
  type GrantLookup,
  type MemberLookup,
  type AudienceLookup,
  type DirectorySearch,
  type PrincipalLookup,
  type NewAuditEntry,
  type Scope,
  type ServiceIdentity,
  type ServiceVerifier,
  signedCallers,
  type CallerCheck,
} from '@augur/service-kit';
import { describeApi } from './contract.ts';
import { inboxRoutes, releaseLeaver, teamsOf, type InboxKindLookup } from './inbox-routes.ts';
import { AuditEntry, DomainEvent as DomainEventSchema, NewAuditEntry as NewAuditEntrySchema, NewDomainEvent as NewDomainEventSchema, NewNotification as NewNotificationSchema, Notification as NotificationSchema, empty, refused, ref, TeamNotices, TOPIC } from './schemas.ts';
import { topicMatches, type AuditEntry as AuditRecord, type AuditFilter, type DomainEvent, type EventFloor, type EventStore, type NewDomainEvent, type Notification } from './store.ts';

/** Filters the audit log and its download share, beyond time and floor. */
const AUDIT_FILTERS = {
  target: Type.Optional(Type.String({ maxLength: 200, description: 'Only entries about this target' })),
  person: Type.Optional(Type.String({ maxLength: 100, description: 'Only entries by, about or naming this person (the actor, the target or detail.person)' })),
  kind: Type.Optional(Type.Enum(['change', 'sign-in'], { description: 'Only sign-ins (detail.kind is sign-in), or only every other change' })),
};

/** The most days one Activity download covers. */
export const EXPORT_MAX_DAYS = 366;
const DAY_MS = 86_400_000;

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  // Quote every cell, and defuse a leading formula character so a spreadsheet shows it as text.
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`;
};

/** Activity between two times, newest first as the log reads, a page at a time so a long range is never held whole. */
async function* exportLines(store: EventStore, filter: Omit<AuditFilter, 'limit' | 'before'>, format: 'csv' | 'jsonl') {
  if (format === 'csv') yield 'at,actor,actorKind,app,action,target,floor,detail\n';
  let before: string | undefined;
  for (;;) {
    const page: AuditRecord[] = await store.audit({ ...filter, before, limit: 500 });
    for (const e of page)
      yield format === 'csv' ? `${[e.at, e.actor.id, e.actor.kind, e.app, e.action, e.target, e.workspace?.id, e.detail].map(csvCell).join(',')}\n` : `${JSON.stringify(e)}\n`;
    if (page.length < 500) return;
    before = page[page.length - 1]!.id;
  }
}

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface EventsOptions {
  /** Where notifications, Activity, domain events and the inbox are kept: Postgres. */
  store: EventStore;
  /** Checks apps' and platform services' own sign-in tokens: only services send notifications and write the audit log. */
  verifyService?: ServiceVerifier;
  /** What an app is granted on a floor; an app's calls are checked against it. */
  grants?: GrantLookup;
  /** Where a floor sits, from identity: notifications and audit entries record their floor's path. */
  floors?: FloorLookup;
  /** Who is on a team now, from identity, for team notices. */
  members?: MemberLookup;
  /** Who an audience reaches now, from identity, for platform services' notifications (ADR 0044). */
  audience?: AudienceLookup;
  /** Who can sign in, from identity's directory: an inbox item's owner must be someone who can. */
  directory?: DirectorySearch;
  /** Which teams a person is on, from identity: their teams' inbox items, and who hears of a change. */
  principals?: PrincipalLookup;
  /** The inbox kinds each app's manifest declares, from the registry; without it kinds aren't checked. */
  inboxKinds?: InboxKindLookup;
  /** The notification kinds each app's manifest declares, from the registry; without it kinds aren't checked. */
  notificationKinds?: InboxKindLookup;
  /** How often an open stream sends a keep-alive, so proxies don't close it. */
  heartbeatMs?: number;
  /** How long a browser's stream of domain events lasts (STREAM_LIFETIME_MS). */
  streamLifetimeMs?: number;
  /** Checks the caller the gateway signed (callerCheckFromEnv). Without it `x-user-*` headers are believed as they come, as in local dev. */
  callers?: CallerCheck;
}

/** An action's payload is the app's own; it only has to stay small, since each notification travels whole to every open stream. */
const ACTION_PAYLOAD_BYTES = 1024;

/** Each event carries ids and a little context; anything bigger is fetched from the publisher's API. */
const EVENT_PAYLOAD_BYTES = 16 * 1024;

/** What a person.updated entry says changed, in the words followers use: never the values, which a follower fetches. */
const PERSON_FIELDS: Record<string, string> = { firstName: 'name', lastName: 'name', email: 'email', roles: 'roles', departments: 'teams' };
const changedOf = (detail: Record<string, unknown> | undefined) => [...new Set(Object.keys(detail ?? {}).flatMap((k) => (PERSON_FIELDS[k] ? [PERSON_FIELDS[k]] : [])))];

/**
 * AUGUR's own domain events, published as identity and the registry record
 * the change in the audit log, so the two can't disagree. Keyed by "<service> <action>".
 */
const PLATFORM_EVENTS: Record<string, { topic: string; payload: (e: NewAuditEntry) => Record<string, unknown> }> = {
  'identity person.added': { topic: 'platform.person.joined', payload: (e) => ({ person: e.target }) },
  'identity person.updated': { topic: 'platform.person.changed', payload: (e) => ({ person: e.target, changed: changedOf(e.detail) }) },
  'identity person.disabled': { topic: 'platform.person.disabled', payload: (e) => ({ person: e.target }) },
  'identity person.enabled': { topic: 'platform.person.enabled', payload: (e) => ({ person: e.target }) },
  // A leaver (ADR 0040): apps hand on or archive what they own, to handOverTo when an admin named someone.
  'identity person.left': {
    topic: 'platform.person.left',
    payload: (e) => ({ person: e.target, ...(typeof e.detail?.handOverTo === 'string' ? { handOverTo: e.detail.handOverTo } : {}) }),
  },
  // A deleted account (ADR 0072): the last event about them. Followers forget what they keep about the person.
  'identity person.deleted': { topic: 'platform.person.deleted', payload: (e) => ({ person: e.target }) },
  'identity department.created': { topic: 'platform.team.created', payload: (e) => ({ team: e.target, name: e.detail?.name }) },
  'identity department.renamed': { topic: 'platform.team.renamed', payload: (e) => ({ team: e.target, name: e.detail?.to }) },
  'identity department.member-added': { topic: 'platform.team.member-added', payload: (e) => ({ team: e.target, person: e.detail?.person }) },
  'identity department.member-removed': { topic: 'platform.team.member-removed', payload: (e) => ({ team: e.target, person: e.detail?.person }) },
  'registry app.disabled': { topic: 'platform.app.turned-off', payload: (e) => ({ app: e.target }) },
  'registry app.enabled': { topic: 'platform.app.turned-on', payload: (e) => ({ app: e.target }) },
  'registry app.removed': { topic: 'platform.app.removed', payload: (e) => ({ app: e.target }) },
  'registry app.blocked': { topic: 'platform.app.blocked', payload: (e) => ({ app: e.target }) },
  'registry app.inherited': { topic: 'platform.app.rule-cleared', payload: (e) => ({ app: e.target }) },
};

/** The floor a service call names in X-Workspace-Id, URI-decoded; a value that won't decode is kept as sent, and fails as an unknown floor. */
const workspaceOf = (req: FastifyRequest) => {
  const raw = req.headers[WORKSPACE_HEADERS.id];
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** Most topics, or families of them, one browser stream may follow. */
const STREAM_TOPICS = 100;

/**
 * How long one browser stream of domain events lasts, give or take a tenth so browsers don't all come back
 * together. The gateway checks the token and the floor only as a stream opens, so ending it sends the
 * browser back through those checks: someone taken off a team stops hearing its floor within this.
 */
export const STREAM_LIFETIME_MS = 5 * 60_000;

/** Whether each of a comma-separated list is a topic or a family such as "folio.*"; the first that isn't, or the list. */
const topicList = (raw: string): { topics: string[] } | { bad: string } => {
  const topics = [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))];
  const bad = topics.find((t) => !new RegExp(TOPIC).test(t.endsWith('.*') ? `${t.slice(0, -2)}.x` : t));
  return bad === undefined ? { topics } : { bad };
};

/** What a browser hears of a domain event: who published what, where, with the publisher's ids. */
const forBrowser = ({ seq, topic, id, publisher, at, workspace, payload }: DomainEvent) => ({ seq, topic, id, publisher, at, ...(workspace ? { workspace } : {}), payload });

/** What the Shell receives: a person never sees whom else a notification went to. */
const forCaller = ({ recipient: _, key: __, ...n }: Notification) => n;

/**
 * Notifications for the Shell's stream, and AUGUR's audit log. Services
 * send notifications and audit entries; people read their own notifications,
 * live, and admins read the audit log.
 */
export const buildApp = async ({ store, verifyService, grants, floors, members, audience, directory, principals, inboxKinds, notificationKinds, heartbeatMs = 25_000, streamLifetimeMs = STREAM_LIFETIME_MS, callers }: EventsOptions) => {
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/${API_VERSION}`);
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', { schema: { hide: true } }, async () => health('events', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
      const signedIn = (req: FastifyRequest, reply: FastifyReply): Caller | undefined => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) void reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        return caller;
      };
      /** Whether an app holds the scope on a floor. When it doesn't, or that can't be asked, the reply has been sent. */
      const granted = async (req: FastifyRequest, reply: FastifyReply, forApp: string, scope: Scope, workspace: string | undefined, refusal: 400 | 403 = 403): Promise<boolean> => {
        try {
          if (!grants) throw new GrantsUnavailable('The events service has no registry to check grants with.');
          if ((await grants(forApp, workspace)).includes(scope)) return true;
          void reply.code(refusal).send({ error: refusal === 400 ? 'bad_request' : 'forbidden', message: `${forApp} isn’t granted ${scope}${workspace ? ' on that floor' : ''}.` });
        } catch (err) {
          if (!(err instanceof GrantsUnavailable)) throw err;
          req.log.error({ err: err.message, app: forApp }, 'grant check failed');
          void reply.code(503).send({ error: 'unavailable', message: 'What this app may do can’t be checked right now. Try again in a moment.' });
        }
        return false;
      };

      /**
       * The service sending this, when it may: a platform service always; an
       * app only for itself, and only with the scope on the floor it names.
       */
      const fromService = async (req: FastifyRequest, reply: FastifyReply, forApp: string | undefined, scope: Scope): Promise<ServiceIdentity | undefined> => {
        let service: ServiceIdentity | undefined;
        try {
          service = await identifyService(req.headers, verifyService);
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: err.message });
          return undefined;
        }
        if (!service) {
          void reply.code(403).send({ error: 'forbidden', message: 'Only platform and app services can do this.' });
          return undefined;
        }
        if (service.kind === 'platform') return service;
        if (forApp !== undefined && service.app !== forApp) {
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} can only send for itself, not for "${forApp}".` });
          return undefined;
        }
        return (await granted(req, reply, service.app, scope, workspaceOf(req))) ? service : undefined;
      };

      /**
       * The floor a service call names, with its path as it stands now; null
       * for none. Undefined when the reply has been sent: an unknown floor, or
       * identity out of reach.
       */
      const floorOf = async (req: FastifyRequest, reply: FastifyReply): Promise<(EventFloor & { kind: string }) | null | undefined> => {
        const id = workspaceOf(req);
        if (!id) return null;
        try {
          if (!floors) throw new FloorsUnavailable('The events service has no way to reach identity.');
          const place = await floors(id);
          if (place) return { id: place.id, path: place.path, kind: place.kind };
          void reply.code(400).send({ error: 'bad_request', message: 'There is no such floor.' });
        } catch (err) {
          if (!(err instanceof FloorsUnavailable)) throw err;
          req.log.error({ err: err.message }, 'floor lookup failed');
          void reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now. Try again in a moment.' });
        }
        return undefined;
      };

      // ---- the Inbox: work that waits on someone (ADR 0026) ----

      inboxRoutes(app, { inbox: store.inbox, store, floors, directory, principals, kinds: inboxKinds, signedIn, fromService, floorOf });

      // ---- notifications ----

      app.post(
        '/notifications',
        {
          schema: {
            summary: 'Notify people (services only)',
            description: [
              "With toTeam and no recipients, to everyone on the team the call's floor",
              'names (its members and those of the teams below), asked of identity as',
              "it's sent. Only a team that has turned team notices on (403 otherwise).",
              'With audience (platform services only, ADR 0044), to everyone the',
              'principals reach now, asked of identity, such as role:deployment-admin.',
              'With key, nobody who already has a notification from that app with that',
              'key is told again, read or not.',
            ].join(' '),
            body: ref(NewNotificationSchema),
            response: {
              202: Type.Object({ sent: Type.Integer() }, { description: 'Sent, one notification per recipient' }),
              400: refused('Invalid notification, an unknown floor, or toTeam not on a team'),
              403: refused('Not a signed-in service, not granted this, team notices are off, or urgent or an audience from an app'),
              503: refused("Floors, grants or an audience can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
        const service = await fromService(req, reply, req.body.app, 'notifications:send');
        if (!service) return reply;
        const floor = await floorOf(req, reply);
        if (floor === undefined) return reply;
        const { toTeam, audience: principals, ...notification } = req.body;
        const big = notification.actions?.find((a) => a.intent.payload !== undefined && Buffer.byteLength(JSON.stringify(a.intent.payload)) > ACTION_PAYLOAD_BYTES);
        if (big) return reply.code(400).send({ error: 'bad_request', message: `The payload of “${big.label}” is over ${ACTION_PAYLOAD_BYTES} bytes. Send an id and let the app look the rest up.` });
        if (!toTeam && !principals && !notification.recipients.length) return reply.code(400).send({ error: 'bad_request', message: 'Name the recipients, or send to the team.' });
        if (notification.kind) {
          let declared: string[] | undefined;
          try {
            declared = notificationKinds ? await notificationKinds(notification.app) : undefined;
          } catch (err) {
            if (!(err instanceof GrantsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'The kinds of notification the app declares can’t be checked right now.' });
          }
          if (declared && !declared.includes(notification.kind)) {
            return reply.code(400).send({ error: 'bad_request', message: `${notification.app} doesn’t declare the notification kind "${notification.kind}" in its manifest (notifications.kinds).` });
          }
        }
        // Urgent is AUGUR's own (ADR 0044 D3): an app can't make its news stop everyone's work.
        if (notification.urgent && service.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services send urgent notifications.' });
        if (principals) {
          // Reaching people by role or across the org is AUGUR's own: an app names the people it means.
          if (service.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services send to an audience. Name the recipients.' });
          if (toTeam || notification.recipients.length) return reply.code(400).send({ error: 'bad_request', message: 'Send to an audience, the team or recipients: one of them.' });
          try {
            // Like a team, an audience is asked as it's sent: someone who has since lost the role isn't told.
            if (!audience) throw new FloorsUnavailable('The events service has no way to reach identity.');
            notification.recipients = await audience(principals);
          } catch (err) {
            if (!(err instanceof FloorsUnavailable) && !(err instanceof PeopleUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Who that audience reaches can’t be checked right now.' });
          }
        }
        if (toTeam) {
          if (notification.recipients.length) return reply.code(400).send({ error: 'bad_request', message: 'Send to the team or to recipients, not both.' });
          if (floor?.kind !== 'team') return reply.code(400).send({ error: 'bad_request', message: 'Team notices go to the team the call’s floor names.' });
          if (!(await store.teamNotices(floor.id))) return reply.code(403).send({ error: 'forbidden', message: 'That team hasn’t turned team notices on.' });
          try {
            // Who is on the team is asked as it's sent, never remembered: someone who has left isn't told.
            if (!members) throw new FloorsUnavailable('The events service has no way to reach identity.');
            notification.recipients = await members(floor.id);
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Who is on the team can’t be checked right now.' });
          }
        }
        const added = notification.recipients.length ? await store.addNotifications(notification, floor ? { id: floor.id, path: floor.path } : undefined) : [];
        req.log.info({ service: serviceName(service), app: req.body.app, count: added.length, workspace: floor?.id, team: !!toTeam, audience: principals, key: notification.key }, 'notifications sent');
        return reply.code(202).send({ sent: added.length });
        },
      );

      /** Who may change a team's settings: an admin, or a lead standing on that team (as the gateway checked). */
      const leadsOrAdmin = (caller: Caller, workspace: string) => caller.roles.includes('admin') || (caller.workspace?.id === workspace && caller.workspace.role === 'lead');

      // Team notices are off until a team's lead (or an admin) turns them on.
      const TeamParams = Type.Object({ workspace: Type.String() });
      app.get(
        '/team-notices/:workspace',
        {
          schema: {
            summary: 'Whether a team has turned team notices on (its leads and admins)',
            description: 'A lead must be standing on the team (x-workspace-id, checked by the gateway).',
            params: TeamParams,
            response: {
              200: { ...ref(TeamNotices), description: 'The setting' },
              403: refused('Not a lead standing on that team, nor an admin'),
            },
          },
        },
        async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        if (!leadsOrAdmin(caller, req.params.workspace)) return reply.code(403).send({ error: 'forbidden', message: 'Only the team’s leads or an admin can see this.' });
        return { workspace: req.params.workspace, on: await store.teamNotices(req.params.workspace) };
        },
      );

      app.put(
        '/team-notices/:workspace',
        {
          schema: {
            summary: 'Turn team notices on or off for a team (its leads and admins)',
            description: 'Audited as team-notices.on or team-notices.off, on that floor.',
            params: TeamParams,
            body: Type.Object({ on: Type.Boolean() }, { additionalProperties: false }),
            response: {
              200: { ...ref(TeamNotices), description: 'The setting now' },
              403: refused('Not a lead standing on that team, nor an admin'),
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          if (!leadsOrAdmin(caller, req.params.workspace)) return reply.code(403).send({ error: 'forbidden', message: 'Only the team’s leads or an admin can turn team notices on or off.' });
          const before = await store.teamNotices(req.params.workspace);
          await store.setTeamNotices(req.params.workspace, req.body.on, caller.id);
          if (before !== req.body.on) {
            const floor = floors ? await floors(req.params.workspace).catch(() => undefined) : undefined;
            await store.appendAudit(
              { actor: { id: caller.id, kind: 'user' }, app: 'events', action: req.body.on ? 'team-notices.on' : 'team-notices.off', target: req.params.workspace },
              floor ? { id: floor.id, path: floor.path } : { id: req.params.workspace, path: [req.params.workspace] },
              'events',
            );
          }
          return { workspace: req.params.workspace, on: req.body.on };
        },
      );

      app.get(
        '/notifications',
        {
          schema: {
            summary: "The caller's unread notifications, newest first (up to 50)",
            response: {
              200: Type.Array(ref(NotificationSchema), { description: 'Unread notifications' }),
              401: refused('No signed-in caller'),
            },
          },
        },
        async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        return (await store.unread(caller.id, 50)).map(forCaller);
        },
      );

      app.get(
        '/notifications/:id',
        {
          schema: {
            summary: "One of the caller's notifications, read or not",
            description: 'What a notice email links to: the shell opens it as if it were clicked there.',
            params: Type.Object({ id: Type.String() }),
            response: {
              200: ref(NotificationSchema),
              401: refused('No signed-in caller'),
              404: refused('The caller has no such notification'),
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          const n = await store.notification(caller.id, req.params.id);
          if (!n) return reply.code(404).send({ error: 'not_found', message: 'You have no such notification.' });
          return forCaller(n);
        },
      );

      const setRead = (read: boolean) => async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        if (!(await store.setRead(caller.id, req.params.id, read))) return reply.code(404).send({ error: 'not_found', message: 'You have no such notification.' });
        return reply.code(204).send();
      };
      const readSchema = (summary: string, done: string) => ({
        summary,
        params: Type.Object({ id: Type.String() }),
        response: { 204: empty(done), 404: refused('The caller has no such notification') },
      });
      app.post('/notifications/:id/read', { schema: readSchema("Mark one of the caller's notifications read", 'Marked read') }, setRead(true));
      app.delete('/notifications/:id/read', { schema: readSchema('Mark it unread again (Undo)', 'Marked unread') }, setRead(false));

      // Server-sent events: each new notification for the caller, as it happens.
      app.get(
        '/notifications/stream',
        {
          schema: {
            summary: 'Each new notification for the caller, as server-sent events',
            description: [
              'Events are named "notification" and carry a Notification as JSON. Events named',
              '"inbox" carry { id, change } (added, changed or closed) when an inbox item the caller',
              'can see changes: reload the counts, and the list if it is showing.',
              'Comment lines are sent as keep-alives. Read with fetch so the sign-in',
              'token can be sent; reload the list after reconnecting.',
            ].join(' '),
            response: { 200: { description: 'An open event stream', content: { 'text/event-stream': { schema: {} } } } },
          },
        },
        async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        res.write(': connected\n\n');
        const unsubscribe = store.subscribe((n) => {
          if (n.recipient === caller.id) res.write(`event: notification\ndata: ${JSON.stringify(forCaller(n))}\n\n`);
        });
        // Who the caller is to the Inbox: themselves and their teams, asked as each change comes (identity's answer is cached).
        const me = `person:${caller.id}`;
        const stopInbox = store.inbox.onChange((s) => {
          if (s.principals.includes(me)) return void res.write(`event: inbox\ndata: ${JSON.stringify({ id: s.id, change: s.change })}\n\n`);
          if (!s.principals.some((p) => p.startsWith('team:'))) return;
          void teamsOf(caller, principals).then(
            (teams) => s.principals.some((p) => teams.includes(p.slice(5)) && p.startsWith('team:')) && res.write(`event: inbox\ndata: ${JSON.stringify({ id: s.id, change: s.change })}\n\n`),
            () => undefined,
          );
        });
        const heartbeat = setInterval(() => res.write(': still here\n\n'), heartbeatMs);
        req.raw.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
          stopInbox();
        });
        },
      );

      // ---- domain events: what services tell each other ----

      // A service publishes on its own topics only: an app on "<its id>.*", platform services on "platform.*".
      app.post(
        '/domain-events',
        {
          schema: {
            summary: 'Publish domain events (services only)',
            description: [
              'An app publishes on its own topics ("<app id>.<what happened>") with the',
              'events:publish scope; platform services on "platform.*". Every event in',
              "one call is on the same publisher's topics. An event whose id the",
              'publisher already sent is kept once. Payloads are at most 16 KB: ids and a',
              'little context, never content a follower might not be allowed to see.',
              'The events service itself publishes platform.person.*, platform.team.*',
              'and platform.app.* as identity and the registry record those changes.',
            ].join(' '),
            body: Type.Object({ events: Type.Array(ref(NewDomainEventSchema), { minItems: 1, maxItems: 100 }) }, { additionalProperties: false }),
            response: {
              202: Type.Object({ added: Type.Integer(), repeated: Type.Integer() }, { description: 'Kept' }),
              400: refused("A topic outside the publisher's, an unknown floor, a floor the app isn't on, or a payload over 16 KB"),
              403: refused("Not a service, not this publisher's topics, or no events:publish scope"),
              503: refused("Floors or grants can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
        const owner = req.body.events[0].topic.split('.')[0];
        const stray = req.body.events.find((e) => !e.topic.startsWith(`${owner}.`));
        if (stray) return reply.code(400).send({ error: 'bad_request', message: `Every event in one call is on the same publisher's topics; "${stray.topic}" isn't under "${owner}.".` });
        const big = req.body.events.find((e) => Buffer.byteLength(JSON.stringify(e.payload ?? null)) > EVENT_PAYLOAD_BYTES);
        if (big) return reply.code(400).send({ error: 'bad_request', message: `The payload of event ${big.id} is over ${EVENT_PAYLOAD_BYTES} bytes. Send ids and let followers ask for the rest.` });
        const service = await fromService(req, reply, owner === 'platform' ? undefined : owner, 'events:publish');
        if (!service) return reply;
        if ((service.kind === 'platform') !== (owner === 'platform')) {
          return reply.code(403).send({ error: 'forbidden', message: service.kind === 'platform' ? 'AUGUR’s own services publish on "platform." topics.' : '"platform." topics belong to AUGUR’s own services.' });
        }
        const places = new Map<string, EventFloor>();
        for (const id of new Set(req.body.events.flatMap((e) => (e.workspace ? [e.workspace] : [])))) {
          try {
            if (!floors) throw new FloorsUnavailable('The events service has no way to reach identity.');
            const place = await floors(id);
            if (!place) return reply.code(400).send({ error: 'bad_request', message: `There is no floor ${id}.` });
            places.set(id, { id: place.id, path: place.path });
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now. Try again in a moment.' });
          }
          // Each event goes on the floor it names, whatever floor the call itself names. A 400, not a 403: this is about the event,
          // so the outbox relay sets that one row aside rather than holding every event behind it.
          if (service.kind !== 'platform' && !(await granted(req, reply, service.app, 'events:publish', id, 400))) return reply;
        }
        const events: NewDomainEvent[] = req.body.events.map((e) => ({ topic: e.topic, id: e.id, payload: e.payload, floor: e.workspace ? places.get(e.workspace) : undefined }));
        const result = await store.publish(serviceName(service), events);
        req.log.info({ service: serviceName(service), ...result }, 'domain events published');
        return reply.code(202).send(result);
        },
      );

      // Followers read in seq order from where they left off, and keep their own place: at least once, in order.
      app.get(
        '/domain-events',
        {
          schema: {
            summary: 'Read domain events in order (services only, events:subscribe)',
            description: [
              'Events on the topics asked for, in the one order every follower reads',
              'in. Keep the last `seq` handled and pass it as `after`: delivery is at',
              'least once, never with a gap. Events are kept 30 days',
              '(DOMAIN_EVENTS_KEEP_DAYS).',
            ].join(' '),
            querystring: Type.Object({
              topics: Type.String({ minLength: 1, maxLength: 2000, description: 'Comma separated topics, or families such as folio.*' }),
              after: Type.Optional(Type.String({ pattern: '^[0-9]+$', maxLength: 19 })),
              limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
            }),
            response: {
              200: Type.Object({ events: Type.Array(ref(DomainEventSchema)), next: Type.String() }, { description: 'The next events, and the cursor after them' }),
              400: refused('A topic that is not a topic, nor a family such as folio.*'),
              403: refused('Not a service, or no events:subscribe scope'),
              503: refused("Grants can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
          const list = topicList(req.query.topics);
          if ('bad' in list) return reply.code(400).send({ error: 'bad_request', message: `"${list.bad}" is not a topic, or a family of topics such as "folio.*".` });
          const { topics } = list;
          if (!(await fromService(req, reply, undefined, 'events:subscribe'))) return reply;
          const limit = req.query.limit ?? 100;
          const events = await store.readEvents({ topics, after: req.query.after, limit });
          return { events, next: events.at(-1)?.seq ?? req.query.after ?? '0' };
        },
      );

      /**
       * Server-sent events for the shell: each domain event on the floor the person stands on (as the
       * gateway checked it), on the topics asked for, as it's published. A hint to refresh what's on
       * screen, so it carries what events carry (ids), and anything missed while away is simply
       * loaded fresh: there is no catching up. Events on no floor, or on another, never reach it.
       */
      app.get(
        '/domain-events/stream',
        {
          schema: {
            summary: 'Domain events on the caller\'s floor, as server-sent events (people, for the shell)',
            description: [
              'Each domain event on the topics asked for, published on the floor the caller',
              'stands on (x-workspace-id, checked by the gateway), as it is published.',
              'Events on no floor or on another floor never reach it. Events are named',
              '"domain-event" and carry a DomainEvent as JSON. It is a hint to refresh what',
              'is on screen, not a record: there is no catching up, so after a reconnect',
              'load fresh. Comment lines are keep-alives. Read with fetch so the sign-in',
              'token can be sent.',
            ].join(' '),
            querystring: Type.Object({
              topics: Type.String({ minLength: 1, maxLength: 4000, description: 'Comma separated topics, or families such as folio.*; at most 100' }),
            }),
            response: {
              200: { description: 'An open event stream', content: { 'text/event-stream': { schema: {} } } },
              400: refused('A topic that is not a topic, too many topics, or no floor named'),
              401: refused('No signed-in caller'),
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          const list = topicList(req.query.topics);
          if ('bad' in list) return reply.code(400).send({ error: 'bad_request', message: `"${list.bad}" is not a topic, or a family of topics such as "folio.*".` });
          if (list.topics.length > STREAM_TOPICS) return reply.code(400).send({ error: 'bad_request', message: `Follow at most ${STREAM_TOPICS} topics or families at once.` });
          const floor = caller.workspace?.id;
          if (!floor) return reply.code(400).send({ error: 'bad_request', message: 'Name the floor you’re on (X-Workspace-Id): the stream carries that floor’s events.' });
          const { topics } = list;
          reply.hijack();
          const res = reply.raw;
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
          res.write(': connected\n\n');
          const stop = store.onEvent((e) => {
            if (e.workspace?.id === floor && topicMatches(e.topic, topics)) res.write(`event: domain-event\ndata: ${JSON.stringify(forBrowser(e))}\n\n`);
          });
          const heartbeat = setInterval(() => res.write(': still here\n\n'), heartbeatMs);
          const finished = () => {
            clearInterval(heartbeat);
            clearTimeout(lifetime);
            stop();
          };
          const lifetime = setTimeout(() => {
            finished();
            res.end();
          }, streamLifetimeMs * (0.9 + Math.random() * 0.2));
          req.raw.on('close', finished);
        },
      );

      // ---- audit log ----

      app.post(
        '/audit',
        {
          schema: {
            summary: 'Record an audit entry (services only). Entries are never changed, except to remove a deleted person’s details, and go only after the retention period.',
            body: ref(NewAuditEntrySchema),
            response: {
              201: { ...ref(AuditEntry), description: 'Recorded' },
              400: refused('Invalid entry, or an unknown floor'),
              403: refused('Not a signed-in service, or not granted this'),
              503: refused("Floors or grants can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
        const service = await fromService(req, reply, req.body.app, 'audit:write');
        if (!service) return reply;
        const floor = await floorOf(req, reply);
        if (floor === undefined) return reply;
        const place = floor ? { id: floor.id, path: floor.path } : undefined;
        // `actor` is the service's own claim; the signed token says which service made it.
        const entry = await store.appendAudit(req.body, place, serviceName(service));
        const platformEvent = service.kind === 'platform' ? PLATFORM_EVENTS[`${req.body.app} ${req.body.action}`] : undefined;
        if (platformEvent) {
          await store.publish(req.body.app, [{ topic: platformEvent.topic, id: `audit-${entry.id}`, payload: platformEvent.payload(req.body), floor: place }]);
          // Someone who leaves a team, or can no longer sign in, gives back the team work they'd taken.
          const leaver = platformEvent.topic === 'platform.person.disabled' ? { person: req.body.target } : platformEvent.topic === 'platform.team.member-removed' ? { person: req.body.detail?.person, team: req.body.target } : undefined;
          if (typeof leaver?.person === 'string' && leaver.person)
            await releaseLeaver(store, leaver.person, typeof leaver.team === 'string' ? leaver.team : undefined).catch((err: unknown) => req.log.error({ err }, 'could not give back a leaver’s inbox items'));
        }
        return reply.code(201).send(entry);
        },
      );

      app.get(
        '/audit',
        {
          schema: {
            summary: 'The audit log, newest first (admins; leads for their own floor)',
            description: [
              'To page, ask again with `before` set to the id of the oldest entry',
              'already shown; a page shorter than `limit` is the last one. With',
              '`workspace`, only entries on that floor or a floor below it, as the',
              'tree stood when each was written. Admins read the whole log; a lead',
              'standing on a floor (x-workspace-id, checked by the gateway) reads that',
              "floor's with `workspace` set to it.",
            ].join(' '),
            querystring: Type.Object({
              app: Type.Optional(Type.String()),
              actor: Type.Optional(Type.String()),
              since: Type.Optional(Type.String({ format: 'date-time', description: 'Only entries at or after this time' })),
              until: Type.Optional(Type.String({ format: 'date-time', description: 'Only entries before this time' })),
              before: Type.Optional(Type.String({ pattern: '^[0-9]+$', maxLength: 19, description: "An entry's id; only entries older than it" })),
              workspace: Type.Optional(Type.String({ maxLength: 100, description: 'Only entries on this floor or below it' })),
              ...AUDIT_FILTERS,
              limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
            }),
            response: {
              200: Type.Array(ref(AuditEntry), { description: 'Audit entries' }),
              403: refused('Not an admin, nor a lead asking for their own floor'),
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          const { app: forApp, actor, since, until, before, workspace, target, person, kind, limit = 100 } = req.query;
          // Admins read the whole log; a lead reads their own floor's, and the floors below it.
          if (!caller.roles.includes('admin') && !(workspace && leadsOrAdmin(caller, workspace))) {
            return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can read the whole audit log; a lead can read their own floor’s.' });
          }
          return store.audit({ app: forApp, actor, since, until, before, workspace, target, person, kind, limit });
        },
      );

      app.get(
        '/audit/export',
        {
          schema: {
            summary: 'Download Activity as CSV or JSON lines (admins)',
            description: [
              'The same filters as the audit log, newest first, at most',
              `${EXPORT_MAX_DAYS} days at a time: \`until\` defaults to now and \`since\` to`,
              `${EXPORT_MAX_DAYS} days before it. CSV columns: at, actor, actorKind, app,`,
              'action, target, floor, detail (as JSON). The download is itself recorded',
              'in Activity, as `audit.exported` with the filters used.',
            ].join(' '),
            querystring: Type.Object({
              app: Type.Optional(Type.String()),
              actor: Type.Optional(Type.String()),
              since: Type.Optional(Type.String({ format: 'date-time', description: 'Only entries at or after this time' })),
              until: Type.Optional(Type.String({ format: 'date-time', description: 'Only entries before this time' })),
              workspace: Type.Optional(Type.String({ maxLength: 100, description: 'Only entries on this floor or below it' })),
              ...AUDIT_FILTERS,
              format: Type.Optional(Type.Enum(['csv', 'jsonl'], { default: 'csv' })),
            }),
            response: {
              200: { description: 'The file, as `text/csv` or `application/x-ndjson`' },
              400: refused('The range is longer than the most one download holds, or ends before it starts'),
              403: refused('Not an admin'),
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          if (!caller.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can download Activity.' });
          const { format = 'csv', since: from, until: to, ...rest } = req.query;
          const until = to ? new Date(to) : new Date();
          const since = from ? new Date(from) : new Date(until.getTime() - EXPORT_MAX_DAYS * DAY_MS);
          if (since > until) return reply.code(400).send({ error: 'invalid_range', message: 'The range ends before it starts.' });
          if (until.getTime() - since.getTime() > EXPORT_MAX_DAYS * DAY_MS)
            return reply.code(400).send({ error: 'range_too_long', message: `One download holds at most ${EXPORT_MAX_DAYS} days. Download a shorter range, or several.` });
          const filter = { ...rest, since: since.toISOString(), until: until.toISOString() };
          await store.appendAudit({ actor: { id: caller.id, kind: 'user' }, app: 'events', action: 'audit.exported', detail: { ...filter, format } }, undefined, 'events');
          const day = (d: Date) => d.toISOString().slice(0, 10);
          void reply
            .header('content-type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8')
            .header('content-disposition', `attachment; filename="activity-${day(since)}-${day(until)}.${format}"`);
          return reply.send(Readable.from(exportLines(store, filter, format)));
        },
      );

      // Forgets a deleted person's personal values (ADR 0040). Identity asks once their retention period has passed.
      app.post(
        '/audit/redact',
        {
          schema: {
            summary: "Remove a deleted person's personal values from Activity, and their notifications (identity only)",
            description: [
              'In every entry by, about or naming them, each personal value (the keys in',
              "service-kit's PERSONAL_DETAIL_KEYS, also inside from/to pairs) becomes",
              '"[removed]"; their id stays, now pseudonymous. Their notifications are',
              'deleted. Recorded in Activity as `audit.redacted`.',
            ].join(' '),
            body: Type.Object({ person: Type.String({ minLength: 1, maxLength: 100 }) }, { additionalProperties: false }),
            response: {
              200: Type.Object({ entries: Type.Integer(), notifications: Type.Integer() }, { description: 'How many entries were changed and notifications deleted' }),
              403: refused('Not identity'),
            },
          },
        },
        async (req, reply) => {
          const service = await fromService(req, reply, undefined, 'audit:write');
          if (!service) return reply;
          if (service.kind !== 'platform' || service.name !== 'identity') return reply.code(403).send({ error: 'forbidden', message: 'Only identity removes a deleted person’s details.' });
          const { person } = req.body;
          const removed = await store.redactPerson(person);
          await store.appendAudit({ actor: { id: 'identity', kind: 'service' }, app: 'events', action: 'audit.redacted', detail: { person, entries: removed.entries } }, undefined, serviceName(service));
          req.log.info({ person, ...removed }, 'a deleted person’s details removed');
          return removed;
        },
      );

      // A copy of what the events service keeps about one person (ADR 0040), for identity to put in their download.
      app.get(
        '/people/:id/data',
        {
          schema: {
            summary: 'What the events service keeps about one person (identity only)',
            description: [
              'Their notifications, read or not; the inbox items waiting on them and those',
              'they finished; and the audit entries naming them as the actor: at most',
              '`limit` of each, newest first. Only identity asks, to build the copy of',
              "someone's data they download from Account (ADR 0040).",
            ].join(' '),
            params: Type.Object({ id: Type.String({ minLength: 1, maxLength: 100 }) }),
            querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 1000 })) }),
            response: {
              200: Type.Object(
                {
                  notifications: Type.Array(ref(NotificationSchema)),
                  inbox: Type.Array(Type.Unknown(), { description: 'InboxItem, as the Inbox gives it to them' }),
                  audit: Type.Array(ref(AuditEntry)),
                },
                { description: 'Their data here' },
              ),
              403: refused('Not identity'),
            },
          },
        },
        async (req, reply) => {
          const service = await fromService(req, reply, undefined, 'audit:write');
          if (!service) return reply;
          if (service.kind !== 'platform' || service.name !== 'identity') return reply.code(403).send({ error: 'forbidden', message: 'Only identity reads a person’s data, for their own download.' });
          const { id } = req.params;
          const limit = req.query.limit ?? 1000;
          const [notifications, open, done, audit] = await Promise.all([
            store.notificationsOf(id, limit),
            store.inbox.list({ person: id, teams: [], tab: 'you', limit }),
            store.inbox.list({ person: id, teams: [], tab: 'done', limit }),
            store.audit({ actor: id, limit }),
          ]);
          return { notifications: notifications.map(forCaller), inbox: [...open, ...done].slice(0, limit), audit };
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
