import { callerCheckFromEnv, commonSettings, followEvents, loadConfigOrExit, platformCredentialsFromEnv, serviceVerifierFromEnv, startupLog } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { loadModel, OpenFga } from './openfga.ts';
import { COPY_TOPICS, identityRelationships, keepProjecting, project } from './projection.ts';

const log = startupLog('permissions');

// Every setting the permissions service reads, checked before it starts.
loadConfigOrExit('permissions', [
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.gateway,
  commonSettings.identity,
  commonSettings.events,
  { ...commonSettings.clientSecret, about: 'the permissions service’s own sign-in, to read floors and positions from identity.' },
  { name: 'OPENFGA_URL', about: 'where OpenFGA’s HTTP API is reached, which holds the relationships (ADR 0085).', required: true },
  { name: 'OPENFGA_TOKEN', about: 'OpenFGA’s preshared key.', secret: true },
  { name: 'PERMISSIONS_STORE', about: 'the name of the OpenFGA store this deployment’s permissions are kept in (default augur).' },
  { name: 'PERMISSIONS_COPY_SECONDS', about: 'how often floors, positions and who holds them are copied whole from identity, besides after each change it announces (default 300).' },
]);

const port = Number(process.env.PORT ?? 8087);
const engine = new OpenFga({ url: process.env.OPENFGA_URL!, token: process.env.OPENFGA_TOKEN || undefined });

// The store and the model are made or found on every start: a release with a new model writes it, and an
// earlier release finds its own again (OpenFGA keeps every model it was given).
const model = loadModel();
const store = await engine.ensureStore(process.env.PERMISSIONS_STORE || 'augur');
const modelId = await engine.ensureModel(store, model);
log.info(`answering from model ${modelId}`);

// Identity's floors, positions and holders (ADR 0089): copied in now, again as soon as identity announces a
// change, and whole every PERMISSIONS_COPY_SECONDS to put right anything an event missed.
const credentials = platformCredentialsFromEnv('permissions');
const relationships = credentials
  ? identityRelationships({ identityUrl: process.env.IDENTITY_URL!, credentials })
  : () => Promise.reject(new Error('SERVICE_CLIENT_SECRET is not set, so identity can’t be asked.'));
const copy = keepProjecting(
  () => project({ engine, store, modelId, relationships }),
  Math.max(5, Number(process.env.PERMISSIONS_COPY_SECONDS) || 300) * 1000,
  (run) => {
    if (run.error) log.warn(`floors and positions couldn’t be copied from identity: ${run.error}`);
    else if (run.heldBack) log.warn(`identity’s answer would take away ${run.heldBack} relationships at once; held back until it’s checked`);
    else if (run.added || run.removed) log.info(`copied from identity: ${run.added} added, ${run.removed} taken away`);
  },
);

// Only what happens from now: the copy at start already has everything before it.
if (credentials) {
  const since = new Date().toISOString();
  let place: string | undefined;
  followEvents({
    eventsUrl: process.env.EVENTS_URL!,
    credentials,
    topics: COPY_TOPICS,
    intervalMs: 1000,
    cursor: { load: async () => place, save: async (seq) => void (place = seq) },
    handle: async (event) => {
      if (event.at >= since) copy.request();
    },
    onError: (err) => log.warn(`identity’s changes couldn’t be heard, so they wait for the next whole copy: ${(err as Error).message}`),
  }).start();
}

const app = await buildApp({ engine, store, modelId, model, verifyService: serviceVerifierFromEnv(), callers: callerCheckFromEnv('permissions'), projection: copy.last });
await app.listen({ port, host: '0.0.0.0' });
