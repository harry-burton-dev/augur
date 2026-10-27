import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import semver from 'semver';
import { callerFromHeaders, signedInRecently, type NewAuditEntry, type ServiceIdentity } from '@augur/service-kit';
import { appEntrySchema, settingsProblem, surfaceProblem, versionProblem } from './manifest.ts';
import { APP_JOB_STEPS, type AppJob, type AppJobOutcome, type AppJobStepState, type AppRelease, type AppStore } from './store.ts';

/** What an app release file must say before the runner is asked to install it. Mirrors AppRelease in contracts/registry.openapi.yaml. */
export const APP_RELEASE_SCHEMA = 'augur.app-release/v1';
const DIGEST_REF = '^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$';
const appReleaseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'id', 'version', 'channel', 'manifest', 'service', 'frontend', 'signer'],
  properties: {
    schema: { const: APP_RELEASE_SCHEMA },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    version: { type: 'string', minLength: 1, maxLength: 40 },
    channel: { enum: ['stable', 'beta', 'preview'] },
    releasedAt: { type: 'string', maxLength: 40 },
    sdk: { type: 'string', maxLength: 100 },
    manifest: appEntrySchema,
    service: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['image'], properties: { image: { type: 'string', pattern: DIGEST_REF, maxLength: 300 } } }] },
    frontend: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['artifact', 'digest', 'mediaType'],
          properties: { artifact: { type: 'string', pattern: DIGEST_REF, maxLength: 300 }, digest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' }, mediaType: { type: 'string', maxLength: 100 } },
        },
      ],
    },
    signer: {
      type: 'object',
      additionalProperties: false,
      required: ['repository', 'workflow'],
      properties: { repository: { type: 'string', pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' }, workflow: { type: 'string', pattern: '^\\.github/workflows/[A-Za-z0-9_.-]+\\.ya?ml$' } },
    },
    asks: { type: 'object' },
    notes: { type: 'string', maxLength: 20000 },
  },
} as const;

/** How recently an admin must have entered their password to install code on the server. */
const INSTALL_SIGN_IN_MS = 10 * 60 * 1000;
/** The platform service that runs apps' containers (its Keycloak client is platform-updater). */
const RUNNER = 'updater';
const OUTCOME_ACTIONS: Record<AppJob['action'], Record<AppJobOutcome, string>> = {
  install: { done: 'app.installed', failed: 'app.install-failed' },
  remove: { done: 'app.uninstalled', failed: 'app.uninstall-failed' },
};

/** Why a release can't be installed, beyond its shape; undefined when it can. */
export const releaseProblem = (release: AppRelease, pillars: string[]): string | undefined => {
  if (release.id !== release.manifest.id || release.version !== release.manifest.version) return 'The release file’s id and version must be its manifest’s.';
  if (!semver.valid(release.version)) return `"${release.version}" is not a version such as 1.2.0.`;
  if (pillars.includes(release.id)) return `${release.manifest.name} ships with AUGUR, so it’s upgraded with AUGUR, not on its own.`;
  if (!release.service) return 'The app runner installs apps with a service. A frontend-only app isn’t supported yet.';
  return versionProblem(release.manifest) ?? surfaceProblem(release.manifest) ?? settingsProblem(release.manifest);
};

export interface AppRunnerRouteOptions {
  store: AppStore;
  pillars: string[];
  /** Which app or platform service sent this call; undefined when the reply has been sent. */
  serviceOf: (req: FastifyRequest, reply: FastifyReply) => Promise<ServiceIdentity | null | undefined>;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
}

/**
 * The deployment's app runner (part of the updater) installs, upgrades and removes apps that don't
 * ship with AUGUR. Admins ask for that here; the runner asks what's next and says how each step went.
 */
export const appRunnerRoutes =
  ({ store, pillars, serviceOf, record }: AppRunnerRouteOptions) =>
  async (app: FastifyInstance) => {
    /** When the runner last asked what to do; it lives only as long as this process. */
    let runnerSeenAt: string | undefined;

    const admin = (req: FastifyRequest, reply: FastifyReply) => {
      const caller = callerFromHeaders(req.headers);
      if (caller?.roles.includes('admin')) return caller;
      void reply.code(403).send({ error: 'forbidden', message: 'Only an admin can install or remove apps.' });
      return undefined;
    };

    const isRunner = async (req: FastifyRequest, reply: FastifyReply) => {
      const service = await serviceOf(req, reply);
      if (service === undefined) return false;
      if (service?.kind === 'platform' && service.name === RUNNER) return true;
      void reply.code(403).send({ error: 'forbidden', message: 'Only the deployment’s app runner can do this.' });
      return false;
    };

    /** The runner's recent jobs, and when it last asked for work (none means it isn't running). */
    app.get<{ Querystring: { app?: string } }>('/app-runner/jobs', async (req, reply) => {
      if (!admin(req, reply)) return reply;
      return { jobs: await store.appJobs(req.query.app), ...(runnerSeenAt ? { runnerSeenAt } : {}) };
    });

    /**
     * Asks the runner to install a release (a first install, an upgrade or going back to an older
     * one) or to remove an app's containers. Needs an admin who entered their password in the last
     * few minutes: it puts code on the server.
     */
    app.post<{ Body: { action: 'install'; release: AppRelease } | { action: 'remove'; app: string } }>(
      '/app-runner/jobs',
      {
        schema: {
          body: {
            oneOf: [
              { type: 'object', additionalProperties: false, required: ['action', 'release'], properties: { action: { const: 'install' }, release: appReleaseSchema } },
              { type: 'object', additionalProperties: false, required: ['action', 'app'], properties: { action: { const: 'remove' }, app: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' } } },
            ],
          },
        },
      },
      async (req, reply) => {
        const caller = admin(req, reply);
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to install or remove an app. It’s asked for anything this drastic.' });
        }
        const body = req.body;
        const target = body.action === 'install' ? body.release.id : body.app;
        if (body.action === 'install') {
          const problem = releaseProblem(body.release, pillars);
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        } else if (pillars.includes(target)) {
          return reply.code(409).send({ error: 'conflict', message: `${target} ships with AUGUR and can’t be removed. Turn it off instead.` });
        }
        const job = { id: randomUUID(), app: target, action: body.action, ...(body.action === 'install' ? { release: body.release } : {}), requestedBy: caller.id };
        if (!(await store.requestAppJob(job))) return reply.code(409).send({ error: 'conflict', message: `Something is already waiting or under way for ${target}.` });
        req.log.info({ by: caller.id, app: target, action: body.action }, 'app job requested');
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: body.action === 'install' ? 'app.install-requested' : 'app.uninstall-requested',
          target,
          detail: body.action === 'install' ? { version: body.release.version, channel: body.release.channel, signer: `${body.release.signer.repository}/${body.release.signer.workflow}` } : {},
        });
        return reply.code(202).send((await store.appJobs(target))[0]);
      },
    );

    /** Takes back a job the runner hasn't started. One under way finishes, or leaves the old version serving. */
    app.delete<{ Params: { id: string } }>('/app-runner/jobs/:id', async (req, reply) => {
      const caller = admin(req, reply);
      if (!caller) return reply;
      const job = (await store.appJobs()).find((j) => j.id === req.params.id);
      if (job?.state === 'running') return reply.code(409).send({ error: 'conflict', message: 'It has started, so it finishes by itself.' });
      if (!job || !(await store.cancelAppJob(job.id))) return reply.code(404).send({ error: 'not_found', message: 'No such job is waiting.' });
      await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.job-cancelled', target: job.app, detail: { action: job.action } });
      return reply.code(204).send();
    });

    /** What the runner should do next: the oldest open job, or nothing (204). */
    app.get('/app-runner/next', async (req, reply) => {
      if (!(await isRunner(req, reply))) return reply;
      runnerSeenAt = new Date().toISOString();
      const job = await store.nextAppJob();
      return job ?? reply.code(204).send();
    });

    /** One step of an open job, from the runner; with `outcome`, how it ended. */
    app.post<{ Params: { id: string }; Body: Omit<AppJobStepState, 'at'> & { outcome?: AppJobOutcome } }>(
      '/app-runner/jobs/:id/progress',
      {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['step', 'state'],
            properties: {
              step: { enum: [...APP_JOB_STEPS] },
              state: { enum: ['running', 'done', 'failed'] },
              message: { type: 'string', maxLength: 2000 },
              outcome: { enum: ['done', 'failed'] },
            },
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        const { outcome, message, ...step } = req.body;
        const job = await store.progressAppJob(req.params.id, { ...step, ...(message ? { message } : {}) }, outcome ? { state: outcome, ...(message ? { message } : {}) } : undefined);
        if (!job) return reply.code(404).send({ error: 'not_found', message: 'That job isn’t open.' });
        req.log.info({ job: job.id, app: job.app, step: step.step, state: step.state, outcome }, 'app job progress');
        if (outcome) {
          await record(req, {
            actor: { id: RUNNER, kind: 'service' },
            app: 'registry',
            action: OUTCOME_ACTIONS[job.action][outcome],
            target: job.app,
            detail: { requestedBy: job.requestedBy, ...(job.release ? { version: job.release.version } : {}), ...(message ? { message } : {}) },
          });
        }
        return job;
      },
    );
  };
