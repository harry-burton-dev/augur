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
  state: 'verified' | 'mirror' | 'unchecked';
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
  /** `build: 'source'` when the server was built from a checkout: `version` is then the last release it's based on. */
  running: { version: string; channel: Channel; build?: 'source' };
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
  /** Whether a halted release may be installed here for a test (ADR 0051), and why not. Absent from an older registry. */
  haltedInstall?: HaltedInstall;
}

/** Only dev and preview servers install a halted release, on request, to test going back (ADR 0051). */
export interface HaltedInstall {
  allowed: boolean;
  why?: string;
}

export interface Window {
  /** 0 is Sunday, as Date.getDay(). */
  day: number;
  /** "02:00", in the deployment's time zone. */
  start: string;
  hours: number;
}

export type AutomaticLevel = 'patch' | 'minor';

/** How one unit takes new releases (ADR 0020): PUT /platform/units/{unit}/desired-state. */
export interface DesiredStateInput {
  channel: Channel;
  policy: Policy;
  automaticUpTo: AutomaticLevel;
  pin?: string;
  /** None means an automatic upgrade may start at any time. */
  windows: Window[];
  timeZone?: string;
}

export interface DesiredState extends DesiredStateInput {
  unit: string;
  setBy: string;
  setAt: string;
}

/** A unit's last finished upgrade or app job, and who has looked at it. */
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

/** One unit in the overview: AUGUR first, then each installed app. */
export interface OverviewUnit {
  unit: string;
  name: string;
  running: string;
  available?: string;
  halted?: Halted;
  desired: DesiredState & { timeZone: string; isDefault: boolean };
  /** The record in one sentence, written by the registry. */
  policy: string;
  window: { open: boolean; nextAt?: string };
  /** What Automatic does with the next release: takes it, or why it waits. */
  automatic?: { takes?: string; waits?: string };
  open?: { id: string; version?: string; state: 'requested' | 'running' };
  lastResult?: UnitResult;
}

/** GET /api/registry/v1/platform/overview: the same shape Backstage's card reads. */
export interface Overview {
  ring: Ring;
  timeZone: string;
  feed: 'on' | 'off';
  feedTrust?: FeedTrust;
  checkedAt?: string;
  units: OverviewUnit[];
  needsYou: { kind: 'halted' | 'failed' | 'went-back' | 'first-upgrade' | 'after-watch'; unit: string; message: string; result?: { kind: 'upgrade' | 'app-job'; id: string } }[];
  /** Whether this deployment tells Backstage what it runs (ADR 0019), and why. Absent from an older registry. */
  reporting?: { mode: ReportingMode; why: string };
}

export type ReportingMode = 'send' | 'file' | 'off';

/** How this deployment reports to Backstage, as `GET /platform/reporting` gives it to an admin. */
export interface ReportingView {
  mode: ReportingMode;
  why: string;
  /** Its name in Backstage (`DEPLOYMENT_ID`). */
  deployment?: string;
  /** The key Backstage checks the record with, for the `augur.dev/report-key` annotation. */
  publicKey?: string;
  last?: { at: string; reason: 'started' | 'changed' | 'daily' | 'export'; ok: boolean; problem?: string };
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
