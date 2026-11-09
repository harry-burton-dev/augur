import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import semver from 'semver';
import { callerFromHeaders, signedInRecently, type NewAuditEntry, type ServiceIdentity } from '@augur/service-kit';
import { changesIn } from './changes.ts';
import { LiveOverrides } from './live.ts';
import { PRODUCTION_ONLY, takesPreview, type Ring } from './ring.ts';
import { automaticProblem, defaultDesiredState, windowAt } from './desired-state.ts';
import { AppUpdateChecker, isDevBuild, newestOn, onChannel, previewPr, previewsIn, refusedIn, updateNeeds, type AppFeedRelease } from './app-updates.ts';
import { feedHeld } from './updates.ts';
import { checkRelease, contractMessage } from './release-check.ts';
import { isRelease2 } from '@augur/app-tools/release2';
import { AppInstalls, AppJob as AppJobSchema, AppJobStep, JobRequest, Preview } from './app-runner-schemas.ts';
import { empty, orNull, ref, refused } from './schemas.ts';
import type { AppFollow, AppJob, AppJobOutcome, AppRelease, AppStore, InternetAllowed, RunningPreview } from './store.ts';
import { isCidr, releaseAddressProblem, upstreamProblem } from './upstreams.ts';
import { releaseFileFetch, TooLarge, type ReleaseFetch } from './release-fetch.ts';
import { ReviewSchema, reviewOf } from './apps3.ts';
import { DEPLOYMENT_ADMIN, needsDeploymentAdmin } from './roles.ts';
import { sameRepository } from './feed-trust.ts';
import { asText, declaredSettings, KEEP_REMOVED_MS, missingMessage, missingRequired, settingValueProblem, settingsView, SettingValueBody, type DeclaredSetting } from './settings.ts';


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

/**
 * Why a server on `ring` doesn't install a release; undefined when it does. A production server takes only
 * releases promoted to production. `listed` is the channel the feed gives it: promoting a release changes
 * only that label, so it's the word that counts. For a release the feed doesn't list, its version says, and
 * the file's own channel can only narrow what it may do.
 */
export const ringProblem = (release: AppRelease, ring: Ring, listed?: AppFeedRelease['channel']): string | undefined => {
  if (takesPreview(ring)) return undefined;
  if (isDevBuild(release.version)) return DEV_BUILDS_PREVIEW_ONLY;
  const promoted = listed ? listed === 'stable' : semver.prerelease(release.version) === null && release.channel === 'stable';
  return promoted ? undefined : PRODUCTION_ONLY;
};

/** How many of an app's jobs its history in Admin → Apps lists. */
const APP_HISTORY_LISTED = 20;
/** How many pull requests' previews one app runs at once. */
export const MAX_PREVIEWS = 3;
/** How long a preview runs after its pull request's last build. */
export const PREVIEW_MS = 7 * 24 * 60 * 60 * 1000;
/** A network as the runner says it: an IPv4 or IPv6 address and a prefix length. */
const CIDR = '^(?:\\d{1,3}(?:\\.\\d{1,3}){3}/\\d{1,2}|[0-9a-fA-F:]+/\\d{1,3})$';
/** How many networks the runner may say: one per app and a few of AUGUR's own. */
const MAX_OWN_NETWORKS = 512;

/** The most developers one app has. */
const MAX_DEVELOPERS = 50;

/**
 * What Admin → Apps shows of a version that asks for the internet (augur-outbound): what its parts say they
 * fetch and from where, and whether an admin allowed it. Nothing for a version that doesn't ask.
 */
const internetOf = (release: AppRelease, allowed: InternetAllowed | undefined) => {
  if (!isRelease2(release)) return {};
  const asks = release.parts.flatMap((p) => Object.values(p.resources ?? {}).filter((r) => r.type === 'augur-outbound'));
  if (!asks.length) return {};
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);
  return {
    internet: {
      allowed: Boolean(allowed),
      why: [...new Set(asks.flatMap((r) => strings(r.params?.why)))],
      hosts: [...new Set(asks.flatMap((r) => strings(r.params?.hosts)))],
      ...(allowed ? { allowedBy: allowed.allowedBy, allowedAt: allowed.allowedAt } : {}),
    },
  };
};

/** Why a release can't be installed (spec 9.1, 9.2), in plain words; undefined when it can. */
export const releaseProblem = (release: unknown): string | undefined => {
  const { refusals } = checkRelease(release);
  if (refusals.length) return refusals.join(' ');
  const { version } = release as AppRelease;
  if (!semver.valid(version)) return `"${version}" is not a version such as 1.2.0.`;
  return undefined;
};

/** Why a pull request's build can't be previewed beside the installed release; undefined when it can. */
export const previewProblem = (preview: AppRelease, installed: AppRelease): string | undefined => {
  if (previewPr(preview.version) === undefined) return `${preview.version} isn’t a pull request’s build.`;
  // Only the workflow trusted with the app's releases: a preview runs with the app's own sign-in.
  if (!sameRepository(preview.signer.repository, installed.signer.repository)) return `It’s built by ${preview.signer.repository}, not ${installed.signer.repository}.`;
  return releaseProblem(preview);
};

export interface AppRunnerRouteOptions {
  store: AppStore;
  /** Who loads which app from their own machine (Live on the workbench). */
  live?: LiveOverrides;
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
  /** The deployment's time zone (DEPLOYMENT_TIME_ZONE), for records that don't name their own. */
  timeZone?: string;
  now?: () => Date;
  /** Which app or platform service sent this call; undefined when the reply has been sent. */
  serviceOf: (req: FastifyRequest, reply: FastifyReply) => Promise<ServiceIdentity | null | undefined>;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
  /** How a release file an admin pastes the address of is read; by default over https, every address its name gives checked first. */
  releaseFetch?: ReleaseFetch;
  /** Where this deployment is (PLATFORM_URL), whose host is never read from as a pasted address. */
  platformUrl?: string;
}

/** The largest release file the registry reads from a pasted address. */
const RELEASE_FILE_BYTES = 1024 * 1024;
/** How long reading one may take. */
const RELEASE_FILE_MS = 10_000;
/** The `schema` every release file names, of any version. */
const RELEASE_SCHEMA = /^augur\.app-release\/v\d+$/;

/**
 * The deployment's app runner (part of the updater) installs, upgrades and removes apps that don't
 * ship with AUGUR. Admins ask for that here; the runner asks what's next and says how each step went.
 */
export const appRunnerRoutes =
  ({ store, updates, ring = 'preview', allowPrPreviews = true, sdkVersion, audit, serviceOf, record, live = new LiveOverrides(ring), timeZone = 'UTC', now = () => new Date(), releaseFetch = releaseFileFetch({ bytes: RELEASE_FILE_BYTES, ms: RELEASE_FILE_MS }), platformUrl }: AppRunnerRouteOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    /** When the runner last asked what to do; it lives only as long as this process. */
    let runnerSeenAt: string | undefined;
    /** When automatic updates were last looked for on a runner's poll. */
    let lastAutoAt = 0;
    const AUTO_EVERY_MS = 60_000;

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
      // A refused or expired feed stays on show, but nothing installs by itself from what it held.
      if (feedHeld(updates.result, now())) return;
      const [installed, follows, states] = await Promise.all([store.installedApps(), store.follows(), store.desiredStates()]);
      for (const { app: id, release: current } of installed) {
        const follow = followOf(follows, id);
        if (follow.policy !== 'automatic') continue;
        // The app's desired state (ADR 0020): how far Automatic goes, its pin, and when it may start.
        const stored = states.find((s) => s.unit === id);
        const state = { ...defaultDesiredState(id, ring, timeZone), ...stored, ...follow, timeZone: stored?.timeZone ?? timeZone };
        if (!windowAt(state, now()).open) continue;
        // The newest release Automatic reaches: inside the pin, and no bigger a step than it takes.
        const reached = updates.result.releases.filter((r) => r.app === id && semver.gt(r.version, current.version) && !automaticProblem(state, current.version, r.version));
        const newest = newestOn(reached, id, follow.channel);
        // An app still on a contract 2 release takes nothing by itself: it needs a contract 3 one installed (spec 11.6).
        if (!isRelease2(current) || !newest?.release || updateNeeds(current, newest.release).length) continue;
        if (releaseProblem(newest.release)) continue;
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
      // As for updates: nothing starts by itself from a refused or expired feed.
      if (feedHeld(updates.result, now())) return;
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
          if (previewProblem(build.release!, current)) continue;
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

    /**
     * An installed app's settings as Admin → Apps' form shows them: the version it runs declares, and the
     * required ones a newer version adds with no default, which an admin fills in before that version installs.
     */
    const settingsOf = (release: AppRelease, newer: AppRelease | undefined, values: Awaited<ReturnType<AppStore['settingValues']>>) => {
      if (!isRelease2(release)) return {};
      const own = declaredSettings(release.manifest);
      const added = newer && isRelease2(newer) ? missingRequired(declaredSettings(newer.manifest), (id) => own.some((s) => s.id === id)) : [];
      const view = [...settingsView(own, values), ...settingsView(added, values).map((s) => ({ ...s, newIn: newer!.version }))];
      return view.length ? { settings: view } : {};
    };

    /**
     * The settings an app may be given values for: those its open install job's release declares, then the
     * release it runs, then the feed's releases of it, newest first (the first to declare an id says what it is).
     */
    const declaredFor = async (app: string) => {
      const pending = (await store.appJobs(app)).find((j) => j.pr === undefined && j.action === 'install' && (j.state === 'requested' || j.state === 'running'))?.release;
      const running = (await store.installedApps()).find((i) => i.app === app)?.release;
      const listed = updates.result.releases
        .filter((r) => r.app === app && r.release)
        .sort((a, b) => semver.rcompare(a.version, b.version))
        .map((r) => r.release!);
      const releases = [pending, running, ...listed].filter((r): r is AppRelease => Boolean(r) && isRelease2(r));
      const byId = new Map<string, DeclaredSetting>();
      for (const r of releases) for (const d of declaredSettings(r.manifest)) if (!byId.has(d.id)) byId.set(d.id, d);
      return { known: releases.length > 0, name: releases[0]?.manifest.name ?? app, declared: [...byId.values()], installed: Boolean(running) };
    };

    /** Admin → Apps' view of installs: what's installed and how it follows updates, and what the feed offers. */
    const appsView = async () => {
      const [installed, follows, jobs, running, developers, internet, values] = await Promise.all([
        store.installedApps(),
        store.follows(),
        store.appJobs(),
        store.runningPreviews(),
        store.developers(),
        store.internetAllowed(),
        store.settingValues(),
      ]);
      const { checkedAt, problem, releases } = updates.result;
      const installedIds = new Set(installed.map((i) => i.app));
      const latestJob = (id: string) => jobs.find((j) => j.app === id && j.pr === undefined);
      return {
        feed: updates.on ? ('on' as const) : ('off' as const),
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
              ? { update: { version: newest.version, channel: newest.channel, ...(newest.notesUrl ? { notesUrl: newest.notesUrl } : {}), needs: isRelease2(release) ? updateNeeds(release, newest.release) : [contractMessage(2)], ...(releaseProblem(newest.release) ? {} : { review: reviewOf(newest.release) }), changes: changesIn(newest.release.notes ?? '', id) } }
              : {}),
            ...(job ? { job } : {}),
            ...internetOf(release, internet.find((x) => x.app === id)),
            ...settingsOf(release, newest?.release && semver.gt(newest.version, release.version) ? newest.release : undefined, values.filter((v) => v.app === id && !v.removedAt)),
            changes: changesIn(release.notes ?? '', id),
            // Earlier versions to go back to, newest first.
            older: releases
              .filter((r) => r.app === id && r.release && onChannel(takesPreview(ring) ? 'beta' : 'stable', r.channel) && semver.lt(r.version, release.version))
              .sort((a, b) => semver.rcompare(a.version, b.version))
              .slice(0, 3)
              .map((r) => ({ version: r.version, channel: r.channel as 'stable' | 'beta' })),
            history: jobs.filter((j) => j.app === id && j.pr === undefined).slice(0, APP_HISTORY_LISTED).map(historyOf),
            developers: developers.filter((d) => d.app === id).map((d) => d.person),
            previews: running.filter((p) => p.app === id).map(previewView),
          };
        }),
        available: [...new Set(releases.map((r) => r.app))]
          .filter((id) => !installedIds.has(id))
          .map((id) => newestOn(releases, id, 'stable') ?? (takesPreview(ring) ? newestOn(releases, id, 'beta') : undefined) ?? refusedIn(releases, id, takesPreview(ring) ? 'beta' : 'stable'))
          .filter((r): r is NonNullable<typeof r> => Boolean(r?.release || r?.refused))
          .map((r) =>
            !r.release
              ? // Listed in a feed, but its file can't install here (a contract 2 one): shown to say why, with nothing to agree to.
                { app: r.app, name: r.name ?? r.app, version: r.version, channel: r.channel as 'stable' | 'beta', ...(r.feed ? { feed: r.feed } : {}), ...(r.notesUrl ? { notesUrl: r.notesUrl } : {}), problem: r.refused! }
              : {
            app: r.app,
            name: r.release!.manifest.name,
            ...(typeof r.release!.manifest.description === 'string' ? { description: r.release!.manifest.description } : {}),
            version: r.version,
            // Only stable or beta: newestOn and onChannel above never offer dev or preview here.
            channel: r.channel as 'stable' | 'beta',
            ...(r.notesUrl ? { notesUrl: r.notesUrl } : {}),
            signer: r.release!.signer,
            asks: r.release!.asks,
            ...(releaseProblem(r.release) ? {} : { review: reviewOf(r.release!) }),
            ...(r.feed ? { feed: r.feed } : {}),
            ...(releaseProblem(r.release) ? { problem: releaseProblem(r.release)! } : {}),
            ...(latestJob(r.app) ? { job: latestJob(r.app) } : {}),
          }),
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
    const installs = (description: string) => ({ ...ref(AppInstalls), description });
    const signInAgain = refused('sign_in_again: enter the password again first');
    const notDeploymentAdmin = refused('Not a deployment admin (the refusal names the requiredRole)');
    const runnerUnreachable = refused("The sign-in service can't be reached to check the app runner's token");
    const appParams = Type.Object({ id: Type.String() });

    app.put(
      '/app-runner/apps/:id/developers',
      {
        schema: {
          summary: "Set who may try an installed app's pull requests' previews (deployment admins only)",
          description: [
            `People's ids, at most ${MAX_DEVELOPERS}. Previews run only for apps with developers; one taken off loses`,
            'their choice of its previews. Needs a deployment admin who entered their password in the last',
            '10 minutes, or it answers 401 sign_in_again. Audited as app.developers-set.',
          ].join(' '),
          params: appParams,
          body: Type.Object(
            { people: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), { maxItems: MAX_DEVELOPERS, uniqueItems: true }) },
            { additionalProperties: false },
          ),
          response: {
            200: installs("Admin → Apps' installs"),
            401: signInAgain,
            403: notDeploymentAdmin,
            404: refused("The app runner hasn't installed that app"),
          },
        },
      },
      async (req, reply) => {
        // The same record as the desired state (ADR 0020), so the same gate (ADR 0022): a deployment admin who signed in just now.
        const caller = deploymentAdmin(req, reply, 'change how an app takes new releases');
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to change how an app takes new releases. It’s asked for anything this drastic.' });
        }
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
    app.get(
      '/previews',
      {
        schema: {
          summary: "The previews the caller may try, of the apps they're a developer of",
          description: [
            "Each pull request's newest build runs beside the app on the deployment, for a week after",
            'its last build or until the pull request closes. `chosen` is the pull request whose',
            'preview the caller uses instead of the app, if any.',
          ].join(' '),
          response: {
            200: Type.Object(
              {
                apps: Type.Array(
                  Type.Object({
                    app: Type.String(),
                    name: Type.String(),
                    version: Type.String({ description: 'The installed version' }),
                    chosen: Type.Optional(Type.Integer()),
                    previews: Type.Array(ref(Preview)),
                    live: Type.Optional(Type.String({ description: "Live on the workbench: the entry on the caller's own machine the shell loads instead of the app" })),
                    liveProblem: Type.Optional(
                      Type.String({ description: "Why the app can't be loaded from the caller's machine here (only the workbench, SERVER_RING=dev, does)" }),
                    ),
                  }),
                ),
              },
              { description: "The caller's apps and their previews" },
            ),
            401: refused('Not signed in'),
          },
        },
      },
      async (req, reply) => {
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
      },
    );

    /** Uses one of an app's running previews instead of the app, for the caller alone; `null` goes back to the app. */
    app.put(
      '/previews/:id',
      {
        schema: {
          summary: "Use one of an app's previews instead of the app, for the caller alone",
          description: [
            "The shell is given the preview's manifest, and the gateway sends the caller's calls to the",
            'app to the preview, until they choose `null` (back to the app) or the preview goes.',
          ].join(' '),
          params: appParams,
          body: Type.Object({ pr: orNull(Type.Integer({ minimum: 1 })) }, { additionalProperties: false }),
          response: {
            204: empty('Chosen'),
            401: refused('Not signed in'),
            403: refused("Not one of the app's developers"),
            404: refused('No preview of that pull request is running'),
          },
        },
      },
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
    app.put(
      '/previews/:id/live',
      {
        schema: {
          summary: "Load an app's frontend from the caller's own machine, for them alone (Live on the workbench)",
          description: [
            'Only on the workbench (SERVER_RING=dev), whose front door lets the shell load scripts from *.ts.net.',
            "The shell is given `url` as the app's entry for the caller until they send `null` or the registry",
            "restarts. The app's service stays the installed one.",
          ].join(' '),
          params: appParams,
          body: Type.Object(
            {
              url: orNull(Type.String({ maxLength: 2048, description: 'https://<machine>.ts.net/…/entry.ts, as pnpm dev:app <id> --live prints it' })),
            },
            { additionalProperties: false },
          ),
          response: {
            204: empty('Loading it from there, or stopped'),
            400: refused('Not an app entry on a machine on the tailnet'),
            401: refused('Not signed in'),
            403: refused("Not one of the app's developers"),
            409: refused("This server isn't the workbench"),
          },
        },
      },
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

    app.get(
      '/app-runner/apps',
      {
        schema: {
          summary: 'Installed apps and how each takes updates, and what the app feed offers (admins only)',
          response: { 200: installs("Admin → Apps' installs"), 403: refused('Not an admin') },
        },
      },
      async (req, reply) => {
        if (!admin(req, reply)) return reply;
        return appsView();
      },
    );

    /** Checks the app feed now (and starts any automatic updates it finds), rather than waiting for the next check. */
    app.post(
      '/app-runner/check',
      {
        schema: {
          summary: 'Check the app feed now, starting any automatic updates it finds (admins only)',
          response: { 200: installs("Admin → Apps' installs after the check"), 403: refused('Not an admin') },
        },
      },
      async (req, reply) => {
        if (!admin(req, reply)) return reply;
        await updates.check();
        return appsView();
      },
    );

    /** How an installed app takes new releases: its channel, and Automatic, Ask first or Hold. */
    app.put(
      '/app-runner/apps/:id/follow',
      {
        schema: {
          summary: 'Set how an installed app takes new releases (deployment admins only)',
          description: [
            'Its channel, and its policy: automatic (a newer release on the channel that asks for nothing',
            'new installs by itself), ask (each waits for an admin) or hold (nothing is offered). An app',
            'with no choice yet follows stable, automatically. A production server (SERVER_RING=production)',
            'follows stable only, and refuses beta or dev with 409. dev (dev builds too) is for a preview server.',
            'Needs a deployment admin who entered their password in the last 10 minutes, or it answers 401',
            'sign_in_again. Audited as app.updates-set.',
          ].join(' '),
          params: appParams,
          body: Type.Object({ channel: Type.Enum(['stable', 'beta', 'dev']), policy: Type.Enum(['automatic', 'ask', 'hold']) }, { additionalProperties: false }),
          response: {
            200: installs("Admin → Apps' installs"),
            401: signInAgain,
            403: notDeploymentAdmin,
            404: refused("The app runner hasn't installed that app"),
            409: refused('This is a production server: it follows stable releases only (error production_server)'),
          },
        },
      },
      async (req, reply) => {
        // The same record as the desired state (ADR 0020), so the same gate (ADR 0022): a deployment admin who signed in just now.
        const caller = deploymentAdmin(req, reply, 'change how an app takes new releases');
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to change how an app takes new releases. It’s asked for anything this drastic.' });
        }
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

    /** Changing what runs (a version, or how new ones are taken) is the deployment admin's (ADR 0022). */
    const deploymentAdmin = (req: FastifyRequest, reply: FastifyReply, doing: string) => {
      const caller = callerFromHeaders(req.headers);
      if (caller?.roles.includes(DEPLOYMENT_ADMIN)) return caller;
      void reply.code(403).send(needsDeploymentAdmin(doing));
      return undefined;
    };

    /** Lets an installed app that asks for it reach the internet, or takes that away (spec 4.6, 10.4). */
    app.put(
      '/app-runner/apps/:id/internet',
      {
        schema: {
          summary: 'Let an installed app reach the internet, or take that away (deployment admins only)',
          description: [
            'Only its parts that ask for augur-outbound reach it, and any host on it: the hosts they name are',
            'what they say they need, not a limit; never a preview. The app runner joins them to it, or takes',
            'them off it, within a minute. Removing the app from the server takes it away. Needs a deployment',
            'admin who entered their password in the last 10 minutes,',
            'or it answers 401 sign_in_again. Audited as app.internet-set.',
          ].join(' '),
          params: appParams,
          body: Type.Object({ allowed: Type.Boolean() }, { additionalProperties: false }),
          response: {
            200: installs("Admin → Apps' installs"),
            401: signInAgain,
            403: notDeploymentAdmin,
            404: refused("The app runner hasn't installed that app"),
            409: refused("The version it runs doesn't ask for the internet"),
          },
        },
      },
      async (req, reply) => {
        const caller = deploymentAdmin(req, reply, 'let an app reach the internet');
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to change what an app can reach. It’s asked for anything this drastic.' });
        }
        const { id } = req.params;
        const installed = (await store.installedApps()).find((i) => i.app === id);
        if (!installed) return reply.code(404).send({ error: 'not_found', message: `${id} isn’t installed by the app runner.` });
        if (req.body.allowed && !internetOf(installed.release, undefined).internet) {
          return reply.code(409).send({ error: 'conflict', message: `${installed.release.manifest.name} ${installed.release.version} doesn’t ask for the internet: none of its parts asks for augur-outbound.` });
        }
        await store.setInternet(id, req.body.allowed ? caller.id : null);
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.internet-set', target: id, detail: { allowed: req.body.allowed } });
        return appsView();
      },
    );

    /** The apps the runner gives the internet: those a deployment admin allowed (the runner only). */
    app.get(
      '/runner/internet',
      {
        schema: {
          summary: 'The apps a deployment admin let reach the internet (the deployment’s app runner only)',
          response: { 200: Type.Object({ apps: Type.Array(Type.String()) }), 403: refused('Not the app runner'), 503: runnerUnreachable },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        return { apps: (await store.internetAllowed()).map((a) => a.app) };
      },
    );

    /** Gives one of an app's own settings (contract 3) a value, or with null puts it back to its default (spec 5.2 to 5.4). */
    app.put(
      '/app-runner/apps/:id/settings/:setting',
      {
        schema: {
          summary: "Set one of an app's own settings, or put it back to its default (deployment admins only)",
          description: [
            'The value is of the setting’s own type: text, a number within its bounds, true or false, or one of its options.',
            'A secret’s value is never shown again, only that it was set; giving it needs a deployment admin who entered',
            'their password in the last 10 minutes, or it answers 401 sign_in_again. The runner hands the value to the parts',
            'that read it and starts them again. Audited as app.setting-set (never with a secret’s value).',
          ].join(' '),
          params: Type.Object({ id: Type.String(), setting: Type.String() }),
          body: Type.Object({ value: SettingValueBody }, { additionalProperties: false }),
          response: {
            200: installs("Admin → Apps' installs"),
            400: refused('Not a value the setting takes: the message names its bounds or options'),
            401: signInAgain,
            403: notDeploymentAdmin,
            404: refused('Neither installed nor in the feed, or no version of it has that setting'),
            409: refused('A required setting with no default can’t go back to nothing'),
          },
        },
      },
      async (req, reply) => {
        const caller = deploymentAdmin(req, reply, 'change an app’s settings');
        if (!caller) return reply;
        const { id, setting: settingId } = req.params;
        const { known, name, declared } = await declaredFor(id);
        if (!known) return reply.code(404).send({ error: 'not_found', message: `${id} is neither installed nor in the app feed.` });
        const setting = declared.find((s) => s.id === settingId);
        if (!setting) return reply.code(404).send({ error: 'not_found', message: `${name} has no setting ${settingId}.` });
        const { value } = req.body;
        if (setting.type === 'secret' && value !== null && !signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: `Enter your password again to give ${name} its ${setting.label}. It’s asked for any secret.` });
        }
        if (value === null) {
          if (missingRequired([setting], () => false).length) return reply.code(409).send({ error: 'conflict', message: `${name} needs its ${setting.label}, so it can’t go back to nothing: give it another value instead.` });
        } else {
          const problem = settingValueProblem(setting, value);
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        }
        await store.setSettingValue(id, setting.id, value === null ? null : asText(value), setting.type === 'secret', caller.id);
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: 'app.setting-set',
          target: id,
          detail: { setting: setting.id, ...(value === null ? { cleared: true } : setting.type === 'secret' ? {} : { value }) },
        });
        return appsView();
      },
    );

    /**
     * The values the runner hands apps' parts (augur-settings): for each app installed or being installed, those
     * an admin gave the settings its releases declare, secrets with them. Values its release stopped declaring more
     * than 30 days ago are forgotten here.
     */
    app.get(
      '/runner/settings',
      {
        schema: {
          summary: "The values admins gave apps' settings, secrets included (the deployment's app runner only)",
          response: {
            200: Type.Object(
              { apps: Type.Record(Type.String(), Type.Record(Type.String(), Type.String()), { description: 'By app id, then setting id: the value as text' }) },
              { description: 'The values' },
            ),
            403: refused('Not the app runner'),
            503: runnerUnreachable,
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        const dropped = await store.dropRemovedSettings(new Date(now().getTime() - KEEP_REMOVED_MS));
        if (dropped) req.log.info({ dropped }, 'forgot settings no release declares any more');
        const values = await store.settingValues();
        const apps: Record<string, Record<string, string>> = {};
        for (const v of values) (apps[v.app] ??= {})[v.setting] = v.value;
        return { apps };
      },
    );

    const isRunner = async (req: FastifyRequest, reply: FastifyReply) => {
      const service = await serviceOf(req, reply);
      if (service === undefined) return false;
      if (service?.kind === 'platform' && service.name === RUNNER) return true;
      void reply.code(403).send({ error: 'forbidden', message: 'Only the deployment’s app runner can do this.' });
      return false;
    };

    /**
     * The deployment's own networks, from the runner at start (spec 9.8): the registry refuses an app's address
     * on one of them, since that is where AUGUR's own parts run.
     */
    app.put(
      '/runner/networks',
      {
        schema: {
          summary: "Say the deployment's own networks (the deployment's app runner only)",
          description: "CIDRs such as 172.18.0.0/16 or fd00:a::/64, replacing those said before. No app's address may be on one of them.",
          body: Type.Object(
            { networks: Type.Array(Type.String({ pattern: CIDR, maxLength: 50 }), { maxItems: MAX_OWN_NETWORKS }) },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object({ networks: Type.Array(Type.String()), setAt: Type.String({ format: 'date-time' }) }, { description: 'As kept' }),
            400: refused("One isn't a network that parses"),
            403: refused('Not the app runner'),
            503: runnerUnreachable,
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        const bad = req.body.networks.filter((n) => !isCidr(n));
        if (bad.length) return reply.code(400).send({ error: 'bad_request', message: `${bad.join(', ')} ${bad.length === 1 ? 'isn’t a network' : 'aren’t networks'} such as 172.18.0.0/16 or fd00:a::/64.` });
        const kept = await store.setOwnNetworks([...new Set(req.body.networks)]);
        req.log.info({ networks: kept.networks }, 'the deployment’s own networks set');
        return kept;
      },
    );

    /** The runner's recent jobs, and when it last asked for work (none means it isn't running). */
    app.get(
      '/app-runner/jobs',
      {
        schema: {
          summary: "The app runner's recent jobs, newest first (admins only)",
          querystring: Type.Object({ app: Type.Optional(Type.String({ description: "Only this app's" })) }),
          response: {
            200: Type.Object(
              { jobs: Type.Array(ref(AppJobSchema)), runnerSeenAt: Type.Optional(Type.String({ format: 'date-time' })) },
              { description: "Up to 50 jobs, and when the runner last asked for work (missing when it hasn't since the registry started)" },
            ),
            403: refused('Not an admin'),
          },
        },
      },
      async (req, reply) => {
        if (!admin(req, reply)) return reply;
        return { jobs: await store.appJobs(req.query.app), ...(runnerSeenAt ? { runnerSeenAt } : {}) };
      },
    );

    /**
     * Asks the runner to install a release (a first install, an upgrade or going back to an older
     * one) or to remove an app's containers. Needs an admin who entered their password in the last
     * few minutes: it puts code on the server.
     */
    app.post(
      '/app-runner/jobs',
      {
        schema: {
          summary: 'Ask the app runner to install a release or remove an app (deployment admins only)',
          description: [
            'Installing covers a first install, an upgrade and going back to an older version alike;',
            'going back to an older version holds an app on Automatic there. A release its publisher',
            "halted is refused (ADR 0018), and so is a pull request's build, or on a production server a dev",
            'build or any release not promoted to production: the feed says which, or failing that its',
            'version. Needs a deployment admin who entered their password in the last 10 minutes, or it',
            'answers 401 sign_in_again. Apps that ship with AUGUR are refused. Audited as',
            'app.install-requested or app.uninstall-requested.',
          ].join(' '),
          body: JobRequest,
          response: {
            202: { ...ref(AppJobSchema), description: 'Waiting for the runner' },
            400: refused("The release can't be installed: not by digest, id or version unlike its manifest's, no service, a pull request's build, one this server's ring doesn't take, or a bad manifest"),
            401: signInAgain,
            403: notDeploymentAdmin,
            404: refused('The app feed has no release file for that app and version'),
            409: refused('Its publisher halted that release, or it already has a job waiting or under way'),
          },
        },
      },
      async (req, reply) => {
        const caller = deploymentAdmin(req, reply, req.body.action === 'remove' ? 'remove an app from the server' : 'install an app or change its version');
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to install or remove an app. It’s asked for anything this drastic.' });
        }
        const body = req.body;
        let release: AppRelease | undefined;
        if (body.action === 'install') {
          release = 'release' in body ? body.release : updates.result.releases.find((r) => r.app === body.app && r.version === body.version)?.release;
          if (!release) return reply.code(404).send({ error: 'not_found', message: `The app feed has no release file for ${'app' in body ? `${body.app} ${body.version}` : 'it'}. Check for updates, then try again.` });
          // A release its publisher halted is never installed (ADR 0018), whichever way it's asked for.
          const halted = updates.result.releases.find((r) => r.app === release!.id && r.version === release!.version)?.halted;
          if (halted) return reply.code(409).send({ error: 'conflict', message: `${release.id} ${release.version} was halted by its publisher: ${halted.reason}` });
        }
        const target = release ? release.id : (body as { app: string }).app;
        if (release) {
          const listed = updates.result.releases.find((r) => r.app === release!.id && r.version === release!.version)?.channel;
          // What the file is comes first: one on contract 2 is refused for that alone (spec 11.6).
          const problem =
            releaseProblem(release) ??
            (previewPr(release.version) !== undefined ? 'That’s a pull request’s build: it runs as a preview beside the app, for its developers.' : ringProblem(release, ring, listed));
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
        }
        // Its settings (spec 5.3): each value given must be one its setting takes, and a required one with no default
        // needs a value, given here or by an admin before, or the install is refused now rather than failing on the server.
        const given = 'settings' in body ? (body.settings ?? {}) : {};
        if (release && isRelease2(release)) {
          const declared = declaredSettings(release.manifest);
          for (const [settingId, value] of Object.entries(given)) {
            const setting = declared.find((s) => s.id === settingId);
            if (!setting) return reply.code(400).send({ error: 'bad_request', message: `${release.manifest.name} ${release.version} has no setting ${settingId}.` });
            const problem = settingValueProblem(setting, value);
            if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
          }
          const kept = await store.settingValues(target);
          const missing = missingRequired(declared, (settingId) => settingId in given || kept.some((v) => v.setting === settingId));
          if (missing.length) return reply.code(400).send({ error: 'bad_request', message: missingMessage(release.manifest.name, missing) });
        } else if (Object.keys(given).length) return reply.code(400).send({ error: 'bad_request', message: 'Only an app on contract 3 takes settings with its install.' });
        const job = { id: randomUUID(), app: target, action: body.action, ...(release ? { release } : {}), requestedBy: caller.id };
        if (!(await store.requestAppJob(job))) return reply.code(409).send({ error: 'conflict', message: `Something is already waiting or under way for ${target}.` });
        if (release && isRelease2(release)) {
          for (const [settingId, value] of Object.entries(given)) {
            const setting = declaredSettings(release.manifest).find((s) => s.id === settingId)!;
            await store.setSettingValue(target, settingId, asText(value), setting.type === 'secret', caller.id);
          }
        }
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
          detail: release ? { version: release.version, channel: release.channel, signer: `${release.signer.repository}/${release.signer.workflow}`, ...(Object.keys(given).length ? { settings: Object.keys(given) } : {}) } : {},
        });
        return reply.code(202).send((await store.appJobs(target))[0]);
      },
    );

    /**
     * Reads a release file from an address an admin pasted, for one no feed lists (spec 9.4), and says what it
     * asks for and why it can't install, if it can't. Nothing is kept: installing it is asking for a job with
     * the file, as for any other, and the runner still checks every image's signature against APP_PUBLISHERS.
     */
    app.post(
      '/app-runner/releases/read',
      {
        schema: {
          summary: 'Read a release file from a pasted address, to review before installing (deployment admins only)',
          description: [
            'Fetches an https address (never AUGUR itself, this machine or the deployment’s own networks, by every address its name resolves to), at most 1 MB,',
            'in 10 seconds, and checks the file as the feed’s are checked (spec 9.1 to 9.3). The file comes back with its',
            'asks and signer for the review, and its refusals and warnings; install it with POST /app-runner/jobs.',
          ].join(' '),
          body: Type.Object({ url: Type.String({ minLength: 1, maxLength: 2000, description: 'The release file’s address' }) }, { additionalProperties: false }),
          response: {
            200: Type.Object(
              {
                release: Type.Unsafe<Record<string, unknown>>({ type: 'object', additionalProperties: true, description: 'The release file as read' }),
                refusals: Type.Array(Type.String(), { description: 'Why it can’t install here, in plain words; empty when it can' }),
                warnings: Type.Array(Type.String(), { description: 'What an admin is told, but doesn’t stop it' }),
                asks: Type.Optional(Type.Unsafe<Record<string, unknown>>({ type: 'object', additionalProperties: true, description: 'What it asks an admin to agree to (spec 9.4)' })),
                signer: Type.Optional(Type.Object({ repository: Type.String(), workflow: Type.String() })),
                review: Type.Optional(ReviewSchema),
              },
              { description: 'The file, checked' },
            ),
            400: refused('Not an https address it reads from, or nothing there is a release file'),
            401: signInAgain,
            403: notDeploymentAdmin,
          },
        },
      },
      async (req, reply) => {
        const caller = deploymentAdmin(req, reply, 'read a release file to install');
        if (!caller) return reply;
        if (!signedInRecently(caller, INSTALL_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to install an app. It’s asked for anything this drastic.' });
        }
        const { url } = req.body;
        const own = await store.ownNetworks();
        const where = releaseAddressProblem(url, own, platformUrl);
        if (where) return reply.code(400).send({ error: 'bad_request', message: where });
        const cannot = (why: string) => reply.code(400).send({ error: 'bad_request', message: `${url} couldn’t be read: ${why}.` });
        const tooLarge = 'it is larger than a release file can be (1 MB)';
        let text: string;
        try {
          // No redirect is followed: one could lead anywhere the checks refuse.
          const res = await releaseFetch(url, own);
          if (res.status >= 300 && res.status < 400) return cannot(`it sends the registry on to ${res.headers.get('location') ?? 'another address'}. Paste that address instead`);
          if (!res.ok) return cannot(`it answered ${res.status}`);
          if (Number(res.headers.get('content-length') ?? 0) > RELEASE_FILE_BYTES) return cannot(tooLarge);
          text = await res.text();
          if (Buffer.byteLength(text) > RELEASE_FILE_BYTES) return cannot(tooLarge);
        } catch (err) {
          const e = err as Error;
          return cannot(e instanceof TooLarge ? tooLarge : e.name === 'TimeoutError' ? 'it took longer than 10 seconds' : /this machine or one of this deployment/.test(e.message) ? e.message : 'it couldn’t be reached');
        }
        let file: unknown;
        try {
          file = JSON.parse(text);
        } catch {
          return reply.code(400).send({ error: 'bad_request', message: `${url} isn’t a release file: it isn’t JSON.` });
        }
        // Only a release file comes back, so the route reads nothing else for anyone.
        if (!file || typeof file !== 'object' || Array.isArray(file) || !RELEASE_SCHEMA.test(String((file as { schema?: unknown }).schema))) {
          return reply.code(400).send({ error: 'bad_request', message: `${url} isn’t a release file.` });
        }
        const { refusals, warnings } = checkRelease(file);
        req.log.info({ by: caller.id, url, refused: refusals.length }, 'release file read from a pasted address');
        const r = file as Partial<AppRelease>;
        return {
          release: file as Record<string, unknown>,
          refusals,
          warnings,
          ...(isRelease2(file) ? { asks: r.asks as unknown as Record<string, unknown> } : {}),
          ...(isRelease2(file) && r.signer ? { signer: r.signer } : {}),
          ...(isRelease2(file) && refusals.length === 0 ? { review: reviewOf(file) } : {}),
        };
      },
    );

    /** Takes back a job the runner hasn't started. One under way finishes, or leaves the old version serving. */
    app.delete(
      '/app-runner/jobs/:id',
      {
        schema: {
          summary: "Take back a job the runner hasn't started (admins only)",
          description: 'Audited as app.job-cancelled.',
          params: appParams,
          response: {
            204: empty('Cancelled'),
            403: refused('Not an admin'),
            404: refused('No such job is waiting'),
            409: refused('It has started; it finishes by itself'),
          },
        },
      },
      async (req, reply) => {
        const caller = admin(req, reply);
        if (!caller) return reply;
        const job = (await store.appJobs()).find((j) => j.id === req.params.id);
        if (job?.state === 'running') return reply.code(409).send({ error: 'conflict', message: 'It has started, so it finishes by itself.' });
        if (!job || !(await store.cancelAppJob(job.id))) return reply.code(404).send({ error: 'not_found', message: 'No such job is waiting.' });
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.job-cancelled', target: job.app, detail: { action: job.action } });
        return reply.code(204).send();
      },
    );

    /** What the runner should do next: the oldest open job, or nothing (204). */
    app.get(
      '/app-runner/next',
      {
        schema: {
          summary: "The oldest open job (the deployment's app runner only)",
          description: 'Signed in as the updater client (platform-updater). Each call counts as the runner being seen, and looks for automatic updates whose window has opened, at most once a minute.',
          response: {
            200: { ...ref(AppJobSchema), description: 'The job' },
            204: empty('Nothing to do'),
            403: refused('Not the app runner'),
            503: runnerUnreachable,
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        runnerSeenAt = new Date().toISOString();
        // A window may have opened since the last check: look again, at most once a minute.
        if (now().getTime() - lastAutoAt >= AUTO_EVERY_MS) {
          lastAutoAt = now().getTime();
          await autoUpdate().catch((err) => req.log.warn({ err }, 'automatic app updates failed'));
        }
        const job = await store.nextAppJob();
        return job ?? reply.code(204).send();
      },
    );

    /** One step of an open job, from the runner; with `outcome`, how it ended. */
    app.post(
      '/app-runner/jobs/:id/progress',
      {
        schema: {
          summary: "Report a step of an open job (the deployment's app runner only)",
          description: [
            'The first report starts it. With `outcome` it ends, audited as app.installed,',
            'app.install-failed, app.uninstalled, app.uninstall-failed, app.preview-started,',
            'app.preview-failed, app.preview-removed or app.preview-remove-failed. A preview',
            'that started ends with `upstream`, where it answers.',
          ].join(' '),
          params: appParams,
          body: Type.Object(
            {
              step: ref(AppJobStep),
              state: Type.Enum(['running', 'done', 'failed']),
              message: Type.Optional(Type.String({ maxLength: 2000 })),
              outcome: Type.Optional(Type.Enum(['done', 'failed'])),
              // Where a preview it started answers.
              upstream: Type.Optional(
                Type.String({ maxLength: 300, description: "With a preview's outcome: where it answers, such as http://app-notes-pr12:8080" }),
              ),
            },
            { additionalProperties: false },
          ),
          response: {
            200: { ...ref(AppJobSchema), description: 'The job as it stands' },
            400: refused("`upstream` isn't an address a preview's service can be at"),
            403: refused('Not the app runner'),
            404: refused("The job isn't open"),
            503: runnerUnreachable,
          },
        },
      },
      async (req, reply) => {
        if (!(await isRunner(req, reply))) return reply;
        const { outcome, message, upstream, ...step } = req.body;
        const problem = upstream === undefined ? undefined : upstreamProblem(upstream, await store.ownNetworks());
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
        // Installed, the values of settings its release no longer declares are kept 30 days from now, in case it comes back (spec 5.5).
        if (outcome === 'done' && job.action === 'install' && job.release && isRelease2(job.release)) {
          await store.keepDeclaredSettings(job.app, declaredSettings(job.release.manifest).map((d) => d.id));
        }
        // Removed from the server, it gives up the internet: installed again, an admin decides again (spec 10.4).
        if (outcome === 'done' && job.action === 'remove' && (await store.internetAllowed()).some((a) => a.app === job.app)) {
          await store.setInternet(job.app, null);
          await record(req, { actor: { id: RUNNER, kind: 'service' }, app: 'registry', action: 'app.internet-set', target: job.app, detail: { allowed: false, because: 'removed from the server' } });
        }
        return job;
      },
    );
  };
