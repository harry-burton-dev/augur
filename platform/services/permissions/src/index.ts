import { callerCheckFromEnv, commonSettings, followEvents, loadConfigOrExit, platformCredentialsFromEnv, recordAudit, serviceVerifierFromEnv, startupLog, type NewAuditEntry, serve } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { cascade, PgGrantStore } from './grants.ts';
import { loadModel, OpenFga, type CheckKey } from './openfga.ts';
import { COPY_TOPICS, identityRelationships, keepProjecting, project } from './projection.ts';
import { DEFAULT_LIMITS, PgSessionStore } from './sessions.ts';

const log = startupLog('permissions');

// Every setting the permissions service reads, checked before it starts.
loadConfigOrExit('permissions', [
  { ...commonSettings.database, about: 'the Postgres address and login (platform_permissions) the service keeps persona sessions under, beside OpenFGA’s tables.' },
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.gateway,
  commonSettings.identity,
  commonSettings.events,
  { ...commonSettings.clientSecret, about: 'the permissions service’s own sign-in, to read floors and positions from identity.' },
  { name: 'OPENFGA_URL', about: 'where OpenFGA’s HTTP API is reached, which holds the relationships (ADR 0085).', required: true },
  { name: 'OPENFGA_TOKEN', about: 'OpenFGA’s preshared key.', secret: true },
  { name: 'PERMISSIONS_STORE', about: 'the name of the OpenFGA store this deployment’s permissions are kept in (default augur).' },
  { name: 'PERSONA_DEPLOYMENT_ADMIN_MINUTES', about: 'the longest someone may act as a deployment admin persona at a time (default 60).' },
  { name: 'PERSONA_ORG_ADMIN_MINUTES', about: 'the longest someone may act as an org admin persona at a time (default 480).' },
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
const fromIdentity = credentials
  ? identityRelationships({ identityUrl: process.env.IDENTITY_URL!, credentials })
  : () => Promise.reject(new Error('SERVICE_CLIENT_SECRET is not set, so identity can’t be asked.'));
// The org's id, as identity last gave it, for questions about `org:this`.
let org: string | undefined;
const relationships = async () => {
  const answer = await fromIdentity();
  org = answer.org;
  return answer;
};
// Roles made in AUGUR and every grant given (ADR 0085, D7), in the same schema as persona sessions.
const grants = await PgGrantStore.connect(process.env.DATABASE_URL!);
const audit = credentials ? (entry: NewAuditEntry) => recordAudit({ eventsUrl: process.env.EVENTS_URL!, credentials, entry }) : undefined;
// After each copy from identity: someone who lost a floor or a position may have given from it.
const grantEngine = {
  check: (key: CheckKey) => engine.check(store, modelId, key, { current_time: new Date().toISOString() }, 'HIGHER_CONSISTENCY'),
  write: (writes: CheckKey[], deletes: CheckKey[]) => engine.write(store, modelId, writes, deletes),
};
const sweep = () =>
  cascade({ grants, engine: grantEngine, ...(audit ? { audit } : {}), now: () => new Date() }).then(
    (revoked) => revoked.length && log.info(`${revoked.length} grants taken back: their givers can no longer give them`),
    (err: Error) => log.warn(`grants whose givers lost the right couldn’t be checked: ${err.message}`),
  );

const copy = keepProjecting(
  () => project({ engine, store, modelId, relationships }),
  Math.max(5, Number(process.env.PERMISSIONS_COPY_SECONDS) || 300) * 1000,
  (run) => {
    if (run.error) log.warn(`floors and positions couldn’t be copied from identity: ${run.error}`);
    else if (run.heldBack) log.warn(`identity’s answer would take away ${run.heldBack} relationships at once; held back until it’s checked`);
    else if (run.added || run.removed) log.info(`copied from identity: ${run.added} added, ${run.removed} taken away`);
    if (!run.error) void sweep();
  },
);

// Only what happens from now: the copy at start already has everything before it.
// What runs in the background, to stop before the pools close.
const background: Array<() => void> = [() => copy.stop()];
if (credentials) {
  const since = new Date().toISOString();
  let place: string | undefined;
  const following = followEvents({
    eventsUrl: process.env.EVENTS_URL!,
    credentials,
    topics: COPY_TOPICS,
    intervalMs: 1000,
    cursor: { load: async () => place, save: async (seq) => void (place = seq) },
    handle: async (event) => {
      if (event.at >= since) copy.request();
    },
    onError: (err) => log.warn(`identity’s changes couldn’t be heard, so they wait for the next whole copy: ${(err as Error).message}`),
  });
  following.start();
  background.push(() => following.stop());
}

const minutes = (name: string, fallback: number) => Math.max(1, Math.floor(Number(process.env[name]) || fallback));
const sessionLimits = {
  deploymentAdminMinutes: minutes('PERSONA_DEPLOYMENT_ADMIN_MINUTES', DEFAULT_LIMITS.deploymentAdminMinutes),
  orgAdminMinutes: minutes('PERSONA_ORG_ADMIN_MINUTES', DEFAULT_LIMITS.orgAdminMinutes),
};
const sessions = await PgSessionStore.connect(process.env.DATABASE_URL!);

const app = await buildApp({
  engine,
  store,
  modelId,
  model,
  verifyService: serviceVerifierFromEnv(),
  callers: callerCheckFromEnv('permissions'),
  projection: copy.last,
  org: () => org,
  sessions,
  grants,
  sessionLimits,
  ...(audit ? { audit } : {}),
});
await serve(app, {
  port,
  ready: [
    { name: 'database', check: () => grants.ping() },
    {
      name: 'OpenFGA',
      check: async () => {
        if (!(await engine.healthy())) throw new Error('OpenFGA isn’t answering');
      },
    },
  ],
  close: [...background, () => grants.close(), () => sessions.close()],
});
