import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import semver from 'semver';
import { callerFromHeaders, signedInRecently, type NewAuditEntry, type ServiceIdentity } from '@augur/service-kit';
import { changesIn } from './changes.ts';
import { LiveOverrides } from './live.ts';
import { PRODUCTION_ONLY, takesPreview, type Ring } from './ring.ts';
import { AppUpdateChecker, isDevBuild, newestOn, onChannel, previewPr, previewsIn, updateNeeds, type AppChannel, type AppPolicy } from './app-updates.ts';
import { appEntrySchema, settingsProblem, surfaceProblem, versionProblem } from './manifest.ts';
import { APP_JOB_STEPS, type AppFollow, type AppJob, type AppJobOutcome, type AppJobStepState, type AppRelease, type AppStore, type RunningPreview } from './store.ts';
import { upstreamProblem } from './upstreams.ts';

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
    channel: { enum: ['stable', 'beta', 'dev', 'preview'] },
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
    // A pull request's build: which one, and where to read it.
    preview: {
      type: 'object',
      additionalProperties: false,
      required: ['pr'],
      properties: { pr: { type: 'integer', minimum: 1 }, title: { type: 'string', maxLength: 300 }, url: { type: 'string', maxLength: 300 } },
    },
  },
} as const;

/** How recently an admin must have entered their password to install code on the server. */
const INSTALL_SIGN_IN_MS = 10 * 60 * 1000;
/** The platform service that runs apps' containers (its Keycloak client is platform-updater). */
const RUNNER = 'updater';
const OUTCOME_ACTIONS: Record<AppJob['action'], Record<AppJobOutcome, string>> = {
  install: { done: 'app.installed', failed: 'app.install-failed' },
  remove: { done: 'app.uninstalled', failed: 'app.uninstall-failed' },
  preview: { done: 'app.preview-started', failed: 'app.preview-failed' },
  'preview-remove': { done: 'app.preview-removed', failed: 'app.preview-remove-failed' },
};

/** Why a production server doesn't install a dev build. */
export const DEV_BUILDS_PREVIEW_ONLY = 'That’s a dev build. Only a dev or preview server (SERVER_RING=dev or preview) installs dev builds.';

/** How many of an app's jobs its history in Admin → Apps lists. */
const APP_HISTORY_LISTED = 20;
/** How many pull requests' previews one app runs at once. */
export const MAX_PREVIEWS = 3;
/** How long a preview runs after its pull request's last build. */
export const PREVIEW_MS = 7 * 24 * 60 * 60 * 1000;
/** The most developers one app has. */
const MAX_DEVELOPERS = 50;

/** Why a release can't be installed, beyond its shape; undefined when it can. */
export const releaseProblem = (release: AppRelease, pillars: string[]): string | undefined => {
  if (release.id !== release.manifest.id || release.version !== release.manifest.version) return 'The release file’s id and version must be its manifest’s.';
  if (!semver.valid(release.version)) return `"${release.version}" is not a version such as 1.2.0.`;
  if (pillars.includes(release.id)) return `${release.manifest.name} ships with AUGUR, so it’s upgraded with AUGUR, not on its own.`;
  if (!release.service) return 'The app runner installs apps with a service. A frontend-only app isn’t supported yet.';
  return versionProblem(release.manifest) ?? surfaceProblem(release.manifest) ?? settingsProblem(release.manifest);
};

/** Why a pull request's build can't be previewed beside the installed release; undefined when it can. */
export const previewProblem = (preview: AppRelease, installed: AppRelease, pillars: string[]): string | undefined => {
  if (previewPr(preview.version) === undefined) return `${preview.version} isn’t a pull request’s build.`;
  // Only the workflow trusted with the app's releases: a preview runs with the app's own sign-in.
  if (preview.signer.repository !== installed.signer.repository) return `It’s built by ${preview.signer.repository}, not ${installed.signer.repository}.`;
  return releaseProblem(preview, pillars);
};

export interface AppRunnerRouteOptions {
  store: AppStore;
  /** Who loads which app from their own machine (Live on the workbench). */
  live?: LiveOverrides;
  pillars: string[];
  /** The app feed: releases admins can install, and newer ones for what's installed. */
  updates: AppUpdateChecker;
  /** What kind of server this is: a production one follows stable releases only. */
  ring?: Ring;
  /** Whether pull requests' builds run beside apps for their developers. */
  allowPrPreviews?: boolean;
  /** The SDK this AUGUR's shell speaks, which a release's `sdk` range must cover to install by itself. */
  sdkVersion: string;
  /** Records what happens without a request, such as an update starting by itself. */
  audit?: (entry: NewAuditEntry) => Promise<void>;
  now?: () => Date;
  /** Which app or platform service sent this call; undefined when the reply has been sent. */
  serviceOf: (req: FastifyRequest, reply: FastifyReply) => Promise<ServiceIdentity | null | undefined>;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
}

/**
 * The deployment's app runner (part of the updater) installs, upgrades and removes apps that don't
 * ship with AUGUR. Admins ask for that here; the runner asks what's next and says how each step went.
 */
export const appRunnerRoutes =
  ({ store, pillars, updates, ring = 'preview', allowPrPreviews = true, sdkVersion, audit, serviceOf, record, live = new LiveOverrides(ring), now = () => new Date() }: AppRunnerRouteOptions) =>
  async (app: FastifyInstance) => {
    /** When the runner last asked what to do; it lives only as long as this process. */
    let runnerSeenAt: string | undefined;

    /** How an app follows releases: by default stable on Automatic. A production server never follows beta or dev, whatever was chosen before. */
    const followOf = (follows: AppFollow[], id: string): Pick<AppFollow, 'channel' | 'policy'> => {
      const { channel, policy } = follows.find((f) => f.app === id) ?? { channel: 'stable' as const, policy: 'automatic' as const };
      return { channel: takesPreview(ring) ? channel : 'stable', policy };
    };

    /**
     * After each check of the feed: every installed app on Automatic whose channel has a newer release
     * that asks for nothing new gets an install job, unless that release already failed to install.
     */
    const autoUpdate = async () => {
      const [installed, follows] = await Promise.all([store.installedApps(), store.follows()]);
      for (const { app: id, release: current } of installed) {
        const follow = followOf(follows, id);
        if (follow.policy !== 'automatic') continue;
        const newest = newestOn(updates.result.releases, id, follow.channel);
        if (!newest?.release || !semver.gt(newest.version, current.version) || updateNeeds(current, newest.release, sdkVersion).length) continue;
        if (releaseProblem(newest.release, pillars)) continue;
        const jobs = await store.appJobs(id);
        if (jobs.some((j) => j.pr === undefined && j.release?.version === newest.version && j.state === 'failed')) continue;
        if (!(await store.requestAppJob({ id: randomUUID(), app: id, action: 'install', release: newest.release, requestedBy: 'automatic' }))) continue;
        await audit?.({ actor: { id: 'registry', kind: 'service' }, app: 'registry', action: 'app.install-requested', target: id, detail: { version: newest.version, from: current.version, automatic: true } }).catch(() => undefined);
      }
    };

    const byRegistry = (action: string, target: string, detail: Record<string, unknown>) =>
      audit?.({ actor: { id: 'registry', kind: 'service' }, app: 'registry', action, target, detail }).catch(() => undefined);

    /**
     * After each check of the feed, previews follow the pull requests: an installed app with developers
     * gets each open pull request's newest build running beside it (at most MAX_PREVIEWS, a build tried
     * once), and a preview is taken away when its pull request is closed (its builds leave the feed),
     * a week after its last build, or once the app isn't installed.
     */
    const syncPreviews = async () => {
      const [installed, running, developers] = await Promise.all([store.installedApps(), store.runningPreviews(), store.developers()]);
      const { releases } = updates.result;
      const at = now().getTime();
      const remove = async (p: RunningPreview, why: string) => {
        if (await store.requestAppJob({ id: randomUUID(), app: p.app, action: 'preview-remove', pr: p.pr, requestedBy: 'automatic' })) await byRegistry('app.preview-remove-requested', p.app, { pr: p.pr, why });
      };
      for (const p of running) {
        const open = previewsIn(releases, p.app).some((r) => r.pr === p.pr);
        if (!installed.some((i) => i.app === p.app)) await remove(p, 'The app isn’t installed.');
        else if (!open) await remove(p, 'Its pull request is closed.');
        else if (Date.parse(p.startedAt) + PREVIEW_MS <= at) await remove(p, 'Its last build is a week old.');
      }
      for (const { app: id, release: current } of installed) {
        if (!allowPrPreviews || !developers.some((d) => d.app === id)) continue;
        const jobs = await store.appJobs(id);
        const busy = (pr: number) => jobs.some((j) => j.pr === pr && (j.state === 'requested' || j.state === 'running'));
        const starting = jobs.filter((j) => j.action === 'preview' && (j.state === 'requested' || j.state === 'running'));
        const live = new Set([...running.filter((p) => p.app === id).map((p) => p.pr), ...starting.map((j) => j.pr!)]);
        for (const build of previewsIn(releases, id)) {
          const pr = build.pr!;
          if (busy(pr) || jobs.some((j) => j.pr === pr && j.release?.version === build.version)) continue;
          if (build.released && Date.parse(build.released) + PREVIEW_MS <= at) continue;
          if (!live.has(pr) && live.size >= MAX_PREVIEWS) continue;
          if (previewProblem(build.release!, current, pillars)) continue;
          if (!(await store.requestAppJob({ id: randomUUID(), app: id, action: 'preview', release: build.release, pr, requestedBy: 'automatic' }))) continue;
          live.add(pr);
          await byRegistry('app.preview-requested', id, { pr, version: build.version });
        }
      }
    };
    updates.onChecked(async () => {
      await autoUpdate();
      await syncPreviews();
    });

    /** Admin → Apps' view of installs: what's installed and how it follows updates, and what the feed offers. */
    const appsView = async () => {
      const [installed, follows, jobs, running, developers] = await Promise.all([store.installedApps(), store.follows(), store.appJobs(), store.runningPreviews(), store.developers()]);
      const { checkedAt, problem, releases } = updates.result;
      const installedIds = new Set(installed.map((i) => i.app));
      const latestJob = (id: string) => jobs.find((j) => j.app === id && j.pr === undefined);
      return {
        feed: updates.on ? 'on' : 'off',
        ...(checkedAt ? { checkedAt } : {}),
        ...(problem ? { problem } : {}),
        ...(runnerSeenAt ? { runnerSeenAt } : {}),
        sdkVersion,
        ring,
        previewsAllowed: allowPrPreviews,
        ...(takesPreview(ring) ? {} : { channelNote: PRODUCTION_ONLY }),
        installed: installed.map(({ app: id, release, installedAt }) => {
          const follow = followOf(follows, id);
          const newest = newestOn(releases, id, follow.channel);
          const job = latestJob(id);
          return {
            app: id,
            name: release.manifest.name,
            version: release.version,
            installedAt,
            ...follow,
            ...(newest?.release && semver.gt(newest.version, release.version)
              ? { update: { version: newest.version, channel: newest.channel, ...(newest.notesUrl ? { notesUrl: newest.notesUrl } : {}), needs: updateNeeds(release, newest.release, sdkVersion), changes: changesIn(newest.release.notes ?? '', id) } }
              : {}),
            ...(job ? { job } : {}),
            changes: changesIn(release.notes ?? '', id),
            // Earlier versions to go back to, newest first.
            older: releases
              .filter((r) => r.app === id && r.release?.service && onChannel(takesPreview(ring) ? 'beta' : 'stable', r.channel) && semver.lt(r.version, release.version))
              .sort((a, b) => semver.rcompare(a.version, b.version))
              .slice(0, 3)
              .map((r) => ({ version: r.version, channel: r.channel })),
            history: jobs.filter((j) => j.app === id && j.pr === undefined).slice(0, APP_HISTORY_LISTED).map(historyOf),
            developers: developers.filter((d) => d.app === id).map((d) => d.person),
            previews: running.filter((p) => p.app === id).map(previewView),
          };
        }),
        available: [...new Set(releases.map((r) => r.app))]
          .filter((id) => !installedIds.has(id) && !pillars.includes(id))
          .map((id) => newestOn(releases, id, 'stable') ?? (takesPreview(ring) ? newestOn(releases, id, 'beta') : undefined))
          .filter((r): r is NonNullable<typeof r> => Boolean(r?.release?.service))
          .map((r) => ({
            app: r.app,
            name: r.release!.manifest.name,
            ...(r.release!.manifest.description ? { description: r.release!.manifest.description } : {}),
            version: r.version,
            channel: r.channel,
            ...(r.notesUrl ? { notesUrl: r.notesUrl } : {}),
            signer: r.release!.signer,
            asks: { scopes: r.release!.manifest.scopes ?? [], storage: r.release!.manifest.storage ?? {}, maxUpload: r.release!.manifest.maxUpload ?? 10 },
            ...(semver.satisfies(sdkVersion, r.release!.manifest.sdk, { includePrerelease: true }) ? {} : { problem: `It needs SDK ${r.release!.manifest.sdk}, and this AUGUR has ${sdkVersion}.` }),
            ...(latestJob(r.app) ? { job: latestJob(r.app) } : {}),
          })),
      };
    };

    /** A job as an app's history shows it: what was asked, from and to, by whom, and how it ended. */
    const historyOf = (j: AppJob) => ({
      id: j.id,
      action: j.action,
      ...(j.release ? { version: j.release.version } : {}),
      requestedBy: j.requestedBy,
      requestedAt: j.requestedAt,
      state: j.state,
      ...(j.message ? { message: j.message } : {}),
      ...(j.finishedAt ? { finishedAt: j.finishedAt } : {}),
    });

    /** A running preview as people are shown it. */
    const previewView = (p: RunningPreview) => ({
      pr: p.pr,
      version: p.release.version,
      ...(p.release.preview?.title ? { title: p.release.preview.title } : {}),
      ...(p.release.preview?.url ? { url: p.release.preview.url } : {}),
      startedAt: p.startedAt,
      endsAt: new Date(Date.parse(p.startedAt) + PREVIEW_MS).toISOString(),
    });

    /** Who may try an app's pull requests' previews: people's ids. Previews run only for apps with someone to try them. */
    app.put<{ Params: { id: string }; Body: { people: string[] } }>(
      '/app-runner/apps/:id/developers',
      {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['people'],
            properties: { people: { type: 'array', maxItems: MAX_DEVELOPERS, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 100 } } },
          },
        },
      },
      async (req, reply) => {
        const caller = admin(req, reply);
        if (!caller) return reply;
        if (!(await store.installedApps()).some((i) => i.app === req.params.id)) return reply.code(404).send({ error: 'not_found', message: `${req.params.id} isn’t installed by the app runner.` });
        const before = (await store.developers(req.params.id)).map((d) => d.person);
        const after = (await store.setDevelopers(req.params.id, req.body.people, caller.id)).map((d) => d.person);
        const added = after.filter((p) => !before.includes(p));
        const removed = before.filter((p) => !after.includes(p));
        if (added.length || removed.length) await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.developers-set', target: req.params.id, detail: { added, removed } });
        await syncPreviews();
        return appsView();
      },
    );

    /** The previews the caller may try: of the apps they're a developer of, with the one they chose of each. */
    app.get('/previews', async (req, reply) => {
      const caller = callerFromHeaders(req.headers);
      if (!caller) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to see previews.' });
      const [mine, running, choices, installed] = await Promise.all([store.developers(), store.runningPreviews(), store.previewChoices(caller.id), store.installedApps()]);
      const apps = new Set(mine.filter((d) => d.person === caller.id).map((d) => d.app));
      return {
        apps: installed
          .filter((i) => apps.has(i.app))
          .map((i) => {
            const chosen = choices.find((c) => c.app === i.app)?.pr;
            const previews = running.filter((p) => p.app === i.app);
            const from = live.of(caller.id, i.app);
            return {
              app: i.app,
              name: i.release.manifest.name,
              version: i.release.version,
              ...(chosen !== undefined && previews.some((p) => p.pr === chosen) ? { chosen } : {}),
              previews: previews.map(previewView),
              // Live on the workbench: loading it from the developer's own machine, or why it can't here.
              ...(from ? { live: from } : {}),
              ...(live.problem ? { liveProblem: live.problem } : {}),
            };
          }),
      };
    });

    /** Uses one of an app's running previews instead of the app, for the caller alone; `null` goes back to the app. */
    app.put<{ Params: { id: string }; Body: { pr: number | null } }>(
      '/previews/:id',
      { schema: { body: { type: 'object', additionalProperties: false, required: ['pr'], properties: { pr: { type: ['integer', 'null'], minimum: 1 } } } } },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to try a preview.' });
        const { id } = req.params;
        if (!(await store.developers(id)).some((d) => d.person === caller.id)) return reply.code(403).send({ error: 'forbidden', message: `Only ${id}’s developers can try its previews. An admin adds them in Admin → Apps.` });
        const { pr } = req.body;
        if (pr !== null && !(await store.runningPreviews()).some((p) => p.app === id && p.pr === pr)) return reply.code(404).send({ error: 'not_found', message: `No preview of pull request ${pr} is running.` });
        await store.choosePreview(caller.id, id, pr);
        req.log.info({ by: caller.id, app: id, pr }, pr === null ? 'preview left' : 'preview chosen');
        return reply.code(204).send();
      },
    );

    /** Loads an app's frontend from the caller's own machine instead of the app, for them alone, on the workbench; `null` stops. */
    app.put<{ Params: { id: string }; Body: { url: string | null } }>(
      '/previews/:id/live',
      { schema: { body: { type: 'object', additionalProperties: false, required: ['url'], properties: { url: { type: ['string', 'null'], maxLength: 2048 } } } } },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to load an app from your machine.' });
        const { id } = req.params;
        if (live.problem) return reply.code(409).send({ error: 'conflict', message: live.problem });
        if (!(await store.developers(id)).some((d) => d.person === caller.id)) return reply.code(403).send({ error: 'forbidden', message: `Only ${id}’s developers can load it from their machine. An admin adds them in Admin → Apps.` });
        const { url } = req.body;
        const problem = url === null ? undefined : live.urlProblem(url);
        if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        live.set(caller.id, id, url);
        req.log.info({ by: caller.id, app: id, url }, url === null ? 'live stopped' : 'live started');
        return reply.code(204).send();
      },
    );

    app.get('/app-runner/apps', async (req, reply) => {
      if (!admin(req, reply)) return reply;
      return appsView();
    });

    /** Checks the app feed now (and starts any automatic updates it finds), rather than waiting for the next check. */
    app.post('/app-runner/check', async (req, reply) => {
      if (!admin(req, reply)) return reply;
      await updates.check();
      return appsView();
    });

    /** How an installed app takes new releases: its channel, and Automatic, Ask first or Hold. */
    app.put<{ Params: { id: string }; Body: { channel: AppChannel; policy: AppPolicy } }>(
      '/app-runner/apps/:id/follow',
      { schema: { body: { type: 'object', additionalProperties: false, required: ['channel', 'policy'], properties: { channel: { enum: ['stable', 'beta', 'dev'] }, policy: { enum: ['automatic', 'ask', 'hold'] } } } } },
      async (req, reply) => {
        const caller = admin(req, reply);
        if (!caller) return reply;
        if (!(await store.installedApps()).some((i) => i.app === req.params.id)) return reply.code(404).send({ error: 'not_found', message: `${req.params.id} isn’t installed by the app runner.` });
        if (req.body.channel !== 'stable' && !takesPreview(ring)) return reply.code(409).send({ error: 'production_server', message: PRODUCTION_ONLY });
        await store.setFollow({ app: req.params.id, ...req.body, setBy: caller.id });
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.updates-set', target: req.params.id, detail: { ...req.body } });
        await autoUpdate();
        return appsView();
      },
    );

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
    app.post<{ Body: { action: 'install'; release: AppRelease } | { action: 'install'; app: string; version: string } | { action: 'remove'; app: string } }>(
      '/app-runner/jobs',
      {
        schema: {
          body: {
            oneOf: [
              { type: 'object', additionalProperties: false, required: ['action', 'release'], properties: { action: { const: 'install' }, release: appReleaseSchema } },
              // A release from the app feed, by version.
              {
                type: 'object',
                additionalProperties: false,
                required: ['action', 'app', 'version'],
                properties: { action: { const: 'install' }, app: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' }, version: { type: 'string', minLength: 1, maxLength: 40 } },
              },
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
        let release: AppRelease | undefined;
        if (body.action === 'install') {
          release = 'release' in body ? body.release : updates.result.releases.find((r) => r.app === body.app && r.version === body.version)?.release;
          if (!release) return reply.code(404).send({ error: 'not_found', message: `The app feed has no release file for ${'app' in body ? `${body.app} ${body.version}` : 'it'}. Check for updates, then try again.` });
        }
        const target = release ? release.id : (body as { app: string }).app;
        if (release) {
          const problem =
            previewPr(release.version) !== undefined
              ? 'That’s a pull request’s build: it runs as a preview beside the app, for its developers.'
              : isDevBuild(release.version) && !takesPreview(ring)
                ? DEV_BUILDS_PREVIEW_ONLY
                : releaseProblem(release, pillars);
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        } else if (pillars.includes(target)) {
          return reply.code(409).send({ error: 'conflict', message: `${target} ships with AUGUR and can’t be removed. Turn it off instead.` });
        }
        const job = { id: randomUUID(), app: target, action: body.action, ...(release ? { release } : {}), requestedBy: caller.id };
        if (!(await store.requestAppJob(job))) return reply.code(409).send({ error: 'conflict', message: `Something is already waiting or under way for ${target}.` });
        // Going back to an older version: held there, or Automatic would take it straight up again.
        const current = release && (await store.installedApps()).find((i) => i.app === target)?.release;
        if (release && current && semver.lt(release.version, current.version)) {
          const follow = followOf(await store.follows(), target);
          if (follow.policy === 'automatic') {
            await store.setFollow({ app: target, channel: follow.channel, policy: 'hold', setBy: caller.id });
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.updates-set', target, detail: { channel: follow.channel, policy: 'hold', why: `going back to ${release.version}` } });
          }
        }
        req.log.info({ by: caller.id, app: target, action: body.action }, 'app job requested');
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: release ? 'app.install-requested' : 'app.uninstall-requested',
          target,
          detail: release ? { version: release.version, channel: release.channel, signer: `${release.signer.repository}/${release.signer.workflow}` } : {},
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
    app.post<{ Params: { id: string }; Body: Omit<AppJobStepState, 'at'> & { outcome?: AppJobOutcome; upstream?: string } }>(
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
              // Where a preview it started answers.
              upstream: { type: 'string', maxLength: 300 },
            },
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        const { outcome, message, upstream, ...step } = req.body;
        const problem = upstream === undefined ? undefined : upstreamProblem(upstream);
        if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        const job = await store.progressAppJob(
          req.params.id,
          { ...step, ...(message ? { message } : {}) },
          outcome ? { state: outcome, ...(message ? { message } : {}), ...(upstream && outcome === 'done' ? { upstream: upstream.replace(/\/+$/, '') } : {}) } : undefined,
        );
        if (!job) return reply.code(404).send({ error: 'not_found', message: 'That job isn’t open.' });
        req.log.info({ job: job.id, app: job.app, step: step.step, state: step.state, outcome }, 'app job progress');
        if (outcome) {
          await record(req, {
            actor: { id: RUNNER, kind: 'service' },
            app: 'registry',
            action: OUTCOME_ACTIONS[job.action][outcome],
            target: job.app,
            detail: { requestedBy: job.requestedBy, ...(job.pr !== undefined ? { pr: job.pr } : {}), ...(job.release ? { version: job.release.version } : {}), ...(message ? { message } : {}) },
          });
        }
        return job;
      },
    );
  };
