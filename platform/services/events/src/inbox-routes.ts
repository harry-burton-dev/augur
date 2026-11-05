import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import {
  FloorsUnavailable,
  PeopleUnavailable,
  type Caller,
  type DirectorySearch,
  type FloorLookup,
  type InboxItem,
  type InboxOwner,
  type PrincipalLookup,
  type Scope,
  type ServiceIdentity,
} from '@augur/service-kit';
import { InboxChange as InboxChangeSchema, InboxCounts, InboxHistory, InboxItem as InboxItemSchema, NewInboxItem as NewInboxItemSchema, refused, ref } from './schemas.ts';
import { overdue, ownerPrincipal, type InboxAction, type InboxStore, type StepResult } from './inbox.ts';
import type { EventFloor, EventStore } from './store.ts';

/** The intent Open raises travels to the browser whole; like a notification action's, it stays small. */
const OPEN_PAYLOAD_BYTES = 1024;

/** Most items in one page of a person's inbox. */
const PAGE = 100;

/** The kinds an app's manifest declares under `inbox.kinds`; undefined when the registry can't say (they aren't checked then). */
export type InboxKindLookup = (app: string) => Promise<string[] | undefined>;

export interface InboxDeps {
  inbox: InboxStore;
  store: EventStore;
  floors?: FloorLookup;
  /** Whether a person exists and can sign in: identity's directory lists only those who can. */
  directory?: DirectorySearch;
  /** Which teams a person is on (`team:<id>` principals), cached by the lookup itself. */
  principals?: PrincipalLookup;
  kinds?: InboxKindLookup;
  signedIn: (req: FastifyRequest, reply: FastifyReply) => Caller | undefined;
  fromService: (req: FastifyRequest, reply: FastifyReply, forApp: string | undefined, scope: Scope) => Promise<ServiceIdentity | undefined>;
  floorOf: (req: FastifyRequest, reply: FastifyReply) => Promise<(EventFloor & { kind: string }) | null | undefined>;
}

/**
 * Gives the team items a person had taken back to their teams when they leave one (`team`), or every
 * team when their sign-in is turned off, so the work isn't left with someone who can't do it. Each is
 * written to the audit log as the events service's step, and published as `platform.inbox.released`
 * with `left: true`. Items owned by the person themselves stay theirs: handing those over is the
 * leaver flow's (PER-194). Returns how many went back.
 */
export const releaseLeaver = async (store: EventStore, person: string, team?: string): Promise<number> => {
  const inbox = store.inbox;
  let released = 0;
  let before: string | undefined;
  for (;;) {
    const page = await inbox.list({ person, teams: [], tab: 'you', before, limit: PAGE });
    for (const item of page) {
      if (item.owner.kind !== 'team' || item.takenBy !== person || (team && item.owner.id !== team)) continue;
      const r = await inbox.act(item.id, { action: 'released', by: person });
      if (!('item' in r)) continue;
      released++;
      await store.appendAudit(
        { actor: { id: 'events', kind: 'service' }, app: 'events', action: 'inbox.released', target: item.id, detail: { app: item.app, key: item.key, kind: item.kind, person, left: team ? 'team' : 'turned-off' } },
        item.workspace,
        'events',
      );
      await store.publish('events', [{ topic: 'platform.inbox.released', id: `inbox-${r.step}`, payload: { item: item.id, app: item.app, key: item.key, by: person, left: true }, floor: item.workspace }]);
    }
    if (page.length < PAGE) return released;
    before = page.at(-1)!.id;
  }
};

/** The teams a person is on, from identity. Without identity (local dev), the team they stand on. */
export const teamsOf = async (caller: Caller, principals: PrincipalLookup | undefined): Promise<string[]> => {
  if (!principals) return caller.workspace ? [caller.workspace.id] : [];
  return (await principals(caller.id)).filter((p) => p.startsWith('team:')).map((p) => p.slice(5));
};

/** Whether the caller stands on this team as one of its leads, as the gateway checked. */
const leadOn = (caller: Caller, team: string) => caller.workspace?.id === team && caller.workspace.role === 'lead';

/** What a member who isn't standing on the team as a lead sees of a leads-only item: that it's there. */
const redact = ({ id, app, key, kind, owner, state, allow, due, createdAt, updatedAt, workspace }: InboxItem) =>
  ({ id, app, key, kind, owner, state, allow, ...(due ? { due } : {}), createdAt, updatedAt, ...(workspace ? { workspace } : {}), redacted: true }) as InboxItem & { redacted: true };

const shown = (item: InboxItem) => ({ ...item, ...(overdue(item) && item.state === 'open' ? { overdue: true } : {}) });

const PERSON_ACTIONS = { take: 'taken', release: 'released', decline: 'declined', 'hand-on': 'handed-on', done: 'done' } as const;

/**
 * The Inbox's API: apps' services put, change and read their own items (`inbox:write`, on the
 * floor the call names); people list theirs and act on them through the gateway. Every step is
 * audited, and people's steps are published as `platform.inbox.*` so the app keeps up.
 */
export const inboxRoutes = (plain: FastifyInstance, deps: InboxDeps) => {
  const app = plain.withTypeProvider<TypeBoxTypeProvider>();
  const { inbox, store, floors, directory, principals, kinds, signedIn, fromService, floorOf } = deps;

  /** Undefined when a reply has been sent. */
  const myTeams = async (caller: Caller, reply: FastifyReply) => {
    try {
      return await teamsOf(caller, principals);
    } catch (err) {
      if (!(err instanceof PeopleUnavailable)) throw err;
      void reply.code(503).send({ error: 'unavailable', message: 'Which teams you’re on can’t be checked right now. Try again in a moment.' });
      return undefined;
    }
  };

  /** Why an owner can't have items, or undefined when it can. Throws when identity can't say. */
  const ownerProblem = async (owner: InboxOwner): Promise<string | undefined> => {
    if (owner.kind === 'person') {
      if (!directory) return undefined;
      const { people } = await directory({ ids: [owner.id] });
      return people.some((p) => p.id === owner.id) ? undefined : 'There is no such person, or their sign-in is turned off. Send it to their team or someone else.';
    }
    if (owner.role && owner.kind !== 'team') return 'Only a team item can be for its leads.';
    if (!floors) return undefined;
    const place = await floors(owner.id);
    if (!place || place.kind !== 'team') return 'There is no such team.';
    if (place.archivedAt) return 'That team was archived. Send it to another team or someone on it.';
    return undefined;
  };

  /** Asks identity about an owner; answers and returns true when the reply has been sent. */
  const refuseOwner = async (owner: InboxOwner, reply: FastifyReply) => {
    try {
      const problem = await ownerProblem(owner);
      if (problem) void reply.code(400).send({ error: 'bad_request', message: problem });
      return !!problem;
    } catch (err) {
      if (!(err instanceof FloorsUnavailable) && !(err instanceof PeopleUnavailable)) throw err;
      void reply.code(503).send({ error: 'unavailable', message: 'Who that is can’t be checked right now. Try again in a moment.' });
      return true;
    }
  };

  /** Writes each step to the audit log, and a person's step as a domain event the app follows. */
  const told = async (item: InboxItem, step: string, action: string, by: string | undefined, extra: Record<string, unknown> = {}) => {
    const floor = item.workspace;
    await store.appendAudit(
      { actor: by ? { id: by, kind: 'user' } : { id: item.app, kind: 'service' }, app: 'events', action: `inbox.${action}`, target: item.id, detail: { app: item.app, key: item.key, kind: item.kind } },
      floor,
      'events',
    );
    if (by) await store.publish('events', [{ topic: `platform.inbox.${action}`, id: `inbox-${step}`, payload: { item: item.id, app: item.app, key: item.key, by, ...extra }, floor }]);
  };

  const notThere = (reply: FastifyReply, r: Exclude<StepResult, { item: InboxItem }>) => {
    if ('missing' in r) return reply.code(404).send({ error: 'not_found', message: 'There is no such item.' });
    if ('closed' in r) return reply.code(409).send({ error: 'conflict', message: `This was already closed (${r.closed.state}).` });
    return reply.code(409).send({ error: 'conflict', message: 'Someone took this a moment ago.', takenBy: r.takenBy });
  };

  // ---- apps' services ----

  const ItemParams = Type.Object({ app: Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}$' }), key: Type.String({ minLength: 1, maxLength: 200 }) });
  const serviceRefusals = {
    403: refused("Not a signed-in service, not this app's item, or no inbox:write on that floor"),
    503: refused("Floors, grants or people can't be checked right now"),
  };

  app.put(
    '/inbox/items/:app/:key',
    {
      schema: {
        summary: "Put an item in someone's inbox, or change it (services only, inbox:write)",
        description: [
          "Keyed by the app's own id for the work: putting the same key again changes the one item.",
          "The item is on the call's floor (x-workspace-id), where the grant is checked. The owner is",
          'a person who can sign in, or a team that is not archived. A closed item is reopened only',
          'with reopen. No notification is sent: the Inbox count and Home show it (ADR 0026).',
        ].join(' '),
        params: ItemParams,
        body: ref(NewInboxItemSchema),
        response: {
          200: { ...ref(InboxItemSchema), description: 'Changed' },
          201: { ...ref(InboxItemSchema), description: 'Added' },
          400: refused('Invalid item, a kind the manifest does not declare, an unknown owner or floor'),
          409: refused('The item is closed; send reopen to open it again'),
          ...serviceRefusals,
        },
      },
    },
    async (req, reply) => {
      const { app: forApp, key } = req.params;
      if (!(await fromService(req, reply, forApp, 'inbox:write'))) return reply;
      const floor = await floorOf(req, reply);
      if (floor === undefined) return reply;
      const item = req.body;
      if (item.open?.payload !== undefined && Buffer.byteLength(JSON.stringify(item.open.payload)) > OPEN_PAYLOAD_BYTES) {
        return reply.code(400).send({ error: 'bad_request', message: `The payload of the open intent is over ${OPEN_PAYLOAD_BYTES} bytes. Send an id and let the app look the rest up.` });
      }
      if (item.due && Number.isNaN(Date.parse(item.due))) return reply.code(400).send({ error: 'bad_request', message: `"${item.due}" isn’t a date.` });
      if (item.owner.role && item.owner.kind !== 'team') return reply.code(400).send({ error: 'bad_request', message: 'Only a team item can be for its leads.' });
      const declared = kinds ? await kinds(forApp) : undefined;
      if (declared && !declared.includes(item.kind)) {
        return reply.code(400).send({ error: 'bad_request', message: `${forApp} doesn’t declare the inbox kind "${item.kind}" in its manifest (inbox.kinds).` });
      }
      if (await refuseOwner(item.owner, reply)) return reply;
      const put = await inbox.put(forApp, key, { ...item, ...(item.due ? { due: new Date(item.due).toISOString() } : {}) }, floor ? { id: floor.id, path: floor.path } : undefined);
      if ('closed' in put) return reply.code(409).send({ error: 'conflict', message: `This item is closed (${put.closed.state}). Send reopen to open it again.` });
      if (put.created) await told(put.item, put.step, 'created', undefined);
      req.log.info({ app: forApp, key, created: put.created, owner: ownerPrincipal(put.item.owner) }, 'inbox item put');
      return reply.code(put.created ? 201 : 200).send(shown(put.item));
    },
  );

  app.patch(
    '/inbox/items/:app/:key',
    {
      schema: {
        summary: 'Change an item the app made, or close it as done or withdrawn (services only, inbox:write)',
        params: ItemParams,
        body: ref(InboxChangeSchema),
        response: {
          200: { ...ref(InboxItemSchema), description: 'The item now' },
          404: refused('No such item'),
          409: refused('Already closed'),
          ...serviceRefusals,
        },
      },
    },
    async (req, reply) => {
      const { app: forApp, key } = req.params;
      if (!(await fromService(req, reply, forApp, 'inbox:write'))) return reply;
      if (req.body.due && Number.isNaN(Date.parse(req.body.due))) return reply.code(400).send({ error: 'bad_request', message: `"${req.body.due}" isn’t a date.` });
      const r = await inbox.patch(forApp, key, { ...req.body, ...(req.body.due ? { due: new Date(req.body.due).toISOString() } : {}) });
      if (!('item' in r)) return notThere(reply, r);
      if (req.body.state) await told(r.item, r.step, req.body.state, undefined);
      return shown(r.item);
    },
  );

  app.get(
    '/inbox/items/:app/:key',
    {
      schema: {
        summary: 'An item the app made, with its history and notes (services only, inbox:write)',
        params: ItemParams,
        response: {
          200: Type.Intersect([ref(InboxItemSchema), Type.Object({ history: Type.Array(ref(InboxHistory)) })], { description: 'The item and every change to it' }),
          404: refused('No such item'),
          ...serviceRefusals,
        },
      },
    },
    async (req, reply) => {
      const { app: forApp, key } = req.params;
      if (!(await fromService(req, reply, forApp, 'inbox:write'))) return reply;
      const item = await inbox.byKey(forApp, key);
      if (!item) return reply.code(404).send({ error: 'not_found', message: 'There is no such item.' });
      return { ...shown(item), history: await inbox.history(item.id) };
    },
  );

  // ---- people, through the gateway ----

  app.get(
    '/inbox',
    {
      schema: {
        summary: "The caller's inbox: one tab, newest first",
        description: [
          'you: open items on the caller, or team items they took. teams: untaken items of the teams',
          "they're on; a leads-only item is shown whole to a lead standing on that team",
          '(x-workspace-id) and redacted to anyone else on it. done: items closed in the last doneDays days (/inbox/counts)',
          'that the caller owned or acted on. To page, pass the last id shown as before.',
        ].join(' '),
        querystring: Type.Object({
          tab: Type.Optional(Type.Enum(['you', 'teams', 'done'], { default: 'you' })),
          floor: Type.Optional(Type.String({ maxLength: 100, description: 'Only items on this floor' })),
          before: Type.Optional(Type.String({ maxLength: 40, description: "The last item's id already shown" })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: PAGE, default: PAGE })),
        }),
        response: {
          200: Type.Array(ref(InboxItemSchema), { description: 'Items' }),
          401: refused('No signed-in caller'),
          503: refused("The caller's teams can't be checked right now"),
        },
      },
    },
    async (req, reply) => {
      const caller = signedIn(req, reply);
      if (!caller) return reply;
      const tab = req.query.tab ?? 'you';
      const teams = tab === 'you' ? [] : await myTeams(caller, reply);
      if (!teams) return reply;
      const items = await inbox.list({ person: caller.id, teams, tab, floor: req.query.floor, before: req.query.before, limit: req.query.limit ?? PAGE });
      return items.map((i) => (tab === 'teams' && i.owner.role === 'lead' && !leadOn(caller, i.owner.id) ? redact(i) : shown(i)));
    },
  );

  app.get(
    '/inbox/counts',
    {
      schema: {
        summary: "How many items wait on the caller and on their teams, for the shell's count",
        response: { 200: { ...ref(InboxCounts), description: 'Counts' }, 401: refused('No signed-in caller'), 503: refused("The caller's teams can't be checked right now") },
      },
    },
    async (req, reply) => {
      const caller = signedIn(req, reply);
      if (!caller) return reply;
      const teams = await myTeams(caller, reply);
      if (!teams) return reply;
      return { ...(await inbox.counts(caller.id, teams, teams.filter((t) => leadOn(caller, t)))), doneDays: inbox.doneDays };
    },
  );

  /** Whether the caller may see an item: it's on them, they took it, it's for a team of theirs, or they closed or acted on it. */
  const canSee = async (caller: Caller, item: InboxItem, teams: string[]) =>
    (item.owner.kind === 'person' && item.owner.id === caller.id) ||
    item.takenBy === caller.id ||
    item.closedBy === caller.id ||
    (item.owner.kind === 'team' && teams.includes(item.owner.id)) ||
    (await inbox.history(item.id)).some((h) => h.by === caller.id && h.action !== 'created');

  const IdParams = Type.Object({ id: Type.String({ maxLength: 40 }) });

  app.get(
    '/inbox/:id',
    {
      schema: {
        summary: 'One item the caller can see, with its history',
        params: IdParams,
        response: {
          200: Type.Intersect([ref(InboxItemSchema), Type.Object({ history: Type.Array(ref(InboxHistory)) })], { description: 'The item and every change to it' }),
          401: refused('No signed-in caller'),
          404: refused('No such item, or not one the caller can see'),
        },
      },
    },
    async (req, reply) => {
      const caller = signedIn(req, reply);
      if (!caller) return reply;
      const item = await inbox.get(req.params.id);
      const teams = item ? await myTeams(caller, reply) : [];
      if (!teams) return reply;
      if (!item || !(await canSee(caller, item, teams))) return reply.code(404).send({ error: 'not_found', message: 'You have no such item.' });
      if (item.owner.kind === 'team' && item.owner.role === 'lead' && !leadOn(caller, item.owner.id) && item.takenBy !== caller.id) return { ...redact(item), history: [] };
      return { ...shown(item), history: await inbox.history(item.id) };
    },
  );

  /**
   * Whether the caller may act on an item now: a person item is its owner's; a team item is its
   * taker's once taken, and before that any member's (leads only, for a leads-only item, standing
   * on the team). The reason when not.
   */
  const notYours = (caller: Caller, item: InboxItem, teams: string[]) => {
    if (item.owner.kind === 'person') return item.owner.id === caller.id ? undefined : 'This item is someone else’s.';
    if (item.takenBy) return item.takenBy === caller.id ? undefined : 'Someone else on the team took this.';
    if (!teams.includes(item.owner.id)) return 'You’re not on the team this is for.';
    if (item.owner.role === 'lead' && !leadOn(caller, item.owner.id)) return 'This is for the team’s leads. Stand on the team as a lead to act on it.';
    return undefined;
  };

  for (const [verb, action] of Object.entries(PERSON_ACTIONS)) {
    const body =
      verb === 'decline'
        ? Type.Object({ note: Type.String({ minLength: 1, maxLength: 500, description: 'Why: the app and the sender need to know' }) }, { additionalProperties: false })
        : verb === 'hand-on'
          ? Type.Object(
              { to: Type.String({ pattern: '^(person|team):[A-Za-z0-9_.:-]{1,100}$', description: 'person:<id> or team:<id>' }), note: Type.Optional(Type.String({ maxLength: 500 })) },
              { additionalProperties: false },
            )
          : undefined;
    app.post(
      `/inbox/:id/${verb}`,
      {
        schema: {
          summary: {
            take: 'Take a team item: it becomes the caller’s, shown to the team as taken',
            release: 'Give a taken item back to its team',
            decline: 'Decline an item, saying why',
            'hand-on': 'Hand an item on to another person or team',
            done: 'Mark an item done, where the app lets people do that',
          }[verb],
          description: `Publishes platform.inbox.${action} with { item, app, key, by${verb === 'hand-on' ? ', to' : ''} } and records inbox.${action} in the audit log.`,
          params: IdParams,
          ...(body ? { body } : {}),
          response: {
            200: { ...ref(InboxItemSchema), description: 'The item now' },
            400: refused(verb === 'hand-on' ? 'An unknown person or team, or the owner it already has' : 'Invalid request'),
            401: refused('No signed-in caller'),
            403: refused('Not the caller’s to act on, or the app does not allow it'),
            404: refused('No such item, or not one the caller can see'),
            409: {
              description: verb === 'take' ? 'Already closed, or someone took it first (takenBy names who)' : 'Already closed',
              content: { 'application/problem+json': { schema: Type.Object({ takenBy: Type.Optional(Type.String()) }, { additionalProperties: true }) } },
            },
            503: refused("The caller's teams, or who that is, can't be checked right now"),
          },
        },
      },
      async (req: FastifyRequest<{ Params: { id: string }; Body: { note?: string; to?: string } | undefined }>, reply: FastifyReply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        const item = await inbox.get(req.params.id);
        const teams = item ? await myTeams(caller, reply) : [];
        if (!teams) return reply;
        if (!item || !(await canSee(caller, item, teams))) return reply.code(404).send({ error: 'not_found', message: 'You have no such item.' });
        if (item.state !== 'open') return notThere(reply, { closed: item });
        let step: InboxAction;
        if (verb === 'take') {
          if (item.owner.kind !== 'team') return reply.code(403).send({ error: 'forbidden', message: 'Only a team item is taken.' });
          if (item.takenBy) return notThere(reply, { takenBy: item.takenBy });
          const why = notYours(caller, item, teams);
          if (why) return reply.code(403).send({ error: 'forbidden', message: why });
          step = { action: 'taken', by: caller.id };
        } else if (verb === 'release') {
          if (item.takenBy !== caller.id) return reply.code(403).send({ error: 'forbidden', message: 'Only whoever took it gives it back.' });
          step = { action: 'released', by: caller.id };
        } else {
          const why = notYours(caller, item, teams);
          if (why) return reply.code(403).send({ error: 'forbidden', message: why });
          if (verb === 'decline') {
            if (!item.allow.decline) return reply.code(403).send({ error: 'forbidden', message: 'The app that made this doesn’t let it be declined.' });
            const note = req.body?.note?.trim();
            if (!note) return reply.code(400).send({ error: 'bad_request', message: 'Say why you’re declining it.' });
            step = { action: 'declined', by: caller.id, note };
          } else if (verb === 'hand-on') {
            if (!item.allow.handOn) return reply.code(403).send({ error: 'forbidden', message: 'The app that made this doesn’t let it be handed on.' });
            const [kind, ...rest] = req.body!.to!.split(':');
            const to: InboxOwner = { kind: kind as InboxOwner['kind'], id: rest.join(':') };
            if (ownerPrincipal(to) === ownerPrincipal(item.owner) && !item.takenBy) return reply.code(400).send({ error: 'bad_request', message: 'It’s already theirs.' });
            if (await refuseOwner(to, reply)) return reply;
            step = { action: 'handed-on', by: caller.id, to, ...(req.body?.note?.trim() ? { note: req.body.note.trim() } : {}) };
          } else {
            if (!item.allow.selfComplete) return reply.code(403).send({ error: 'forbidden', message: 'The app that made this closes it itself when the work is done. Open it to do the work.' });
            step = { action: 'done', by: caller.id };
          }
        }
        const r = await inbox.act(item.id, step);
        if (!('item' in r)) return notThere(reply, r);
        await told(r.item, r.step, action, caller.id, step.action === 'handed-on' ? { to: ownerPrincipal(step.to) } : {});
        return shown(r.item);
      },
    );
  }
};
