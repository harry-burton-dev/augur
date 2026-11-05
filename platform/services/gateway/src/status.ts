import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Upstreams } from './app.ts';

/** What the platform is made of, as admins see it on Status. */
export type ComponentKind = 'gateway' | 'service' | 'app' | 'sign-in';

/** `up` answers in time, `slow` answers late, `down` failed its last check or has gone quiet, `checking` has not been checked yet. */
export type ComponentState = 'up' | 'slow' | 'down' | 'checking';

export interface ComponentStatus {
  name: string;
  kind: ComponentKind;
  state: ComponentState;
  /** What `/healthz` said is deployed. */
  version?: string;
  api?: string;
  /** How long the last answer took. */
  latencyMs?: number;
  /** When it was last checked, and when it last answered. */
  checkedAt?: string;
  seenAt?: string;
  /** Why the last check failed, in words an admin can act on. */
  problem?: string;
}

export interface Probe {
  name: string;
  kind: ComponentKind;
  url: string;
}

export interface MonitorOptions {
  probes: Probe[];
  /** Probes found out on each round, such as apps whose service the registry knows of. */
  moreProbes?: () => Promise<Probe[]>;
  /** How often every probe is checked. */
  intervalMs?: number;
  /** How long one check may take before it counts as failed. */
  timeoutMs?: number;
  /** An answer slower than this is `slow`. */
  slowMs?: number;
  /** With no answer for this long, a component is `down`. */
  staleMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface Seen {
  checkedAt?: number;
  seenAt?: number;
  latencyMs?: number;
  version?: string;
  api?: string;
  problem?: string;
}

/** The probes for a gateway: its upstreams' `/healthz`, and the sign-in service's signing keys. */
export const probesFor = (upstreams: Upstreams, platform: string[], signInUrl?: string): Probe[] => [
  ...Object.entries(upstreams).map(([name, url]) => ({
    name,
    kind: (platform.includes(name) ? 'service' : 'app') as ComponentKind,
    url: `${url.replace(/\/$/, '')}/healthz`,
  })),
  ...(signInUrl ? [{ name: 'sign-in', kind: 'sign-in' as const, url: signInUrl }] : []),
];

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/**
 * Checks every part of the platform on a timer and keeps the last answer, so
 * Status never waits on a slow service. A component with no answer for
 * `staleMs` reads down, even if the last check is still in flight.
 */
export class HealthMonitor {
  private readonly probes: Probe[];
  private readonly moreProbes?: () => Promise<Probe[]>;
  private found: Probe[] = [];
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly slowMs: number;
  private readonly staleMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly seen = new Map<string, Seen>();
  private timer?: ReturnType<typeof setInterval>;
  private readonly startedAt: number;

  constructor({ probes, moreProbes, intervalMs = 30_000, timeoutMs = 5_000, slowMs = 2_000, staleMs = 120_000, fetchImpl = (...a) => fetch(...a), now = Date.now }: MonitorOptions) {
    this.probes = probes;
    this.moreProbes = moreProbes;
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
    this.slowMs = slowMs;
    this.staleMs = staleMs;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.startedAt = now();
  }

  start() {
    if (this.timer) return;
    void this.checkAll();
    this.timer = setInterval(() => void this.checkAll(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async checkAll(): Promise<void> {
    if (this.moreProbes) {
      // When they can't be found out this round, the ones found last round are checked again.
      const found = await this.moreProbes().catch(() => this.found);
      this.found = found.filter((p) => !this.probes.some((q) => q.name === p.name));
    }
    await Promise.all(this.all().map((p) => this.check(p)));
  }

  private all() {
    return [...this.probes, ...this.found];
  }

  private async check(probe: Probe): Promise<void> {
    const started = this.now();
    const was = this.seen.get(probe.name) ?? {};
    try {
      const res = await this.fetchImpl(probe.url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) throw new Error(`It answered ${res.status}.`);
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const at = this.now();
      this.seen.set(probe.name, { checkedAt: at, seenAt: at, latencyMs: at - started, version: str(body.version), api: str(body.api) });
    } catch (err) {
      const timedOut = (err as Error).name === 'TimeoutError';
      const problem = timedOut ? `It didn’t answer within ${this.timeoutMs / 1000} seconds.` : (err as Error).message.startsWith('It answered') ? (err as Error).message : 'It can’t be reached.';
      this.seen.set(probe.name, { ...was, checkedAt: this.now(), problem });
    }
  }

  /** Every component as it stands now, the gateway first. */
  snapshot(gateway: { version: string; api: string }): ComponentStatus[] {
    const now = this.now();
    const iso = (t?: number) => (t === undefined ? undefined : new Date(t).toISOString());
    const rows = this.all().map((p): ComponentStatus => {
      const s = this.seen.get(p.name) ?? {};
      const quiet = s.seenAt === undefined ? now - this.startedAt >= this.staleMs : now - s.seenAt >= this.staleMs;
      const state: ComponentState = s.problem || (quiet && s.seenAt !== undefined) ? 'down' : s.seenAt === undefined ? (quiet ? 'down' : 'checking') : (s.latencyMs ?? 0) > this.slowMs ? 'slow' : 'up';
      const problem = s.problem ?? (state === 'down' ? `It hasn’t answered for ${Math.round(this.staleMs / 60_000)} minutes.` : undefined);
      return {
        name: p.name,
        kind: p.kind,
        state,
        ...(s.version ? { version: s.version } : {}),
        ...(s.api ? { api: s.api } : {}),
        ...(s.latencyMs !== undefined ? { latencyMs: s.latencyMs } : {}),
        ...(s.checkedAt !== undefined ? { checkedAt: iso(s.checkedAt) } : {}),
        ...(s.seenAt !== undefined ? { seenAt: iso(s.seenAt) } : {}),
        ...(problem ? { problem } : {}),
      };
    });
    return [{ name: 'gateway', kind: 'gateway', state: 'up', version: gateway.version, api: gateway.api, checkedAt: iso(now), seenAt: iso(now) }, ...rows];
  }
}

/** One run of the nightly backup, as the backup container wrote it. */
export interface BackupRun {
  at: string;
  ok: boolean;
  file?: string;
  bytes?: number;
  problem?: string;
}

/** The last copy of the night's backup off the server (restic, ADR 0060), as the backup container wrote it. */
export interface OffsiteCopy {
  at: string;
  ok: boolean;
  snapshot?: string;
  keepDays?: number;
  problem?: string;
}

/** One weekly restore test: the newest backup loaded into a throwaway database and checked. */
export interface RestoreTest extends BackupRun {
  /** Restored from this server's backup, or from the off-server copy. */
  from?: 'local' | 'offsite';
  seconds?: number;
  people?: number;
  apps?: number;
  auditEntries?: number;
}

/** Restoring the database to a point in time (ADR 0064), as the backup container noted it hourly in pitr.json. */
export interface PointInTime {
  at: string;
  ok: boolean;
  bases?: number;
  /** When the oldest base backup was taken: the earliest moment the database can go back to. */
  earliest?: string;
  archivedAt?: string;
  copiedAt?: string;
  problem?: string;
  /** The weekly test, from pitr-test.json. */
  lastTest?: { at: string; ok: boolean; base?: string; seconds?: number; mark?: string; reached?: string; problem?: string };
}

export interface BackupStatus {
  /** `attention` when backups can't be relied on right now; `problem` says why. */
  state: 'ok' | 'attention';
  problem?: string;
  lastBackup?: BackupRun;
  /** Absent until a copy has been made: then backups stay on this server only. */
  offsite?: OffsiteCopy;
  /** Absent on a deployment whose compose file doesn't archive WAL yet. */
  pointInTime?: PointInTime;
  lastRestoreTest?: RestoreTest;
}

const DAY = 86_400_000;

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

/** Whether AUGUR is open to the internet through Tailscale Funnel, and until when. */
export interface PublicAccess {
  open: boolean;
  until?: string;
}

/**
 * What infra/deploy/public.sh last wrote: the time, in Unix seconds, AUGUR is open to the internet
 * until. No file, or a time gone by, is private; the Tailscale container goes by the same file.
 */
export const publicAccess = async (file: string, now = Date.now()): Promise<PublicAccess> => {
  const seconds = Number((await readFile(file, 'utf8').catch(() => '')).replace(/[^0-9]/g, ''));
  return seconds * 1000 > now ? { open: true, until: new Date(seconds * 1000).toISOString() } : { open: false };
};

/** Where an admin turns the off-server copy on or fixes it. */
const OFFSITE_HOW = 'Set OFFSITE_REPOSITORY, OFFSITE_PASSWORD and the bucket key in .env on the server (docs/deploy.md, "Off-server copy").';

/**
 * What the backup container last wrote beside the backups: the night's dump (expected within a day), its
 * copy off the server (expected within a day; ADR 0060) and the weekly restore test (expected within 8
 * days, and from the off-server copy once there is one); then restoring to a point in time (ADR 0064):
 * pitr.json, which the container rewrites every hour, and its weekly test.
 */
export const backupStatus = async (dir: string, now = Date.now()): Promise<BackupStatus> => {
  const lastBackup = await readJson<BackupRun>(join(dir, 'last-backup.json'));
  const offsite = await readJson<OffsiteCopy>(join(dir, 'offsite.json'));
  const lastRestoreTest = await readJson<RestoreTest>(join(dir, 'restore-test.json'));
  const pitr = await readJson<PointInTime>(join(dir, 'pitr.json'));
  const pitrTest = await readJson<PointInTime['lastTest']>(join(dir, 'pitr-test.json'));
  const pointInTime = pitr ? { ...pitr, ...(pitrTest ? { lastTest: pitrTest } : {}) } : undefined;
  const age = (run?: { at: string }) => (run ? now - Date.parse(run.at) : Infinity);
  const problem = !lastBackup
    ? 'No backup has been taken yet.'
    : !lastBackup.ok
      ? (lastBackup.problem ?? 'The last backup failed.')
      : age(lastBackup) > DAY + 2 * 3_600_000
        ? 'The last backup is more than a day old. Check the backup container is running.'
        : !lastRestoreTest
          ? 'No backup has been test-restored yet.'
          : !lastRestoreTest.ok
            ? `The last restore test failed: ${lastRestoreTest.problem ?? 'it didn’t say why.'}`
            : age(lastRestoreTest) > 8 * DAY
              ? 'No restore test has run for over a week. Check the backup container is running.'
              : !offsite
                ? `Backups are kept on this server only, so losing the server would lose them too. ${OFFSITE_HOW}`
                : !offsite.ok
                  ? (offsite.problem ?? `The last copy off the server failed. ${OFFSITE_HOW}`)
                  : age(offsite) > DAY + 2 * 3_600_000
                    ? 'The last copy off the server is more than a day old. Check the backup container is running.'
                    : lastRestoreTest.from !== 'offsite'
                      ? 'No backup has been restored from the off-server copy yet. It runs with the next restore test.'
                      : pointInTimeProblem(pointInTime, age);
  return {
    state: problem ? 'attention' : 'ok',
    ...(problem ? { problem } : {}),
    ...(lastBackup ? { lastBackup } : {}),
    ...(offsite ? { offsite } : {}),
    ...(pointInTime ? { pointInTime } : {}),
    ...(lastRestoreTest ? { lastRestoreTest } : {}),
  };
};

/**
 * Why the database can't be relied on to go back to a moment: pitr.json is rewritten hourly, so over three
 * hours old means the backup container stopped; the weekly test, like the restore test, within 8 days.
 * Nothing is said before pitr.json first appears: an older compose file, whose deployment still has its dumps.
 */
const pointInTimeProblem = (pitr: PointInTime | undefined, age: (run?: { at: string }) => number): string | undefined =>
  !pitr
    ? undefined
    : !pitr.ok
      ? (pitr.problem ?? 'The database cannot be restored to a point in time right now.')
      : age(pitr) > 3 * 3_600_000
        ? 'Restoring to a point in time has not been checked for over three hours. Check the backup container is running.'
        : !pitr.lastTest
          ? 'Restoring to a point in time has not been tested yet. It runs with the next restore test.'
          : !pitr.lastTest.ok
            ? `The last point-in-time restore test failed: ${pitr.lastTest.problem ?? 'it didn’t say why.'}`
            : age(pitr.lastTest) > 8 * DAY
              ? 'No point-in-time restore test has run for over a week. Check the backup container is running.'
              : undefined;
