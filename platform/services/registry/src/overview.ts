// The Upgrade Centre's overview (GET /platform/overview): every unit this deployment runs, AUGUR and
// each installed app, with its desired state (ADR 0020), what's next for it, the last result and what
// needs an admin. Also the routes that change a unit's desired state and mark a result looked at.
import { callerFromHeaders, type NewAuditEntry } from '@augur/service-kit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import semver from 'semver';
import { newestOn, type AppFeedRelease, type AppUpdateChecker } from './app-updates.ts';
import {
  AUGUR_UNIT,
  automaticProblem,
  desiredStateProblems,
  MAX_WINDOWS,
  policySentence,
  resolvedState,
  windowAt,
  type DesiredState,
  type DesiredStateInput,
  type StoredDesiredState,
} from './desired-state.ts';
import { PRODUCTION_ONLY, takesPreview, type Ring } from './ring.ts';
import { DEPLOYMENT_ADMIN, needsDeploymentAdmin } from './roles.ts';
import type { AppJob, AppStore, InstalledApp, Upgrade } from './store.ts';
import { updatesView, type Halt, type UpdateChecker, type UpdatesView } from './updates.ts';

/** A finished upgrade (AUGUR) or install (an app), as the overview shows the last one. */
export interface UnitResult {
  kind: 'upgrade' | 'app-job';
  id: string;
  from?: string;
  version?: string;
  state: 'done' | 'rolled-back' | 'failed' | 'cancelled';
  message?: string;
  finishedAt: string;
  seenBy?: string;
  seenAt?: string;
}

export interface UnitOverview {
  unit: string;
  name: string;
  running: string;
  /** The newest release on its channel, when newer. */
  available?: string;
  /** Its publisher halted the release it runs. */
  halted?: Halt;
  desired: DesiredState & { isDefault: boolean };
  /** The record in a sentence. */
  policy: string;
  window: { open: boolean; nextAt?: string };
  /** What Automatic does with `available`: takes it (`takes`), or why it waits for an admin. */
  automatic?: { takes?: string; waits?: string };
  /** An upgrade or install waiting or under way. */
  open?: { id: string; version?: string; state: 'requested' | 'running' };
  lastResult?: UnitResult;
}

export interface OverviewNeed {
  kind: 'halted' | 'failed' | 'went-back';
  unit: string;
  message: string;
  /** The result to mark looked at, for failed and went-back. */
  result?: { kind: UnitResult['kind']; id: string };
}

export interface Overview {
  ring: Ring;
  timeZone: string;
  feed: 'on' | 'off';
  feedTrust?: UpdatesView['feedTrust'];
  checkedAt?: string;
  units: UnitOverview[];
  needsYou: OverviewNeed[];
}

const isOpen = (s: string) => s === 'requested' || s === 'running';

const upgradeResult = (u: Upgrade): UnitResult | undefined =>
  u.finishedAt && !isOpen(u.state)
    ? { kind: 'upgrade', id: u.id, from: u.from, version: u.version, state: u.state as UnitResult['state'], ...(u.message ? { message: u.message } : {}), finishedAt: u.finishedAt, ...(u.seenBy ? { seenBy: u.seenBy, seenAt: u.seenAt } : {}) }
    : undefined;

const jobResult = (j: AppJob): UnitResult | undefined =>
  j.finishedAt && !isOpen(j.state)
    ? { kind: 'app-job', id: j.id, ...(j.release ? { version: j.release.version } : {}), state: j.state as UnitResult['state'], ...(j.message ? { message: j.message } : {}), finishedAt: j.finishedAt, ...(j.seenBy ? { seenBy: j.seenBy, seenAt: j.seenAt } : {}) }
    : undefined;

/** What needs an admin from one unit's last result: a failure, or a go-back it did by itself, until someone marks it looked at. */
const resultNeed = (unit: UnitOverview): OverviewNeed | undefined => {
  const r = unit.lastResult;
  if (!r || r.seenBy) return undefined;
  const result = { kind: r.kind, id: r.id };
  if (r.state === 'rolled-back') return { kind: 'went-back', unit: unit.unit, message: `${unit.name} went back to ${r.from ?? unit.running} by itself: ${r.message ?? `the upgrade to ${r.version} didn’t finish.`}`, result };
  if (r.state === 'failed') return { kind: 'failed', unit: unit.unit, message: `${unit.name}${r.version ? ` ${r.version}` : ''} didn’t finish: ${r.message ?? 'it stopped partway.'}`, result };
  return undefined;
};

export interface OverviewInput {
  ring: Ring;
  timeZone: string;
  now: Date;
  augur: UpdatesView;
  /** The publisher's halt on the release AUGUR runs, if any. */
  augurHalt?: Halt;
  upgrades: Upgrade[];
  installed: InstalledApp[];
  jobs: AppJob[];
  appReleases: AppFeedRelease[];
  names: Record<string, string>;
  states: StoredDesiredState[];
}

/** Builds the overview from what the registry knows. Pure, for tests. */
export const overviewOf = (input: OverviewInput): Overview => {
  const { ring, timeZone, now, augur } = input;
  const stateOf = (unit: string, channel?: DesiredState['channel']) => resolvedState(unit, input.states.find((s) => s.unit === unit), ring, timeZone, channel);
  const automaticFor = (state: DesiredState, running: string, available?: string) => {
    if (!available) return undefined;
    const waits = automaticProblem(state, running, available);
    return waits ? { waits } : { takes: available };
  };

  const augurState = stateOf(AUGUR_UNIT, augur.channel);
  const openUpgrade = input.upgrades.find((u) => isOpen(u.state));
  const lastUpgrade = input.upgrades.map(upgradeResult).find(Boolean);
  const halt = augur.needsYou.find((n) => n.kind === 'halted');
  const units: UnitOverview[] = [
    {
      unit: AUGUR_UNIT,
      name: 'AUGUR',
      running: augur.running.version,
      ...(augur.available ? { available: augur.available.version } : {}),
      ...(input.augurHalt ? { halted: input.augurHalt } : {}),
      desired: augurState,
      policy: policySentence(augurState),
      window: windowAt(augurState, now),
      ...(augur.next ? { automatic: automaticFor(augurState, augur.running.version, augur.next) } : {}),
      ...(openUpgrade ? { open: { id: openUpgrade.id, version: openUpgrade.version, state: openUpgrade.state as 'requested' | 'running' } } : {}),
      ...(lastUpgrade ? { lastResult: lastUpgrade } : {}),
    },
  ];

  for (const { app, release } of [...input.installed].sort((a, b) => a.app.localeCompare(b.app))) {
    const state = stateOf(app);
    const channel = takesPreview(ring) ? state.channel : 'stable';
    const newest = newestOn(input.appReleases, app, channel);
    const available = newest && semver.gt(newest.version, release.version) ? newest.version : undefined;
    const jobs = input.jobs.filter((j) => j.app === app && j.pr === undefined);
    const open = jobs.find((j) => isOpen(j.state));
    const last = jobs.map(jobResult).find(Boolean);
    const halted = input.appReleases.find((r) => r.app === app && r.version === release.version)?.halted;
    units.push({
      unit: app,
      name: input.names[app] ?? app,
      running: release.version,
      ...(available ? { available } : {}),
      ...(halted ? { halted } : {}),
      desired: { ...state, channel },
      policy: policySentence(state),
      window: windowAt(state, now),
      ...(available ? { automatic: automaticFor(state, release.version, available) } : {}),
      ...(open ? { open: { id: open.id, ...(open.release ? { version: open.release.version } : {}), state: open.state as 'requested' | 'running' } } : {}),
      ...(last ? { lastResult: last } : {}),
    });
  }

  const needsYou: OverviewNeed[] = [];
  for (const u of units) {
    if (u.unit === AUGUR_UNIT && halt) needsYou.push({ kind: 'halted', unit: u.unit, message: halt.message });
    else if (u.halted) needsYou.push({ kind: 'halted', unit: u.unit, message: `${u.name} ${u.running}, which this server runs, was halted by its publisher: ${u.halted.reason}` });
    const need = resultNeed(u);
    if (need) needsYou.push(need);
  }

  return {
    ring,
    timeZone,
    feed: augur.feed,
    ...(augur.feedTrust ? { feedTrust: augur.feedTrust } : {}),
    ...(augur.checkedAt ? { checkedAt: augur.checkedAt } : {}),
    units,
    needsYou,
  };
};

export interface OverviewRouteOptions {
  store: AppStore;
  updates: UpdateChecker;
  appUpdates: AppUpdateChecker;
  timeZone: string;
  record: (req: FastifyRequest, entry: NewAuditEntry) => unknown;
  now?: () => Date;
}

const windowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['day', 'start', 'hours'],
  properties: { day: { type: 'integer', minimum: 0, maximum: 6 }, start: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, hours: { type: 'number', minimum: 1, maximum: 24 } },
};

const desiredStateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['channel', 'policy', 'automaticUpTo', 'windows'],
  properties: {
    channel: { enum: ['stable', 'beta', 'dev'] },
    policy: { enum: ['automatic', 'ask', 'hold'] },
    automaticUpTo: { enum: ['patch', 'minor'] },
    pin: { type: 'string', minLength: 1, maxLength: 64 },
    windows: { type: 'array', maxItems: MAX_WINDOWS, items: windowSchema },
    timeZone: { type: 'string', minLength: 1, maxLength: 64 },
  },
};

export const overviewRoutes =
  ({ store, updates, appUpdates, timeZone, record, now = () => new Date() }: OverviewRouteOptions) =>
  async (app: FastifyInstance) => {
    const ring = updates.ring;
    const adminOf = (req: FastifyRequest) => {
      const caller = callerFromHeaders(req.headers);
      return caller?.roles.includes('admin') ? caller : undefined;
    };

    const overview = async () => {
      const [records, upgrades, installed, jobs, states] = await Promise.all([store.records(), store.upgrades(), store.installedApps(), store.appJobs(), store.desiredStates()]);
      return overviewOf({
        ring,
        timeZone,
        now: now(),
        augur: updatesView({ checker: updates, apps: records }),
        augurHalt: updates.result.releases.find((r) => r.version === updates.running.version)?.halted,
        upgrades,
        installed,
        jobs,
        appReleases: appUpdates.result.releases,
        names: Object.fromEntries(records.map((r) => [r.entry.id, r.entry.name])),
        states,
      });
    };

    /** Every unit at once: what it runs, what it follows, what's next and what needs an admin. */
    app.get('/platform/overview', async (req, reply) => {
      if (!adminOf(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see what this server runs and how it updates.' });
      return overview();
    });

    /** A unit is AUGUR or an app the app runner installed. */
    const knownUnit = async (unit: string) => unit === AUGUR_UNIT || (await store.installedApps()).some((a) => a.app === unit);

    /** Sets how a unit takes new releases. Audited as platform.desired-state-set, with the record before. */
    app.put<{ Params: { unit: string }; Body: DesiredStateInput & { timeZone?: string } }>(
      '/platform/units/:unit/desired-state',
      { schema: { body: desiredStateSchema } },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        // Policies, pins and windows decide what the server runs, so they need the deployment's own role (ADR 0022).
        if (!caller?.roles.includes(DEPLOYMENT_ADMIN)) return reply.code(403).send(needsDeploymentAdmin('change how updates are taken'));
        const { unit } = req.params;
        if (!(await knownUnit(unit))) return reply.code(404).send({ error: 'not_found', message: `This server runs no ${unit}.` });
        const body = req.body;
        if (unit === AUGUR_UNIT && body.channel !== updates.channel) {
          return reply.code(409).send({ error: 'conflict', message: `AUGUR follows ${updates.channel} releases, set by RELEASE_CHANNEL in .env (docs/upgrade.md). Change it there.` });
        }
        if (unit !== AUGUR_UNIT && body.channel !== 'stable' && !takesPreview(ring)) return reply.code(409).send({ error: 'production_server', message: PRODUCTION_ONLY });
        const problems = desiredStateProblems({ ...body, timeZone: body.timeZone ?? timeZone });
        if (problems.length) return reply.code(400).send({ error: 'bad_request', message: problems.join(' ') });
        const before = (await store.desiredStates()).find((s) => s.unit === unit);
        const set = await store.setDesiredState({
          unit,
          channel: body.channel,
          policy: body.policy,
          automaticUpTo: body.automaticUpTo,
          ...(body.pin ? { pin: body.pin } : {}),
          windows: body.windows,
          ...(body.timeZone ? { timeZone: body.timeZone } : {}),
          setBy: caller.id,
        });
        req.log.info({ unit, by: caller.id, policy: set.policy }, 'desired state set');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.desired-state-set', target: unit, detail: { record: set, ...(before ? { before } : {}) } });
        return overview();
      },
    );

    /** The records a unit has had, newest first, each with who set it and when. */
    app.get<{ Params: { unit: string } }>('/platform/units/:unit/desired-state/history', async (req, reply) => {
      if (!adminOf(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see how updates were set.' });
      if (!(await knownUnit(req.params.unit))) return reply.code(404).send({ error: 'not_found', message: `This server runs no ${req.params.unit}.` });
      return { unit: req.params.unit, history: await store.desiredStateHistory(req.params.unit) };
    });

    /** Marks a finished upgrade or install looked at, for every admin: it leaves Needs you. */
    app.post<{ Params: { kind: 'upgrade' | 'app-job'; id: string } }>(
      '/platform/results/:kind/:id/seen',
      { schema: { params: { type: 'object', required: ['kind', 'id'], properties: { kind: { enum: ['upgrade', 'app-job'] }, id: { type: 'string', maxLength: 64 } } } } },
      async (req, reply) => {
        const caller = adminOf(req);
        if (!caller) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can mark a result looked at.' });
        if (!(await store.markSeen(req.params.kind, req.params.id, caller.id))) return reply.code(404).send({ error: 'not_found', message: 'There’s no finished upgrade or install with that id.' });
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.result-seen', target: req.params.id, detail: { kind: req.params.kind } });
        return overview();
      },
    );
  };
