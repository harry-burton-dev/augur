import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { appCredentialsFromEnv, appClientId } from './apps.js';
import { callerFromHeaders, type Caller, type CallerWorkspace } from './caller.js';
import { notify, previewOf, recordAudit, type NotificationAction, type NotificationLevel } from './events.js';
import { publishFrontend } from './frontend.js';
import { createJobs, jobsSchemaFor, type JobLogger, type Jobs } from './jobs.js';
import { identityAudience, identityDirectory, identityPrincipals, type AudienceLookup, type DirectorySearch } from './people.js';
import { Problem, problemDetails } from './problems.js';
import { registerApp } from './registration.js';
import { callerCheckFromEnv, signedCallers, type CallerCheck } from './signed-caller.js';
import { appStorageFromEnv } from './storage.js';
import { health } from './version.js';

/**
 * The app-service starter: what every app's service does the same way, so an app's own code is
 * only its routes and jobs. `appServer` is the Fastify part (signed callers, problem details,
 * /healthz); `startAppService` runs it (listen, jobs, frontend, registration, shutdown).
 * Everything app-specific comes from the manifest, never a literal.
 */

/** What the starter reads from an app's manifest.json. */
export interface AppManifest {
  id: string;
  name: string;
  version: string;
  /** The app contract the manifest is written to (3, ADR 0075); a contract 2 manifest has none. */
  contract?: number;
  [key: string]: unknown;
}

/**
 * The app's manifest: APP_MANIFEST, else the copy the build put beside the code (`dist/manifest.json`),
 * else the repository's own (`../../manifest.json` from `service/src`).
 */
export const readManifest = (moduleUrl: string, env: Record<string, string | undefined> = process.env): AppManifest => {
  const built = new URL('./manifest.json', moduleUrl);
  const path = env.APP_MANIFEST ?? (existsSync(built) ? fileURLToPath(built) : fileURLToPath(new URL('../../manifest.json', moduleUrl)));
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppManifest>;
  if (!manifest.id || !manifest.name || !manifest.version) throw new Error(`The manifest at ${path} needs an id, a name and a version.`);
  return manifest as AppManifest;
};

/** A caller standing on a floor: what most app routes need. */
export type OnFloor = Caller & { workspace: CallerWorkspace };

/**
 * The caller and the floor they're on, or a problem: 401 when nobody is signed in, 400 when the
 * request didn't say which floor (X-Workspace-Id). Named for the app from its manifest.
 */
export const floorCaller =
  (manifest: Pick<AppManifest, 'name'>) =>
  (req: Pick<FastifyRequest, 'headers'>): OnFloor => {
    const caller = signedInCaller(manifest)(req);
    if (!caller.workspace) throw new Problem(400, 'floor_needed', 'Say which floor this is for (X-Workspace-Id).');
    return caller as OnFloor;
  };

/** The caller, or a 401 problem when nobody is signed in. */
export const signedInCaller =
  (manifest: Pick<AppManifest, 'name'>) =>
  (req: Pick<FastifyRequest, 'headers'>): Caller => {
    const caller = callerFromHeaders(req.headers);
    if (!caller) throw new Problem(401, 'unauthenticated', `Sign in to use ${manifest.name}.`);
    return caller;
  };

export interface AppServerOptions {
  manifest: AppManifest;
  /** The app's own release, for /healthz. Defaults to the manifest's version. */
  version?: string;
  /** The major version of the API it serves, its route prefix. */
  api?: string;
  /** Checks the caller the gateway signed for this app, for its client `app-<id>`. On by default; off only under `pnpm dev:app` and tests (callerCheckFromEnv). */
  callers?: CallerCheck;
}

/**
 * What every app's Fastify instance starts with: only the gateway's signed caller is believed,
 * every error is RFC 9457 problem details, and GET /healthz says what is running.
 */
export const appServer = async (app: FastifyInstance, { manifest, version = manifest.version, api = 'v1', callers = callerCheckFromEnv(appClientId(manifest.id)) }: AppServerOptions) => {
  app.addHook('onRequest', signedCallers(callers));
  await app.register(problemDetails());
  app.get('/healthz', async () => health(manifest.id, version, api));
};

/** An audit entry from an app: who did what to which thing, on which floor. */
export interface AppAuditEntry {
  actor: string;
  /** A person (the default), or the app itself doing its own work. */
  actorKind?: 'user' | 'service';
  action: string;
  target: string;
  workspace?: string;
  detail?: Record<string, unknown>;
}

export type AppAudit = (entry: AppAuditEntry) => Promise<void>;

/**
 * Writes to the platform's audit log as the app (the `audit:write` scope), or, with no EVENTS_URL
 * or sign-in as under `pnpm dev:app`, to `log` only.
 */
export const auditFor = (app: string, log: (entry: AppAuditEntry) => void, env = process.env): AppAudit => {
  const credentials = appCredentialsFromEnv(app, env);
  const eventsUrl = env.EVENTS_URL;
  if (!eventsUrl || !credentials) return async (entry) => log(entry);
  return ({ actor, actorKind = 'user', action, target, workspace, detail }) =>
    recordAudit({ eventsUrl, credentials, workspace, env, entry: { actor: { id: actor, kind: actorKind }, app, action, target, ...(detail ? { detail } : {}) } });
};

/** Something an app tells people through the shell's stream, on the floor it happened on. */
export interface AppNotice {
  recipients: string[];
  workspace: string;
  title: string;
  detail?: string;
  /** Path inside the app to open. */
  link?: string;
  actions?: NotificationAction[];
  level?: NotificationLevel;
  /** One of the app's `notifications.kinds`, so people can choose how it reaches them. */
  kind?: string;
}

export type AppNotify = (notice: AppNotice) => Promise<void>;

/** The most people one notification goes to; a larger audience is told in turns. */
const PER_CALL = 500;

/** Tells people as the app (the `notifications:send` scope), or, with no EVENTS_URL or sign-in, writes it to `log` only. */
export const notifyFor = (app: string, log: (notice: AppNotice) => void, env = process.env): AppNotify => {
  const credentials = appCredentialsFromEnv(app, env);
  const eventsUrl = env.EVENTS_URL;
  if (!eventsUrl || !credentials) return async (notice) => log(notice);
  return async ({ recipients, workspace, level = 'info', ...notice }) => {
    for (let i = 0; i < recipients.length; i += PER_CALL)
      await notify({ eventsUrl, credentials, workspace, env, notification: { app, level, recipients: recipients.slice(i, i + PER_CALL), ...notice } });
  };
};

/** What an app asks identity about people. */
export interface AppPeople {
  /** Everything someone stands for: `person:<id>`, `team:`/`tree:` for their teams and those above, `org`. */
  principals: (person: string, workspace: CallerWorkspace) => Promise<string[]>;
  directory: DirectorySearch;
  audience: AudienceLookup;
}

/**
 * Without identity, as under `pnpm dev:app`: someone stands for themselves, the team floor they're
 * on and the org; nobody can be found by name and no team is told.
 */
export const standInPeople: AppPeople = {
  principals: async (person, workspace) => [`person:${person}`, ...(workspace.kind === 'team' ? [`team:${workspace.id}`, `tree:${workspace.id}`] : []), 'org'],
  directory: async () => ({ people: [], teams: [] }),
  audience: async () => [],
};

/** Asks identity as the app (the `people:read` scope), or, with no IDENTITY_URL or sign-in, `fallback`. */
export const peopleFor = (app: string, { fallback = standInPeople, env = process.env }: { fallback?: AppPeople; env?: Record<string, string | undefined> } = {}): AppPeople => {
  const credentials = appCredentialsFromEnv(app, env);
  const identityUrl = env.IDENTITY_URL;
  if (!identityUrl || !credentials) return fallback;
  const lookup = identityPrincipals({ identityUrl, credentials });
  return { principals: (person) => lookup(person), directory: identityDirectory({ identityUrl, credentials }), audience: identityAudience({ identityUrl, credentials }) };
};

/** What an app's `buildApp` is given. */
export interface AppServiceContext {
  manifest: AppManifest;
  /** Define the app's jobs on it; they start once the service is listening. */
  jobs: Jobs;
  audit: AppAudit;
  notify: AppNotify;
  log: JobLogger;
}

export interface StartAppServiceOptions {
  manifest: AppManifest;
  /** Builds the app's Fastify instance, with `appServer` registered. */
  buildApp: (context: AppServiceContext) => Promise<FastifyInstance>;
  /** Defines jobs that need the built app (scheduled tidy-ups and the like). Jobs can also be defined in `buildApp`. */
  jobs?: (jobs: Jobs, app: FastifyInstance) => void;
  /** Defaults to PORT, else 8090. */
  port?: number;
  env?: Record<string, string | undefined>;
}

/**
 * Starts an app's service the one way every app does: build it, listen, launch its jobs, give the
 * registry its frontend and put it in the catalogue, and on SIGTERM stop taking requests, let jobs
 * reach a step and close. Returns the running app.
 */
export async function startAppService({ manifest, buildApp, jobs: defineJobs, port, env = process.env }: StartAppServiceOptions): Promise<FastifyInstance> {
  // Until the app's own logger exists, the starter's lines go to the console as JSON.
  let log: JobLogger = { info: (o, m) => console.log(JSON.stringify({ level: 'info', ...(o as object), msg: m })), warn: (o, m) => console.warn(JSON.stringify({ level: 'warn', ...(o as object), msg: m })), error: (o, m) => console.error(JSON.stringify({ level: 'error', ...(o as object), msg: m })) };
  const lazy: JobLogger = { info: (o, m) => log.info(o, m), warn: (o, m) => log.warn(o, m), error: (o, m) => log.error(o, m), debug: (o, m) => log.debug?.(o, m) };
  const audit = auditFor(manifest.id, (entry) => lazy.info({ audit: entry }, 'audit (no audit log here)'), env);
  const tell = notifyFor(manifest.id, (notice) => lazy.info({ notice }, 'notification (no notifications here)'), env);
  const { databaseUrl } = appStorageFromEnv(env);
  // A preview's login owns only its own storage (<id>-pr<n>), so its jobs are kept there too.
  const pr = previewOf(env);
  const jobs = createJobs({ app: manifest.id, databaseUrl, schema: jobsSchemaFor(pr === undefined ? manifest.id : `${manifest.id}-pr${pr}`), log: lazy, audit: (entry) => audit(entry) });

  const app = await buildApp({ manifest, jobs, audit, notify: tell, log: lazy });
  log = app.log;
  defineJobs?.(jobs, app);
  await app.listen({ port: port ?? Number(env.PORT ?? 8090), host: '0.0.0.0' });
  await jobs.launch();

  const stop = async (signal: string) => {
    app.log.info({ signal }, 'stopping');
    await app.close();
    await jobs.shutdown();
    process.exit(0);
  };
  process.once('SIGTERM', (s) => void stop(s));
  process.once('SIGINT', (s) => void stop(s));

  // On the app contract the runner registers the release it installed and keeps its frontend; a part that
  // registered itself would be refused, as any manifest the runner wasn't given is.
  if (manifest.contract !== undefined) app.log.info({ app: manifest.id, version: manifest.version, contract: manifest.contract }, 'on the app contract: the app runner registers the app, not this part');
  else void register(manifest, app, env);
  return app;
}

/**
 * Puts the app in the platform's catalogue, so the shell can offer it. It signs in as itself with
 * SERVICE_CLIENT_SECRET. A released image carries its built frontend (APP_FRONTEND, or the
 * `frontend/` beside the service), which goes to the registry first, so the shell loads this
 * version's own copy of it. Failures are logged: the service keeps serving.
 */
const register = async (manifest: AppManifest, app: FastifyInstance, env: Record<string, string | undefined>) => {
  const { REGISTRY_URL, APP_FRONTEND } = env;
  const credentials = appCredentialsFromEnv(manifest.id, env);
  if (!REGISTRY_URL || !credentials) {
    app.log.info(`REGISTRY_URL or the app’s sign-in (SERVICE_CLIENT_SECRET) is not set, so ${manifest.name} is not in the catalogue (fine under pnpm dev:app).`);
    return;
  }
  const frontend = APP_FRONTEND ?? fileURLToPath(new URL('../frontend/', pathToFileURL(process.argv[1] ?? join(process.cwd(), 'dist', 'index.js'))));
  if (existsSync(join(frontend, 'entry.js'))) {
    try {
      const kept = await publishFrontend({ registryUrl: REGISTRY_URL, credentials, app: manifest.id, version: manifest.version, dir: frontend });
      app.log.info({ version: manifest.version, kept }, kept ? 'frontend kept by version' : 'this deployment doesn’t keep frontends by version');
    } catch (err) {
      // Registering anyway: the manifest's own entry still serves the frontend from the web image.
      app.log.error((err as Error).message);
    }
  }
  try {
    if (await registerApp({ registryUrl: REGISTRY_URL, credentials, manifest, env })) app.log.info({ app: manifest.id, version: manifest.version }, 'registered with the platform');
  } catch (err) {
    app.log.error((err as Error).message);
  }
};
