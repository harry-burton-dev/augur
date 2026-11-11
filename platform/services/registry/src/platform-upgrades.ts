import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, signedInRecently, type NewAuditEntry, type ServiceIdentity } from '@augur/service-kit';
import semver from 'semver';
import { randomUUID } from 'node:crypto';
import { empty, ref, refused } from './schemas.ts';
import { AfterWatch, PlatformUpdates, strings, Upgrade as UpgradeSchema, UpgradeStep } from './update-schemas.ts';
import { AUGUR_UNIT, resolvedState } from './desired-state.ts';
import { lineView, type PipelineReader } from './pipeline.ts';
import { automaticDevUpgrade, automaticUpgrade, goBackTargets, historyEntry, trustSetting, type UpdateChecker, updatesView } from './updates.ts';
import { afterLook, lookDue, MIN_CALLS as AFTER_MIN_CALLS, startAfterWatch } from './after-watch.ts';
import { HALTED_PRODUCTION_ONLY, takesHaltedOnRequest } from './ring.ts';
import type { AppStore, Upgrade, UpgradeOutcome } from './store.ts';
import { needsDeploymentAdmin, roleChecks, type RoleChecks } from './roles.ts';

/** How recently an admin must have entered their password to start an upgrade. */
export const UPGRADE_SIGN_IN_MS = 10 * 60 * 1000;

/** A finished upgrade stays on the Updates page this long. */
const UPGRADE_SHOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** The platform service that applies upgrades on a Compose deployment (its Keycloak client is platform-updater). */
const UPDATER = 'updater';

/** Why an upgrade ended before it started: the settings entered for it went with a restart. */
export const settingsLostMessage = (names: string[]) =>
  `The settings entered for this upgrade (${names.join(', ')}) were lost when the registry restarted before the updater took them. Nothing was changed: ask for the upgrade again and enter them again.`;

const OUTCOME_ACTIONS: Record<UpgradeOutcome, string> = { done: 'platform.upgraded', 'rolled-back': 'platform.upgrade-rolled-back', failed: 'platform.upgrade-failed' };

export interface PlatformUpgradeOptions {
  store: AppStore;
  updates: UpdateChecker;
  pipeline?: PipelineReader;
  portalUrl?: string;
  timeZone: string;
  now: () => Date;
  /** Who is calling as a service: null for a person, undefined when the reply has been sent. */
  serviceOf: (req: FastifyRequest, reply: FastifyReply) => Promise<ServiceIdentity | null | undefined>;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
  /** Today's admin roles, each check compared with the permissions service (shadow mode). */
  roles?: RoleChecks;
}

/**
 * AUGUR's own upgrades (ADRs 0020, 0051): what's out, starting, going back and cancelling an
 * upgrade, and the updater's side of it. This is update control, kept out of the app catalogue's
 * routes so it can move to a service of its own (ADR 0067). It never reads the catalogue's code,
 * only the store.
 */
export const platformUpgradeRoutes =
  ({ store, updates, pipeline, portalUrl, timeZone, now, serviceOf, record, roles = roleChecks() }: PlatformUpgradeOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const isAdmin = (req: FastifyRequest, site: string) => roles.admin(site, callerFromHeaders(req.headers), 'admin');

    /**
     * Whether a newer AUGUR release is out, and what upgrading to it needs first. Read-only: the
     * registry never restarts anything; the deployment's updater (or a person) does.
     */
    app.get(
      '/platform/updates',
      {
        schema: {
          summary: 'Whether a newer AUGUR release is out, and what upgrading to it needs first (admins only)',
          description: [
            "From the registry's last check of the release feed: this repository's GitHub releases",
            "(augur@<version>, pre-releases are beta) or RELEASE_FEED_URL, a mirror's list of release files.",
            'The registry checks once a day. Read-only: nothing is restarted or changed.',
          ].join(' '),
          response: {
            200: { ...ref(PlatformUpdates), description: 'The running release against the feed' },
            403: refused('Not an admin'),
          },
        },
      },
      async (req, reply) => {
        if (!(await isAdmin(req, 'registry.upgrades.out'))) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see what updates are out.' });
        return updatesPage();
      },
    );

    /** Checks the release feed now rather than waiting for the daily check. */
    app.post(
      '/platform/updates/check',
      {
        schema: {
          summary: 'Check the release feed now (admins only)',
          description: 'A check within 30 seconds of the last good one answers from it. Audited as platform.updates-checked.',
          response: {
            200: { ...ref(PlatformUpdates), description: "The running release against the feed, as just checked. A feed that can't be read is a `problem`, not an error." },
            403: refused('Not an admin'),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller || !(await roles.admin('registry.upgrades.check', caller, 'admin'))) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can check for updates.' });
        await updates.check();
        const view = await updatesPage();
        req.log.info({ by: caller.id, available: view.available?.version, problem: view.problem }, 'updates checked');
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: 'platform.updates-checked',
          target: view.running.version,
          detail: { ...(view.available ? { available: view.available.version } : {}), ...(view.problem ? { problem: view.problem } : {}) },
        });
        return view;
      },
    );

    /** When the deployment's updater last asked what to do; it lives only as long as this process. */
    let updaterSeenAt: string | undefined;
    /** Settings an admin entered for the upgrade they asked for, until it ends. */
    let upgradeSettings: { id: string; settings: Record<string, string> } | undefined;

    /** The Updates page: the feed against the running release, and the upgrade asked for, while it matters. */
    const updatesPage = async () => {
      const view = updatesView({ checker: updates, apps: await store.records() });
      const [upgrade, history] = await Promise.all([store.upgrade(), store.upgrades()]);
      const shown = upgrade && (!upgrade.finishedAt || Date.now() - Date.parse(upgrade.finishedAt) < UPGRADE_SHOWN_MS);
      // The line: what this server runs of each unit, on the pipeline from dev to production.
      const installed = await store.installedApps();
      const running = { augur: view.running.version, ...Object.fromEntries(installed.map((a) => [a.app, a.release.version])) };
      const line = lineView(await pipeline?.current(), running);
      return {
        ...view,
        ...(shown ? { upgrade } : {}),
        ...(updaterSeenAt ? { updaterSeenAt } : {}),
        history: history.map(historyEntry),
        line,
        ...(portalUrl ? { portalUrl } : {}),
        // Whether a deployment admin may install a halted release here, to test going back (ADR 0051).
        haltedInstall: takesHaltedOnRequest(updates.ring) ? { allowed: true } : { allowed: false, why: HALTED_PRODUCTION_ONLY },
      };
    };

    /**
     * Asks the deployment's updater to move to `version`, which must be the release Updates says
     * is next. Needs an admin who entered their password in the last few minutes. Nothing
     * restarts here: the updater picks it up and reports each step.
     */
    app.put(
      '/platform/upgrade',
      {
        schema: {
          summary: "Ask the deployment's updater to upgrade AUGUR (deployment admins only)",
          description: [
            '`version` must be the `next` release Updates shows. Needs a deployment admin (ADR 0022) who entered their',
            'password in the last 10 minutes (x-user-signed-in-at), or it answers 401 sign_in_again.',
            'Only records the ask: the updater picks it up from /platform/upgrade/target. Audited as',
            'platform.upgrade-requested. `settings` are new settings for `.env`, each one the upgrade adds,',
            'never one that says what the server trusts (SERVER_RING and the like: set those in `.env`):',
            "they're kept in memory for the updater until the upgrade ends, never stored, and only",
            'their names are stored and audited. If the registry restarts before the updater takes them,',
            'the upgrade ends failed and says to ask again. An empty value is left out.',
          ].join(' '),
          body: Type.Object(
            {
              version: Type.String({ minLength: 1, maxLength: 64 }),
              // New settings for .env, entered on the Updates page: one line each.
              settings: Type.Optional(
                Type.Unsafe<Record<string, string>>({
                  type: 'object',
                  maxProperties: 50,
                  propertyNames: { pattern: '^[A-Z][A-Z0-9_]{0,63}$' },
                  additionalProperties: { type: 'string', maxLength: 4096, pattern: '^[^\\r\\n]*$' },
                  description: 'Setting name to value, one line each',
                }),
              ),
            },
            { additionalProperties: false },
          ),
          response: {
            202: { ...ref(PlatformUpdates), description: 'Waiting for the updater' },
            400: refused("A setting the upgrade doesn't add, one that says what the server trusts, or a value over more than one line"),
            401: refused('sign_in_again: enter the password again first'),
            403: refused('Not a deployment admin (the refusal names the requiredRole)'),
            409: refused('Not the next release, its release file names no images, or an upgrade is already waiting or under way'),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller || !(await roles.deploymentAdmin('registry.upgrades.start', caller, 'can_upgrade'))) return reply.code(403).send(needsDeploymentAdmin('upgrade AUGUR'));
        if (!signedInRecently(caller, UPGRADE_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to upgrade. It’s asked for anything this drastic.' });
        }
        const view = updatesView({ checker: updates, apps: await store.records() });
        if (view.next !== req.body.version) {
          return reply.code(409).send({ error: 'conflict', message: view.next ? `Upgrade to ${view.next} next, not ${req.body.version}.` : `There’s no release to upgrade to from ${view.running.version} right now.` });
        }
        const manifest = updates.result.releases.find((r) => r.version === view.next)?.manifest;
        const images = manifest?.images ?? {};
        if (!Object.keys(images).length) return reply.code(409).send({ error: 'conflict', message: `AUGUR ${view.next}’s release file names no images, so it can’t be applied.` });
        const settings = Object.fromEntries(Object.entries(req.body.settings ?? {}).filter(([, value]) => value !== ''));
        const unknown = Object.keys(settings).filter((key) => key === 'PLATFORM_VERSION' || !manifest?.settings?.all.includes(key));
        if (unknown.length) return reply.code(400).send({ error: 'bad_request', message: `AUGUR ${view.next} has no setting ${unknown.join(', ')}.` });
        // The updater overwrites .env, so this takes only what the upgrade adds, as Updates asks for it, and never what the server trusts.
        const trusted = Object.keys(settings).filter(trustSetting);
        if (trusted.length) return reply.code(400).send({ error: 'bad_request', message: `${trusted.join(', ')} says what this server trusts, so it’s set in .env on the server, not here.` });
        const added = view.needsYou.flatMap((n) => (n.kind === 'setting' ? [n.key] : []));
        const existing = Object.keys(settings).filter((key) => !added.includes(key));
        if (existing.length) return reply.code(400).send({ error: 'bad_request', message: `${existing.join(', ')} isn’t new in AUGUR ${view.next}, so an upgrade doesn’t change it. Change it in .env on the server.` });
        const id = randomUUID();
        if (!(await store.requestUpgrade({ id, from: view.running.version, version: view.next, images, requestedBy: caller.id, requestedByName: caller.name, settingNames: Object.keys(settings) }))) {
          return reply.code(409).send({ error: 'conflict', message: 'An upgrade is already waiting or under way.' });
        }
        // Kept in memory only, for the updater to write to .env: never stored. Only their names are stored and audited.
        upgradeSettings = Object.keys(settings).length ? { id, settings } : undefined;
        req.log.info({ by: caller.id, from: view.running.version, to: view.next, settings: Object.keys(settings) }, 'upgrade requested');
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: 'platform.upgrade-requested',
          target: view.next,
          detail: { from: view.running.version, ...(Object.keys(settings).length ? { settings: Object.keys(settings) } : {}) },
        });
        return reply.code(202).send(await updatesPage());
      },
    );

    /**
     * Installs a release its publisher halted, on request, to prove AUGUR goes back by itself from a
     * broken release (ADR 0051). Only on a dev or preview server, for a deployment admin who entered
     * their password in the last few minutes, naming the exact version and why. Every request, allowed
     * or refused, is audited. The watch then judges it like any other upgrade.
     */
    app.put<{ Body: { version: string; reason: string } }>(
      '/platform/upgrade/halted',
      {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['version', 'reason'],
            properties: {
              version: { type: 'string', minLength: 1, maxLength: 64 },
              reason: { type: 'string', minLength: 10, maxLength: 500, pattern: '^[^\\r\\n]*$' },
            },
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        const { version, reason } = req.body;
        const from = updates.running.version;
        const refuse = async (code: number, body: { error: string; message: string; requiredRole?: string }) => {
          await record(req, { actor: { id: caller?.id ?? 'unknown', kind: 'user' }, app: 'registry', action: 'platform.halted-install-refused', target: version, detail: { from, reason, why: body.message } });
          return reply.code(code).send(body);
        };
        if (!caller || !(await roles.deploymentAdmin('registry.upgrades.halted', caller, 'can_upgrade'))) return refuse(403, needsDeploymentAdmin('install a halted release'));
        if (!signedInRecently(caller, UPGRADE_SIGN_IN_MS)) {
          return refuse(401, { error: 'sign_in_again', message: 'Enter your password again to install a halted release. It’s asked for anything this drastic.' });
        }
        if (!takesHaltedOnRequest(updates.ring)) return refuse(403, { error: 'forbidden', message: HALTED_PRODUCTION_ONLY });
        const target = updates.result.releases.find((r) => r.version === version);
        if (!target?.halted) return refuse(409, { error: 'conflict', message: `AUGUR ${version} isn’t a release its publisher halted. Upgrade to a release that wasn’t halted the usual way.` });
        if (!semver.valid(version) || !semver.valid(from) || !semver.gt(version, from)) {
          return refuse(409, { error: 'conflict', message: `AUGUR ${version} isn’t newer than ${from}, which this server runs, so the watch wouldn’t judge it.` });
        }
        const manifest = target.manifest;
        const images = manifest?.images ?? {};
        if (!manifest || !Object.keys(images).length) return refuse(409, { error: 'conflict', message: `AUGUR ${version}’s release file names no images, so it can’t be applied.` });
        if (!semver.satisfies(from, manifest.upgradeFrom, { includePrerelease: true })) {
          return refuse(409, { error: 'conflict', message: `AUGUR ${version} upgrades only from ${manifest.upgradeFrom}, and this server runs ${from}.` });
        }
        // Going back by itself is the point, and it's unsafe past a breaking release.
        const breaking = updates.result.releases.find((r) => semver.valid(r.version) && semver.gt(r.version, from) && semver.lte(r.version, version) && r.manifest?.breaking.length);
        if (breaking) return refuse(409, { error: 'conflict', message: `AUGUR ${breaking.version} is breaking, so AUGUR couldn’t go back from ${version} by itself. Test going back with a release that isn’t.` });
        const id = randomUUID();
        if (!(await store.requestUpgrade({ id, from, version, images, requestedBy: caller.id, requestedByName: caller.name }))) {
          return refuse(409, { error: 'conflict', message: 'An upgrade is already waiting or under way.' });
        }
        upgradeSettings = undefined;
        req.log.info({ by: caller.id, from, to: version, reason }, 'halted release requested');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.halted-install-requested', target: version, detail: { from, reason, halted: target.halted.reason } });
        return reply.code(202).send(await updatesPage());
      },
    );

    /**
     * Asks the updater to go back to an earlier release: the same steps as an upgrade, a backup first,
     * to a release Updates offers (no breaking release between, so the data stays as it is). Needs an
     * admin who entered their password in the last few minutes.
     */
    app.put(
      '/platform/go-back',
      {
        schema: {
          summary: 'Go back to an earlier AUGUR release (deployment admins who just entered their password)',
          description: [
            'The same steps as an upgrade, a backup first, to one of the releases the Updates page lists',
            'under goBack with no problem: no release between is breaking, so the data stays as it is.',
            "Audited as platform.go-back-requested, and platform.went-back when it's done.",
          ].join(' '),
          body: Type.Object({ version: Type.String({ minLength: 1, maxLength: 64 }) }, { additionalProperties: false }),
          response: {
            202: { ...ref(PlatformUpdates), description: 'Asked; the Updates page as it now stands' },
            401: refused('Enter your password again (error sign_in_again)'),
            403: refused('Not a deployment admin (the refusal names the requiredRole)'),
            409: refused('Not a release it can go back to, with why; or an upgrade is already open'),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller || !(await roles.deploymentAdmin('registry.upgrades.rollback', caller, 'can_upgrade'))) return reply.code(403).send(needsDeploymentAdmin('take AUGUR back to an earlier release'));
        if (!signedInRecently(caller, UPGRADE_SIGN_IN_MS)) {
          return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to go back. It’s asked for anything this drastic.' });
        }
        const target = goBackTargets(updates).find((t) => t.version === req.body.version);
        if (!target) return reply.code(409).send({ error: 'conflict', message: `AUGUR ${req.body.version} isn’t one of the releases this server can go back to.` });
        if (target.problem) return reply.code(409).send({ error: 'conflict', message: target.problem });
        const images = updates.result.releases.find((r) => r.version === target.version)?.manifest?.images ?? {};
        const id = randomUUID();
        if (!(await store.requestUpgrade({ id, from: updates.running.version, version: target.version, images, requestedBy: caller.id, requestedByName: caller.name }))) {
          return reply.code(409).send({ error: 'conflict', message: 'An upgrade is already waiting or under way.' });
        }
        upgradeSettings = undefined;
        req.log.info({ by: caller.id, from: updates.running.version, to: target.version }, 'going back requested');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.go-back-requested', target: target.version, detail: { from: updates.running.version } });
        return reply.code(202).send(await updatesPage());
      },
    );

    /** Takes back an upgrade the updater hasn't started. One under way can't be stopped halfway. */
    app.delete(
      '/platform/upgrade',
      {
        schema: {
          summary: "Take back an upgrade the updater hasn't started (deployment admins only)",
          description: 'Audited as platform.upgrade-cancelled.',
          response: {
            200: { ...ref(PlatformUpdates), description: 'Cancelled' },
            403: refused('Not a deployment admin (the refusal names the requiredRole)'),
            404: refused('No upgrade is waiting'),
            409: refused('It has started; it finishes or rolls back by itself'),
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller || !(await roles.deploymentAdmin('registry.upgrades.cancel', caller, 'can_upgrade'))) return reply.code(403).send(needsDeploymentAdmin('take back an upgrade'));
        const upgrade = await store.upgrade();
        if (upgrade?.state === 'running') return reply.code(409).send({ error: 'conflict', message: 'It has started, so it finishes or rolls back by itself.' });
        if (!upgrade || !(await store.cancelUpgrade(upgrade.id))) return reply.code(404).send({ error: 'not_found', message: 'No upgrade is waiting.' });
        upgradeSettings = undefined;
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.upgrade-cancelled', target: upgrade.version });
        return updatesPage();
      },
    );

    /** Only the deployment's own updater may read the target and report on it. */
    const isUpdater = async (req: FastifyRequest, reply: FastifyReply) => {
      const service = await serviceOf(req, reply);
      if (service === undefined) return false;
      if (service?.kind === 'platform' && service.name === UPDATER) return true;
      void reply.code(403).send({ error: 'forbidden', message: 'Only the deployment’s updater can do this.' });
      return false;
    };

    /**
     * What the updater should run: the open upgrade, by digest, or nothing (204). With it, what the
     * release file says the updater checks against: each part's version, the settings it needs
     * and its deploy files. Those come from the feed, so they're missing when it can't be read.
     */
    app.get(
      '/platform/upgrade/target',
      {
        schema: {
          summary: "The upgrade to run (the deployment's updater only)",
          description: [
            'Signed in as the updater client (platform-updater). Each call counts as the updater being seen. On the',
            "workbench, and where AUGUR's desired state is Automatic, it first asks for the upgrade Automatic",
            'reaches by itself (ADR 0020), audited as platform.upgrade-requested.',
          ].join(' '),
          response: {
            200: Type.Object(
              {
                id: Type.String(),
                from: Type.String(),
                version: Type.String(),
                images: strings(),
                state: Type.Enum(['requested', 'running']),
                parts: Type.Optional(strings("Each part's version in the release, by package name. Missing when the release file can't be read.")),
                required: Type.Optional(Type.Array(Type.String(), { description: "The settings the release won't start without" })),
                deploy: Type.Optional(strings("The release's files in infra/deploy, by path inside it, as sha256")),
                settings: Type.Optional(strings('Settings the admin entered when asking, for the updater to write to .env')),
                watch: Type.Optional(
                  Type.Object(
                    {
                      breakingSince: Type.Optional(
                        Type.String({ description: 'A breaking release between, so a problem is reported for a person rather than gone back from' }),
                      ),
                    },
                    {
                      description:
                        "Present for an upgrade to a newer release: watch it for 10 minutes before it's done, going back by itself if sign-in or the gateway's calls fail (ADR 0020)",
                    },
                  ),
                ),
              },
              { description: "The open upgrade, with each part's image by digest" },
            ),
            204: empty('Nothing to do'),
            403: refused('Not the updater'),
            503: refused("The sign-in service can't be reached to check the updater's token"),
          },
        },
      },
      async (req, reply) => {
        if (!(await isUpdater(req, reply))) return reply;
      updaterSeenAt = new Date().toISOString();
      let upgrade = await store.upgrade();
      // The workbench takes AUGUR's dev builds by itself, as it would after an admin asked, backup first.
      if (upgrade?.state !== 'requested' && upgrade?.state !== 'running') {
        const view = updatesView({ checker: updates, apps: await store.records() });
        const history = await store.upgrades();
        // AUGUR's desired state (ADR 0020): Automatic within its reach, pin and window.
        const state = resolvedState(AUGUR_UNIT, (await store.desiredStates()).find((s) => s.unit === AUGUR_UNIT), updates.ring, timeZone, updates.channel);
        // Ask first or Hold stops dev builds too; they ignore windows, as the workbench takes them at any time.
        const version = state.policy === 'automatic' ? (automaticDevUpgrade(view, history, now()) ?? automaticUpgrade(view, state, history, now())) : undefined;
        const images = version ? updates.result.releases.find((r) => r.version === version)?.manifest?.images ?? {} : {};
        if (version && Object.keys(images).length && (await store.requestUpgrade({ id: randomUUID(), from: view.running.version, version, images, requestedBy: 'automatic' }))) {
          upgradeSettings = undefined;
          req.log.info({ from: view.running.version, to: version }, 'automatic upgrade requested');
          await record(req, { actor: { id: 'registry', kind: 'service' }, app: 'registry', action: 'platform.upgrade-requested', target: version, detail: { from: view.running.version, automatic: true } });
          upgrade = await store.upgrade();
        }
      }
      if (upgrade?.state !== 'requested' && upgrade?.state !== 'running') return reply.code(204).send();
      // Settings entered for it live only in this process: after a restart they're gone, so the
      // upgrade can't go ahead as asked. It ends here, saying so, before anything changes.
      if (upgrade.state === 'requested' && upgrade.settingNames?.length && upgradeSettings?.id !== upgrade.id) {
        const message = settingsLostMessage(upgrade.settingNames);
        const ended = await store.progressUpgrade(upgrade.id, { step: 'preflight', state: 'failed', message }, { state: 'failed', message });
        if (ended) {
          req.log.warn({ upgrade: upgrade.id, settings: upgrade.settingNames }, 'upgrade settings lost in a restart');
          await record(req, {
            actor: { id: 'registry', kind: 'service' },
            app: 'registry',
            action: OUTCOME_ACTIONS.failed,
            target: upgrade.version,
            detail: { from: upgrade.from, settings: upgrade.settingNames, reason: 'settings-lost' },
          });
        }
        return reply.code(204).send();
      }
      const { id, from, version, images, state } = upgrade;
      const manifest = updates.result.releases.find((r) => r.version === version)?.manifest;
      // Moving forward is watched before it's done (ADR 0020); going back by itself is unsafe past a breaking release.
      const forward = semver.valid(version) && semver.valid(from) && semver.gt(version, from);
      const breakingSince = forward
        ? updates.result.releases
            .filter((r) => semver.valid(r.version) && semver.gt(r.version, from) && semver.lte(r.version, version) && r.manifest?.breaking.length)
            .map((r) => r.version)
            .sort(semver.compare)[0]
        : undefined;
      return {
        id,
        from,
        version,
        images,
        state,
        ...(forward ? { watch: breakingSince ? { breakingSince } : {} } : {}),
        ...(upgradeSettings?.id === id ? { settings: upgradeSettings.settings } : {}),
        ...(manifest
          ? {
              parts: Object.fromEntries(Object.entries(manifest.parts).map(([name, part]) => [name, part.version])),
              required: manifest.settings?.required ?? [],
              ...(manifest.deploy ? { deploy: manifest.deploy } : {}),
            }
          : {}),
      };
      },
    );

    /** One step of the open upgrade, from the updater; with `outcome`, how it ended. */
    app.post(
      '/platform/upgrade/progress',
      {
        schema: {
          summary: "Report a step of the open upgrade (the deployment's updater only)",
          description: [
            'The first report starts it. With `outcome` it ends, audited as platform.upgraded,',
            'platform.upgrade-rolled-back or platform.upgrade-failed; platform.went-back when it ends',
            'done on an older release than it started from.',
          ].join(' '),
          body: Type.Object(
            {
              id: Type.String({ maxLength: 64 }),
              step: ref(UpgradeStep),
              state: Type.Enum(['running', 'done', 'failed']),
              message: Type.Optional(Type.String({ maxLength: 2000 })),
              outcome: Type.Optional(Type.Enum(['done', 'rolled-back', 'failed'])),
              // How many of AUGUR's calls the watch judged by: too few starts the light watch after it.
              calls: Type.Optional(
                Type.Integer({ minimum: 0, description: `How many of AUGUR's calls the watch judged by. Fewer than ${AFTER_MIN_CALLS} starts the light watch (ADR 0020, amended).` }),
              ),
            },
            { additionalProperties: false },
          ),
          response: {
            200: { ...ref(UpgradeSchema), description: 'The upgrade as it stands' },
            403: refused('Not the updater'),
            404: refused('Not the open upgrade'),
            503: refused("The sign-in service can't be reached to check the updater's token"),
          },
        },
      },
      async (req, reply) => {
        if (!(await isUpdater(req, reply))) return reply;
        const { id, outcome, message, calls, ...step } = req.body;
        const upgrade: Upgrade | undefined = await store.progressUpgrade(id, { ...step, ...(message ? { message } : {}) }, outcome ? { state: outcome, ...(message ? { message } : {}) } : undefined);
        if (!upgrade) return reply.code(404).send({ error: 'not_found', message: 'That isn’t the upgrade under way.' });
        if (outcome && upgradeSettings?.id === id) upgradeSettings = undefined;
        // A watch too quiet to judge errors by keeps going, lightly, until there are enough calls (ADR 0020, amended 2 Nov).
        if (outcome === 'done' && step.step === 'watch' && calls !== undefined && calls < AFTER_MIN_CALLS) {
          const afterWatch = startAfterWatch(now());
          if (await store.setAfterWatch(id, afterWatch)) upgrade.afterWatch = afterWatch;
        }
        req.log.info({ upgrade: id, step: step.step, state: step.state, outcome }, 'upgrade progress');
        if (outcome) {
          await record(req, {
            actor: { id: UPDATER, kind: 'service' },
            app: 'registry',
            // Ending on an older release than it started from was going back on purpose.
            action: outcome === 'done' && semver.valid(upgrade.version) && semver.valid(upgrade.from) && semver.lt(upgrade.version, upgrade.from) ? 'platform.went-back' : OUTCOME_ACTIONS[outcome],
            target: upgrade.version,
            detail: { from: upgrade.from, requestedBy: upgrade.requestedBy, ...(message ? { message } : {}) },
          });
        }
        return upgrade;
      },
    );

    /** The light watch's next look, for the updater: the upgrade it watches and how many minutes to read, or nothing (204). */
    app.get(
      '/platform/upgrade/after-watch',
      {
        schema: {
          summary: "The light watch's next look (the deployment's updater only)",
          description: [
            "After a watch too quiet to judge errors by, the updater looks every 5 minutes until AUGUR's",
            'services have had 20 calls, for at most a day (ADR 0020, amended). 204 when no look is due.',
          ].join(' '),
          response: {
            200: Type.Object(
              { id: Type.String(), version: Type.String(), minutes: Type.Integer({ minimum: 1, maximum: 15 }) },
              { description: "The upgrade being watched, and how many minutes of the gateway's counts to read" },
            ),
            204: empty('No look is due'),
            403: refused('Not the updater'),
            503: refused("The sign-in service can't be reached to check the updater's token"),
          },
        },
      },
      async (req, reply) => {
        if (!(await isUpdater(req, reply))) return reply;
        const latest = await store.upgrade();
        const due = latest?.state === 'done' && latest.afterWatch ? lookDue(latest.afterWatch, now()) : undefined;
        if (!latest || !due) return reply.code(204).send();
        return { id: latest.id, version: latest.version, minutes: due.minutes };
      },
    );

    /** One look of the light watch, from the updater: AUGUR's calls since the last look and whether sign-in worked. */
    app.post(
      '/platform/upgrade/after-watch',
      {
        schema: {
          summary: "Report one look of the light watch (the deployment's updater only)",
          description: [
            "Adds AUGUR's calls since the last look. The watch ends held, failed (more than 5% of 20 calls, or",
            "sign-in failing twice in a row; it doesn't go back by itself and shows in Needs you) or quiet",
            'after a day, audited as platform.after-watch-failed or platform.after-watch-ended.',
          ].join(' '),
          body: Type.Object(
            {
              id: Type.String({ maxLength: 64 }),
              calls: Type.Integer({ minimum: 0 }),
              serverErrors: Type.Integer({ minimum: 0 }),
              signInProblem: Type.Optional(Type.String({ maxLength: 500 })),
            },
            { additionalProperties: false },
          ),
          response: {
            200: { ...AfterWatch, description: 'The light watch as it stands' },
            403: refused('Not the updater'),
            404: refused("That upgrade isn't being watched"),
            503: refused("The sign-in service can't be reached to check the updater's token"),
          },
        },
      },
      async (req, reply) => {
        if (!(await isUpdater(req, reply))) return reply;
        const latest = await store.upgrade();
        // Only the latest upgrade is watched: one asked for since ends the light watch of the one before.
        if (!latest || latest.id !== req.body.id || latest.state !== 'done' || latest.afterWatch?.state !== 'watching') {
          return reply.code(404).send({ error: 'not_found', message: 'That upgrade isn’t being watched.' });
        }
        const { id, ...look } = req.body;
        const afterWatch = afterLook(latest.afterWatch, look, latest.version, now());
        await store.setAfterWatch(id, afterWatch);
        if (afterWatch.state !== 'watching') {
          req.log.info({ upgrade: id, state: afterWatch.state }, 'light watch ended');
          await record(req, {
            actor: { id: UPDATER, kind: 'service' },
            app: 'registry',
            action: afterWatch.state === 'failed' ? 'platform.after-watch-failed' : 'platform.after-watch-ended',
            target: latest.version,
            detail: { state: afterWatch.state, calls: afterWatch.calls, serverErrors: afterWatch.serverErrors, ...(afterWatch.message ? { message: afterWatch.message } : {}) },
          });
        }
        return afterWatch;
      },
    );
  };
