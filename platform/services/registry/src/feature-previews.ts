import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, type NewAuditEntry, type ServiceIdentity } from '@augur/service-kit';
import type { FeaturePreview } from './manifest.ts';
import { empty, FeaturePreview as FeaturePreviewSchema, FeaturePreviewMode as FeaturePreviewModeSchema, FeaturePreviewsAdmin, params, ref, refused } from './schemas.ts';
import type { Ring } from './ring.ts';
import type { AppRecord, AppStore, FeatureOptIn, FeaturePreviewMode } from './store.ts';

/** Who gets a feature preview nobody has chosen for: those who turn it on, on a preview server; nobody on a production one. */
export const defaultMode = (ring: Ring): FeaturePreviewMode => (ring === 'production' ? 'off' : 'opt-in');

/** Whether a preview's last day (`until`, YYYY-MM-DD) is behind `now`. */
export const ended = (preview: Pick<FeaturePreview, 'until'>, now: Date) => Boolean(preview.until && preview.until < now.toISOString().slice(0, 10));

/** One of an app's feature previews as it stands: who gets it, whether its time is up, and whether an admin chose that. */
export const previewState = (record: AppRecord, preview: FeaturePreview, ring: Ring, now: Date) => {
  const set = record.featurePreviews?.[preview.id];
  return { mode: set?.mode ?? defaultMode(ring), ended: ended(preview, now), ...(set ? { setBy: set.setBy, setAt: set.setAt } : {}) };
};

/** The ids of an app's feature previews that are on for one person: every one for everyone, and the opt-in ones they turned on. Never an ended one. */
export const previewsOnFor = (record: AppRecord, optIns: FeatureOptIn[], ring: Ring, now: Date) =>
  (record.entry.previews ?? [])
    .filter((p) => {
      const state = previewState(record, p, ring, now);
      if (state.ended) return false;
      return state.mode === 'everyone' || (state.mode === 'opt-in' && optIns.some((o) => o.app === record.entry.id && o.preview === p.id));
    })
    .map((p) => p.id);

export const MODE_WORDS: Record<FeaturePreviewMode, string> = { off: 'off', 'opt-in': 'for those who turn it on', everyone: 'on for everyone' };

export interface FeaturePreviewRouteOptions {
  store: AppStore;
  ring: Ring;
  now?: () => Date;
  serviceOf: (req: FastifyRequest, reply: FastifyReply) => Promise<ServiceIdentity | null | undefined>;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
}

/**
 * Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews`. Admins
 * say who gets each (off, those who turn it on, or everyone), people turn the opt-in ones on for
 * themselves in the shell's Previews, and the app asks `ctx.previewOn(id)`. One past its last day is
 * off for everyone, and Admin says the app should drop it or make it everyone's.
 */
export const featurePreviewRoutes =
  ({ store, ring, now = () => new Date(), serviceOf, record }: FeaturePreviewRouteOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const findApp = async (id: string) => (await store.records()).find((r) => r.entry.id === id);

    /** The feature previews of every app the caller can open, and whether each is on for them. */
    app.get(
      '/feature-previews',
      {
        schema: {
          summary: "Apps' feature previews, and whether each is on for the caller (SDK 1.7)",
          description: [
            'Every app the caller can open that lists `previews` in its manifest. A preview is on for',
            'everyone, for those who turned it on (opt-in), or off; one past its `until` day is ended',
            'and off. On a preview server one nobody chose for is opt-in, on a production server off.',
          ].join(' '),
          response: {
            200: Type.Object(
              {
                apps: Type.Array(
                  Type.Object({
                    app: Type.String(),
                    name: Type.String(),
                    previews: Type.Array(
                      Type.Intersect([
                        ref(FeaturePreviewSchema),
                        Type.Object({ mode: ref(FeaturePreviewModeSchema), ended: Type.Optional(Type.Boolean()), on: Type.Boolean() }),
                      ]),
                    ),
                  }),
                ),
              },
              { description: 'The apps with feature previews' },
            ),
            401: refused('Not signed in'),
          },
        },
      },
      async (req, reply) => {
      const caller = callerFromHeaders(req.headers);
      if (!caller) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to see previews.' });
      const [records, optIns] = await Promise.all([store.records(), store.featureOptIns({ person: caller.id })]);
      const at = now();
      return {
        apps: records
          .filter((r) => r.enabled && r.entry.previews?.length && (!r.entry.requiredRole || caller.roles.includes(r.entry.requiredRole)))
          .map((r) => {
            const on = previewsOnFor(r, optIns, ring, at);
            return {
              app: r.entry.id,
              name: r.entry.name,
              previews: r.entry.previews!.map((p) => {
                const { mode, ended } = previewState(r, p, ring, at);
                return { ...p, mode, ...(ended ? { ended } : {}), on: on.includes(p.id) };
              }),
            };
          }),
      };
      },
    );

    /** Turns one of an app's opt-in feature previews on or off for the caller alone. */
    app.put(
      '/feature-previews/:app/:preview',
      {
        schema: {
          summary: "Turn one of an app's opt-in feature previews on or off for the caller alone",
          params: params('app', 'preview'),
          body: Type.Object({ on: Type.Boolean() }, { additionalProperties: false }),
          response: {
            204: empty('Chosen'),
            401: refused('Not signed in'),
            404: refused("No such app or preview, or the caller can't open the app"),
            409: refused("It isn't opt-in (error not_opt_in), or it has ended (ended)"),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to try a preview.' });
        const found = await findApp(req.params.app);
        const preview = found?.entry.previews?.find((p) => p.id === req.params.preview);
        if (!found || !preview || (found.entry.requiredRole && !caller.roles.includes(found.entry.requiredRole))) {
          return reply.code(404).send({ error: 'not_found', message: 'There is no such preview.' });
        }
        const state = previewState(found, preview, ring, now());
        if (state.ended) return reply.code(409).send({ error: 'ended', message: `${preview.name} ended on ${preview.until}.` });
        if (state.mode !== 'opt-in') return reply.code(409).send({ error: 'not_opt_in', message: `${preview.name} is ${MODE_WORDS[state.mode]}: an admin chose that in Admin → Apps.` });
        await store.setFeatureOptIn(caller.id, found.entry.id, preview.id, req.body.on);
        req.log.info({ by: caller.id, app: found.entry.id, preview: preview.id, on: req.body.on }, 'feature preview chosen');
        return reply.code(204).send();
      },
    );

    /** An app's feature previews for Admin: who gets each, whether that's the server's default, and how many turned it on. */
    const adminView = async (r: AppRecord) => {
      const optIns = await store.featureOptIns({ app: r.entry.id });
      const at = now();
      return {
        defaultMode: defaultMode(ring),
        ring,
        previews: (r.entry.previews ?? []).map((p) => ({
          ...p,
          ...previewState(r, p, ring, at),
          chosen: Boolean(r.featurePreviews?.[p.id]),
          optedIn: optIns.filter((o) => o.preview === p.id).length,
        })),
      };
    };

    app.get(
      '/apps/:id/feature-previews',
      {
        schema: {
          summary: "Who gets each of an app's feature previews (admins)",
          params: params('id'),
          response: {
            200: { ...ref(FeaturePreviewsAdmin), description: 'Its feature previews' },
            403: refused('Not an admin'),
            404: refused('No such app is registered'),
          },
        },
      },
      async (req, reply) => {
        if (!callerFromHeaders(req.headers)?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see who gets an app’s previews.' });
        const found = await findApp(req.params.id);
        if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return adminView(found);
      },
    );

    /** Sets who gets one of an app's feature previews, or with `null` goes back to the server's default. Admins only; audited. */
    app.put(
      '/apps/:id/feature-previews/:preview',
      {
        schema: {
          summary: "Set who gets one of an app's feature previews (admins)",
          description: "`null` goes back to the server's default. Kept when the app registers new versions. Audited as app.preview-set.",
          params: params('id', 'preview'),
          body: Type.Object({ mode: Type.Union([ref(FeaturePreviewModeSchema), Type.Null()]) }, { additionalProperties: false }),
          response: {
            200: { ...ref(FeaturePreviewsAdmin), description: 'Its feature previews as they now are' },
            403: refused('Not an admin'),
            404: refused('No such app, or it offers no such preview'),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose who gets an app’s previews.' });
        const found = await findApp(req.params.id);
        const preview = found?.entry.previews?.find((p) => p.id === req.params.preview);
        if (!found || !preview) return reply.code(404).send({ error: 'not_found', message: `${found ? found.entry.name : req.params.id} has no preview "${req.params.preview}".` });
        const changed = (await store.setFeaturePreview(found.entry.id, preview.id, req.body.mode, caller.id))!;
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: 'app.preview-set',
          target: found.entry.id,
          detail: { preview: preview.id, name: preview.name, mode: req.body.mode ?? defaultMode(ring), ...(req.body.mode === null ? { default: true } : {}) },
        });
        return adminView(changed);
      },
    );

    /** For the app's own service: which of its feature previews are on for one person, so the service can do as the frontend does. */
    app.get(
      '/apps/:id/feature-previews/people/:person',
      {
        schema: {
          summary: "Which of an app's feature previews are on for one person (the app's own service, or admins)",
          params: params('id', 'person'),
          response: {
            200: Type.Object({ on: Type.Array(Type.String()) }, { description: 'The ids on for them' }),
            403: refused("Neither the app's own service nor an admin"),
            404: refused('No such app is registered'),
            503: refused("The sign-in service can't be reached to check the caller's token"),
          },
        },
      },
      async (req, reply) => {
        const service = await serviceOf(req, reply);
        if (service === undefined) return reply;
        const own = service?.kind === 'app' && service.app === req.params.id;
        if (!own && !callerFromHeaders(req.headers)?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only the app itself or an admin can ask whose previews are on.' });
        const found = await findApp(req.params.id);
        if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return { on: previewsOnFor(found, await store.featureOptIns({ person: req.params.person, app: found.entry.id }), ring, now()) };
      },
    );
  };
