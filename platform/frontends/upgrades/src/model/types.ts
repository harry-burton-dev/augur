/**
 * What the Upgrade Centre reads, in the shapes of contracts/registry.openapi.yaml.
 * Fields marked "coming" are the updater's next steps (ADRs 0017, 0020, 0022): they
 * are optional here, so the model works on today's registry and fills in as they land.
 */

/** Stored channel names; people see Production, Preview and Dev builds. */
export type Channel = 'stable' | 'beta' | 'dev';
/** SERVER_RING; people see Workbench, Preview and Production. */
export type Ring = 'dev' | 'preview' | 'production';
export type Policy = 'automatic' | 'ask' | 'hold';

/** A release the feed has stopped, with why (ADR 0017, coming). */
export interface Halted {
  reason: string;
  at: string;
}

/** Whether the feed could be trusted the last time it was read (ADR 0017, coming). */
export interface FeedTrust {
  state: 'verified' | 'mirror' | 'unchecked' | 'failed' | 'expired';
  expires?: string;
  signer?: string;
  note?: string;
}

export interface Change {
  id?: string;
  kind: 'major' | 'minor' | 'patch';
  text: string;
  parts: string[];
}

export interface ReleaseSummary {
  version: string;
  channel: Channel;
  released?: string;
  notesUrl?: string;
  breaking: string[];
  changes?: Change[];
  halted?: Halted;
}

export interface GoBackTarget {
  version: string;
  channel: Channel;
  released?: string;
  problem?: string;
  breakingAfter?: string;
  halted?: Halted;
}

export type JobState = 'requested' | 'running' | 'done' | 'rolled-back' | 'failed' | 'cancelled';

export interface UpgradeStep {
  step: 'preflight' | 'backup' | 'pull' | 'roll-forward' | 'verify' | 'watch' | 'roll-back';
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/** The after-upgrade watch (ADR 0020, coming). */
export interface Watch {
  until: string;
  checks: { name: string; value: number | string; threshold: number | string; ok: boolean }[];
  tripped?: boolean;
}

export interface Upgrade {
  id: string;
  from: string;
  version: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  state: JobState;
  steps: UpgradeStep[];
  message?: string;
  finishedAt?: string;
  backup?: string;
  watch?: Watch;
}

export interface PrepItem {
  kind: 'path' | 'setting' | 'breaking' | 'app' | 'unknown' | 'halted';
  message: string;
  version?: string;
  key?: string;
  required?: boolean;
  madeUp?: boolean;
  app?: string;
}

/** GET /api/registry/v1/platform/updates */
export interface PlatformUpdates {
  running: { version: string; channel: Channel };
  channel: Channel;
  ring?: Ring;
  channelNote?: string;
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  available?: ReleaseSummary & { parts: { name: string; from?: string; to: string }[] };
  newer: ReleaseSummary[];
  next?: string;
  needsYou: PrepItem[];
  upgrade?: Upgrade;
  history?: Omit<Upgrade, 'steps'>[];
  goBack?: GoBackTarget[];
  updaterSeenAt?: string;
  portalUrl?: string;
  feedTrust?: FeedTrust;
}

export interface Window {
  /** 0 is Sunday, as Date.getDay(). */
  day: number;
  /** "02:00", in the deployment's time zone. */
  start: string;
  hours: number;
}

/** GET /platform/units/{unit}: how one unit should move (ADR 0020, coming). */
export interface UnitRecord {
  channel: Channel;
  policy: Policy;
  pin?: string;
  hold?: { by: string; byName?: string; at: string; note?: string };
  windows: Window[] | 'any';
  timeZone: string;
  nextWindow?: string;
}

export interface AppJob {
  id: string;
  app: string;
  action: 'install' | 'remove';
  release?: { version: string; channel: string };
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'failed' | 'cancelled';
  message?: string;
  finishedAt?: string;
}

/** One installed app as the app runner reports it. */
export interface InstalledApp {
  app: string;
  name: string;
  version: string;
  installedAt: string;
  channel: Channel;
  policy: Policy;
  /** The newest release on its channel, when newer; `needs` says why it waits for an admin. */
  update?: { version: string; channel: Channel; notesUrl?: string; needs: string[]; changes?: Change[]; halted?: Halted };
  /** Set when the feed halted the version it runs (ADR 0017, coming). */
  halted?: Halted;
  job?: AppJob;
  older?: { version: string; channel: Channel }[];
}

/** An app the feed offers that isn't installed. */
export interface AvailableApp {
  app: string;
  name: string;
  description?: string;
  version: string;
  channel: Channel;
  notesUrl?: string;
  signer: { repository: string; workflow: string };
  asks: { scopes: string[]; storage: { database?: boolean; bucket?: boolean }; maxUpload: number };
  problem?: string;
  job?: AppJob;
}

/** GET /api/registry/v1/app-runner/apps */
export interface AppInstalls {
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  runnerSeenAt?: string;
  sdkVersion: string;
  ring?: Ring;
  previewsAllowed?: boolean;
  channelNote?: string;
  installed: InstalledApp[];
  available: AvailableApp[];
}
