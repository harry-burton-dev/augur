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
  /** Each unit on its way from main to stable, from the pipeline feed, with what this server runs of it. */
  line?: PipelineLine;
}

/** A pipeline stage: dev is main, preview each unit's newest release, production its newest stable one. */
export type Stage = 'dev' | 'preview' | 'production';
export interface PipelinePull {
  number: number;
  title: string;
  url: string;
}

/** The pipeline feed (docs/release-channels.md, The pipeline feed), as the registry passes it on. */
export interface PipelineLine {
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  generatedAt?: string;
  repository?: string;
  units: {
    id: string;
    name: string;
    versions: Record<Stage, string | null>;
    devBuild?: { version: string; released?: string };
    waiting: string[];
    previews: { pr: number; version: string }[];
    running?: string;
  }[];
  steps: { from: Stage; to: Stage; merged: number; pulls: { number: number; title: string; mergedAt?: string }[] }[];
  pulls?: { versionPackages?: PipelinePull; promoteToPreview?: PipelinePull; promoteToProduction: (PipelinePull & { unit: string; version: string })[] };
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
  /** What the caller may do here, for a frontend that is never told their roles (contract 3). */
  you?: { deploymentAdmin: boolean };
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
  last?: { at: string; reason: 'started' | 'changed' | 'heartbeat' | 'daily' | 'export'; ok: boolean; problem?: string };
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

/** What a contract 3 release asks an admin to agree to (spec 9.4). */
export interface AppAsks {
  scopes: string[];
  /** Each resource a part asks for, with its params. */
  resources: { part: string; type: string; params?: Record<string, unknown> }[];
  /** Each part's limits, by part name. */
  limits: Record<string, { memory: string; cpu: string }>;
  floors: string[];
  maxUpload: number;
  /** The ids of the settings it offers. */
  settings: string[];
  canvas?: boolean;
}

/** A setting an app offers admins (spec 5.2), as its manifest declares it. */
export interface AppSettingDecl {
  id: string;
  label: string;
  /** string, number, boolean, enum or secret. */
  type: string;
  required: boolean;
  detail?: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  default?: string | number | boolean;
}

/** What the review shows beyond the asks: each part's kind, and each setting. */
export interface AppReview {
  kinds: Record<string, string>;
  settings: AppSettingDecl[];
}

/** An app the feed offers that isn't installed. */
export interface AvailableApp {
  app: string;
  name: string;
  description?: string;
  version: string;
  channel: Channel;
  notesUrl?: string;
  /** The feed it is listed in, one of APP_FEEDS. */
  feed?: string;
  /** Missing for a release that can't install here. */
  signer?: { repository: string; workflow: string };
  asks?: AppAsks;
  review?: AppReview;
  /** Why it can't install in this AUGUR. */
  problem?: string;
  job?: AppJob;
}

/** A release file read from an address an admin pasted, checked as the feed's are. */
export interface PastedRelease {
  release: { id: string; version: string; manifest?: { name?: string } } & Record<string, unknown>;
  /** Why it can't install here; empty when it can. */
  refusals: string[];
  warnings: string[];
  asks?: AppAsks;
  signer?: { repository: string; workflow: string };
  review?: AppReview;
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
  /** How many days an app removed from the server keeps its data (APP_DATA_GRACE_DAYS). */
  dataGraceDays?: number;
  /** The deployment's default apps (DEFAULT_APPS) and where each stands: a waiting one says why. */
  defaultApps?: { app: string; state: 'installed' | 'asked' | 'waiting'; problem?: string }[];
  /** Apps removed from the server whose data is still kept, and until when. */
  removed?: { app: string; name: string; removedAt: string; deleteAt: string; failures?: number; problem?: string }[];
  installed: InstalledApp[];
  available: AvailableApp[];
}

/** One part of AUGUR as the gateway last checked it (the gateway's GET /status). */
export interface ComponentStatus {
  name: string;
  kind: 'gateway' | 'service' | 'app' | 'sign-in';
  state: 'up' | 'slow' | 'down' | 'checking';
  version?: string;
  api?: string;
  latencyMs?: number;
  checkedAt?: string;
  seenAt?: string;
  problem?: string;
}

/** Whether backups can be relied on, from what the backup container last wrote. */
export interface BackupStatus {
  state: 'ok' | 'attention';
  problem?: string;
  lastBackup?: { at: string; ok: boolean; file?: string; bytes?: number; problem?: string };
  /** The last copy off the server (ADR 0060); absent while backups stay on the server only. */
  offsite?: { at: string; ok: boolean; snapshot?: string; keepDays?: number; problem?: string };
  /** Restoring to a point in time (ADR 0064); absent where Postgres doesn't archive yet. */
  pointInTime?: { at: string; ok: boolean; bases?: number; earliest?: string; archivedAt?: string; copiedAt?: string; lastTest?: { at: string; ok: boolean }; problem?: string };
  lastRestoreTest?: { at: string; ok: boolean; from?: 'local' | 'offsite'; file?: string; seconds?: number; people?: number; apps?: number; auditEntries?: number; problem?: string };
}

/** Whether AUGUR can send email through the organisation's relay. */
export interface EmailStatus {
  state: 'off' | 'ok' | 'attention';
  problem?: string;
  relay?: string;
  from?: string;
  checkedAt?: string;
}

/** The gateway's GET /status: every part, backups, email and whether AUGUR is open to the internet. */
export interface PlatformStatus {
  components: ComponentStatus[];
  backups?: BackupStatus;
  publicAccess?: { open: boolean; until?: string };
  email?: EmailStatus;
}

/** How one app's part is taking the events pushed to it (the events service's GET /deliveries). */
export interface EventDelivery {
  app: string;
  failures: number;
  nextAt: string | null;
  lastError: string | null;
  failingSince: string | null;
  deliveredAt: string | null;
  dropped: number;
  droppedAt: string | null;
  state: 'ok' | 'retrying' | 'stalled';
  words: string;
}

/** Whether events are pushed to apps' parts at all, and when not, why and who can change that. */
export type EventPushing = { on: true; problem?: string } | { on: false; why: string; whoCanChange: string };

export interface Deliveries {
  deliveries: EventDelivery[];
  pushing: EventPushing;
}
