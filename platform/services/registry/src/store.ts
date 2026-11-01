import pg from 'pg';
import type { Scope } from '@augur/service-kit';
import { steadyPool } from '@augur/service-kit';
import type { AppEntry } from './manifest.ts';
import { AUGUR_UNIT, defaultDesiredState, type StoredDesiredState } from './desired-state.ts';

/** Another app took the route first (two registrations racing). */
export class RouteTakenError extends Error {}

/** A registered app with what the catalogue knows about it beyond its manifest. */
export interface AppRecord {
  entry: AppEntry;
  /** False when an admin has turned it off: it stays registered but nobody is offered it. */
  enabled: boolean;
  registeredBy: string;
  registeredAt: string;
  updatedAt: string;
  /** Set when an admin has held the app at this version: registering again records the new version but doesn't serve it. */
  pinnedVersion?: string;
  /**
   * The scopes an admin has let the app use. Its first registration grants
   * what it asks for (an admin already gave it a sign-in); a later version that
   * asks for more is served, but gets the extra only once an admin grants it.
   */
  grantedScopes: Scope[];
  /** Set when an admin has lowered how much the app may be sent in one request, in MB. */
  uploadLimitMb?: number;
  /** What admins set the app's own settings (its manifest's `settings`) to, by setting id. Unset ones take their default. */
  settings?: Record<string, SettingValue>;
  /** Who admins gave each of the app's feature previews (its manifest's `previews`) to, by preview id. Unset ones take the server's default. */
  featurePreviews?: Record<string, FeaturePreviewSetting>;
  /**
   * Where the gateway sends /api/<id>/… for this app, such as http://app-expenses:8090: set by the platform
   * service that runs it, or an admin. Unset, the app's service is wherever the gateway's APP_UPSTREAMS says.
   */
  upstream?: string;
}

/** Who gets a feature preview: nobody, those who turn it on, or everyone. */
export type FeaturePreviewMode = 'off' | 'opt-in' | 'everyone';

/** An admin's choice for one of an app's feature previews. */
export interface FeaturePreviewSetting {
  mode: FeaturePreviewMode;
  setBy: string;
  setAt: string;
}

/** One person who turned one of an app's feature previews on for themselves. */
export interface FeatureOptIn {
  person: string;
  app: string;
  preview: string;
}

/** An admin's value for one of an app's settings. */
export interface SettingValue {
  value: number;
  setBy: string;
  setAt: string;
}

/**
 * What one floor says about one app. `on` and `off` install it there or take
 * it away, and carry on to the teams below unless one of them says otherwise
 * (or `carriesOn` is false). `blocked` is the guardrail layer: off there and on
 * every floor below, whatever those floors say.
 */
export interface FloorRule {
  app: string;
  workspace: string;
  state: 'on' | 'off' | 'blocked';
  carriesOn: boolean;
  setBy: string;
  setAt: string;
}

/** One version of an app as it registered, kept so an admin can go back to it. */
export interface AppVersion {
  version: string;
  entry: AppEntry;
  registeredBy: string;
  registeredAt: string;
}

/**
 * One version of an app's frontend, kept in the frontends bucket at apps/<app>/<version>/ and served
 * from there. Kept apart from the app's versions: an app gives its frontend before it registers.
 */
export interface StoredFrontend {
  app: string;
  version: string;
  /** sha256 of the tarball it came in, `sha256:<hex>`. A version's frontend never changes. */
  digest: string;
  /** Every file's path inside it, so an entry is only pointed at a file that's there. */
  files: string[];
  bytes: number;
  publishedBy: string;
  publishedAt: string;
}

/** How many versions of each app are kept. A pinned version is kept even when older. */
export const KEPT_VERSIONS = 5;

/** The admin asked for a version the registry doesn't have. */
export class UnknownVersionError extends Error {}

/** An origin an admin has allowed apps to load from. */
export interface AllowedOrigin {
  origin: string;
  addedBy: string;
  addedAt: string;
}

/** The steps an updater takes, in order; `roll-back` only when one fails. */
export const UPGRADE_STEPS = ['preflight', 'backup', 'pull', 'roll-forward', 'verify', 'roll-back'] as const;
export type UpgradeStep = (typeof UPGRADE_STEPS)[number];

/** Where one step of an upgrade stands. */
export interface UpgradeStepState {
  step: UpgradeStep;
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/**
 * An upgrade an admin asked for. It waits (`requested`) until the deployment's updater picks it
 * up (`running`), and ends `done`, `rolled-back` (back on the old version), `failed` (it needs a
 * person) or `cancelled` (an admin took it back before it started).
 */
export interface Upgrade {
  id: string;
  from: string;
  version: string;
  /** Each part's image by digest, from the release file: all the updater will run. */
  images: Record<string, string>;
  requestedBy: string;
  /** Who asked, by name, as they were signed in then; absent on upgrades asked for before names were kept. */
  requestedByName?: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'rolled-back' | 'failed' | 'cancelled';
  steps: UpgradeStepState[];
  message?: string;
  finishedAt?: string;
  /** Who marked it looked at, once it finished (Upgrade Centre, Needs you). */
  seenBy?: string;
  seenAt?: string;
}

export type UpgradeOutcome = 'done' | 'rolled-back' | 'failed';

/** What an app release file says (scripts/app-release.mjs): the bundle a deployment's app runner installs. */
export interface AppRelease {
  schema: 'augur.app-release/v1';
  id: string;
  version: string;
  channel: string;
  releasedAt?: string;
  sdk?: string;
  manifest: AppEntry;
  /** The service image, by digest; null for an app with no service. */
  service: { image: string } | null;
  frontend: { artifact: string; digest: string; mediaType: string } | null;
  /** The repository and workflow that built and signed both parts. */
  signer: { repository: string; workflow: string };
  asks?: Record<string, unknown>;
  notes?: string;
  /** For a pull request's build: which one, and where to read it. */
  preview?: { pr: number; title?: string; url?: string };
}

/** The steps the app runner takes, in order: `remove` only for a removal. */
export const APP_JOB_STEPS = ['verify', 'storage', 'sign-in', 'start', 'health', 'switch', 'retire', 'remove'] as const;
export type AppJobStep = (typeof APP_JOB_STEPS)[number];

export interface AppJobStepState {
  step: AppJobStep;
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/**
 * Something an admin asked the deployment's app runner to do to one app: install a release (a first
 * install, an upgrade or going back are all the same), or remove the app's containers. It waits
 * (`requested`) until the runner picks it up (`running`), and ends `done`, `failed` (what was
 * running before keeps running) or `cancelled`. One app has at most one open at a time.
 *
 * A pull request's preview is the same, with `pr`: `preview` runs that build beside the installed
 * app, with its own scratch storage, and `preview-remove` takes it and its storage away. Each pull
 * request has at most one open at a time, apart from the app's own.
 */
export interface AppJob {
  id: string;
  app: string;
  action: 'install' | 'remove' | 'preview' | 'preview-remove';
  /** For an install or a preview: the release to run, as its app-release.json says. */
  release?: AppRelease;
  /** For a preview: the pull request it's built from. */
  pr?: number;
  /** For a preview that's running: where the gateway reaches it, as the runner said. */
  upstream?: string;
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'failed' | 'cancelled';
  steps: AppJobStepState[];
  message?: string;
  finishedAt?: string;
  /** Who marked it looked at, once it finished (Upgrade Centre, Needs you). */
  seenBy?: string;
  seenAt?: string;
}

export type AppJobOutcome = 'done' | 'failed';

/** Which releases of an installed app a deployment takes, and whether new ones install by themselves. */
export interface AppFollow {
  app: string;
  channel: 'stable' | 'beta' | 'dev';
  policy: 'automatic' | 'ask' | 'hold';
  setBy: string;
  setAt: string;
}

/** An app the runner installed, and the release it's on. */
export interface InstalledApp {
  app: string;
  release: AppRelease;
  installedAt: string;
}

/** A pull request's build of an installed app, running beside it for the app's developers to try. */
export interface RunningPreview {
  app: string;
  pr: number;
  release: AppRelease;
  /** Where the gateway sends a developer's calls to the app while they've chosen this preview. */
  upstream: string;
  /** When this build of it started. */
  startedAt: string;
}

/** Someone who may try an app's previews (Admin → Apps). */
export interface AppDeveloper {
  app: string;
  person: string;
  addedBy: string;
  addedAt: string;
}

/** The preview a developer is using instead of the installed app. */
export interface PreviewChoice {
  person: string;
  app: string;
  pr: number;
}

/** Where registered apps are kept. */
export interface AppStore {
  /** Origins apps may load their entry from, besides the platform itself. */
  origins(): Promise<AllowedOrigin[]>;
  /** Allows an origin; false when it already was. */
  allowOrigin(origin: string, addedBy: string): Promise<boolean>;
  /** Stops allowing an origin; false when it wasn't. */
  removeOrigin(origin: string): Promise<boolean>;
  list(): Promise<AppEntry[]>;
  /** Every registered app with its state, by id. */
  records(): Promise<AppRecord[]>;
  /** Turns an app on or off. Re-registering doesn't change it. False when there is no such app. */
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  /**
   * Adds or replaces an app and records the version in its history; true when it was new.
   * A pinned app keeps serving its pinned version.
   */
  put(entry: AppEntry, registeredBy: string): Promise<boolean>;
  /** An app's kept versions, newest first. */
  versions(id: string): Promise<AppVersion[]>;
  /**
   * Serves one of an app's kept versions and holds it there, or with `null` lets go and serves
   * the newest. Undefined when there is no such app; UnknownVersionError when it has no such version.
   */
  pin(id: string, version: string | null): Promise<AppRecord | undefined>;
  /** Removes an app, with its versions, frontends and floor rules; false when there was none. */
  remove(id: string): Promise<boolean>;
  /** The frontends kept for one app, or for every app. */
  frontends(app?: string): Promise<StoredFrontend[]>;
  /** Records a version's frontend once its files are in the bucket; a version that has one keeps it. */
  putFrontend(frontend: Omit<StoredFrontend, 'publishedAt'>): Promise<StoredFrontend>;
  /** Lets an app use these scopes. Undefined when there is no such app. */
  grant(id: string, scopes: Scope[]): Promise<AppRecord | undefined>;
  /** Lowers how much the app may be sent in one request, in MB, or with `null` goes back to what its manifest asks. Undefined when there is no such app. */
  limitUploads(id: string, mb: number | null): Promise<AppRecord | undefined>;
  /** Sets where the gateway reaches the app's service, or with `null` forgets it. Undefined when there is no such app. */
  setUpstream(id: string, url: string | null): Promise<AppRecord | undefined>;
  /** Sets one of the app's settings, or with `null` takes the admin's value away. Undefined when there is no such app. */
  setSetting(id: string, setting: string, value: number | null, by: string): Promise<AppRecord | undefined>;
  /** What floors say about apps: one app's, or every app's. */
  rules(app?: string): Promise<FloorRule[]>;
  /** Sets what one floor says about an app, replacing what it said before. */
  setRule(rule: Omit<FloorRule, 'setAt'>): Promise<FloorRule>;
  /** Takes a floor's rule away, so the app does what the floors above say; false when there was none. */
  clearRule(app: string, workspace: string): Promise<boolean>;
  /** The latest upgrade asked for, whatever its state. */
  upgrade(): Promise<Upgrade | undefined>;
  /** Every upgrade asked for, newest first, at most `limit`: the Updates page's history. */
  upgrades(limit?: number): Promise<Upgrade[]>;
  /** Records an upgrade to run; false when one is already waiting or under way. */
  requestUpgrade(upgrade: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy' | 'requestedByName'>): Promise<boolean>;
  /**
   * Records a step of the open upgrade `id`, which starts it, and with `outcome` ends it.
   * Undefined when `id` isn't the open upgrade.
   */
  progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }): Promise<Upgrade | undefined>;
  /** Takes back an upgrade nothing has started yet; false when there is none waiting. */
  cancelUpgrade(id: string): Promise<boolean>;
  /** The app runner's latest jobs, newest first: one app's, or every app's. */
  appJobs(app?: string): Promise<AppJob[]>;
  /** The oldest job not yet finished, for the app runner to do next. */
  nextAppJob(): Promise<AppJob | undefined>;
  /** Records a job for the app runner; false when that app already has one waiting or under way. */
  requestAppJob(job: Pick<AppJob, 'id' | 'app' | 'action' | 'release' | 'pr' | 'requestedBy'>): Promise<boolean>;
  /**
   * Records a step of the open job `id`, which starts it, and with `outcome` ends it (with `upstream`,
   * where a preview it started is). Undefined when `id` isn't open.
   */
  progressAppJob(id: string, step: Omit<AppJobStepState, 'at'>, outcome?: { state: AppJobOutcome; message?: string; upstream?: string }): Promise<AppJob | undefined>;
  /** Takes back a job the runner hasn't started; false when it isn't waiting. */
  cancelAppJob(id: string): Promise<boolean>;
  /** The apps the runner has installed and not removed since: each one's last finished install. */
  installedApps(): Promise<InstalledApp[]>;
  /** What admins chose for each installed app's updates; an app with none follows stable, automatically. */
  follows(): Promise<AppFollow[]>;
  setFollow(follow: Omit<AppFollow, 'setAt'>): Promise<AppFollow>;
  /** Each unit's desired state an admin set (ADR 0020); a unit with none has its default. */
  desiredStates(): Promise<StoredDesiredState[]>;
  /** Sets a unit's desired state, and keeps it in the unit's history. */
  setDesiredState(state: Omit<StoredDesiredState, 'setAt'>): Promise<StoredDesiredState>;
  /** The records a unit has had, newest first (at most 50). */
  desiredStateHistory(unit: string): Promise<StoredDesiredState[]>;
  /** Marks a finished upgrade or app job as looked at; false when there's no such finished one. */
  markSeen(kind: 'upgrade' | 'app-job', id: string, by: string): Promise<boolean>;
  /** The previews running now: each pull request's last finished preview job, unless it was a removal. */
  runningPreviews(): Promise<RunningPreview[]>;
  /** Who may try previews: of one app, or of every app. */
  developers(app?: string): Promise<AppDeveloper[]>;
  /** Replaces an app's developers. Those taken off lose their choice of its previews. */
  setDevelopers(app: string, people: string[], by: string): Promise<AppDeveloper[]>;
  /** Which previews people chose: one person's, or everyone's. */
  previewChoices(person?: string): Promise<PreviewChoice[]>;
  /** Uses one of an app's previews instead of the app, or with `null` goes back to the app. */
  choosePreview(person: string, app: string, pr: number | null): Promise<void>;
  /** Sets who gets one of the app's feature previews, or with `null` puts it back to the server's default. Undefined when there is no such app. */
  setFeaturePreview(id: string, preview: string, mode: FeaturePreviewMode | null, by: string): Promise<AppRecord | undefined>;
  /** Who turned which feature previews on: one person's, or of one app, or everyone's. */
  featureOptIns(filter?: { person?: string; app?: string }): Promise<FeatureOptIn[]>;
  /** Turns one of an app's feature previews on or off for one person. */
  setFeatureOptIn(person: string, app: string, preview: string, on: boolean): Promise<void>;
}

/** A step's new state replaces its last one, so each step shows once. */
const withStep = <S extends { step: string }>(steps: S[], step: S) => [...steps.filter((s) => s.step !== step.step), step];
const isOpen = (u?: { state: string }) => u?.state === 'requested' || u?.state === 'running';
/** How many of the runner's jobs are listed. */
const APP_JOBS_LISTED = 50;
/** How many upgrades the Updates page's history lists. */
const UPGRADES_LISTED = 50;

/** How many records of a unit's desired state its history lists. */
const DESIRED_HISTORY_LISTED = 50;

/** An app's follow, read from its desired state. */
const followsOf = (states: StoredDesiredState[]): AppFollow[] =>
  states.filter((s) => s.unit !== AUGUR_UNIT).map((s) => ({ app: s.unit, channel: s.channel, policy: s.policy, setBy: s.setBy, setAt: s.setAt }));

/** A follow set from Admin → Apps changes only its app's channel and policy; the rest of the record stays. */
const withFollow = (states: StoredDesiredState[], f: Omit<AppFollow, 'setAt'>): Omit<StoredDesiredState, 'setAt'> => {
  const { timeZone: _zone, setAt: _at, ...base } = states.find((s) => s.unit === f.app) ?? defaultDesiredState(f.app, 'production');
  const kept = states.find((s) => s.unit === f.app)?.timeZone;
  return { ...base, ...(kept ? { timeZone: kept } : {}), channel: f.channel, policy: f.policy, setBy: f.setBy };
};

/** For tests, and for running the registry locally without Postgres. Forgets everything on restart. */
export class MemoryAppStore implements AppStore {
  private apps = new Map<string, AppRecord>();
  private history = new Map<string, AppVersion[]>();
  private allowed = new Map<string, AllowedOrigin>();
  private floorRules: FloorRule[] = [];
  private upgradeList: Upgrade[] = [];
  private kept: StoredFrontend[] = [];
  private jobs: AppJob[] = [];
  private desired = new Map<string, StoredDesiredState>();
  private desiredHistory: StoredDesiredState[] = [];
  private devs: AppDeveloper[] = [];
  private choices: PreviewChoice[] = [];
  private optIns: FeatureOptIn[] = [];

  async setFeaturePreview(id: string, preview: string, mode: FeaturePreviewMode | null, by: string) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    const previews = { ...record.featurePreviews };
    if (mode === null) delete previews[preview];
    else previews[preview] = { mode, setBy: by, setAt: new Date().toISOString() };
    if (Object.keys(previews).length) record.featurePreviews = previews;
    else delete record.featurePreviews;
    return structuredClone(record);
  }

  async featureOptIns(filter: { person?: string; app?: string } = {}) {
    return this.optIns.filter((o) => (!filter.person || o.person === filter.person) && (!filter.app || o.app === filter.app)).map((o) => ({ ...o }));
  }

  async setFeatureOptIn(person: string, app: string, preview: string, on: boolean) {
    this.optIns = this.optIns.filter((o) => o.person !== person || o.app !== app || o.preview !== preview);
    if (on) this.optIns.push({ person, app, preview });
  }

  async runningPreviews() {
    const last = new Map<string, AppJob>();
    for (const j of this.jobs) if (j.state === 'done' && j.pr !== undefined) last.set(`${j.app}#${j.pr}`, j);
    return [...last.values()]
      .filter((j) => j.action === 'preview' && j.release && j.upstream)
      .map((j) => ({ app: j.app, pr: j.pr!, release: structuredClone(j.release!), upstream: j.upstream!, startedAt: j.finishedAt! }));
  }

  async developers(app?: string) {
    return this.devs.filter((d) => !app || d.app === app).map((d) => ({ ...d }));
  }

  async setDevelopers(app: string, people: string[], by: string) {
    const at = new Date().toISOString();
    const kept = this.devs.filter((d) => d.app === app && people.includes(d.person));
    const added = people.filter((p) => !kept.some((d) => d.person === p)).map((person) => ({ app, person, addedBy: by, addedAt: at }));
    this.devs = [...this.devs.filter((d) => d.app !== app), ...kept, ...added];
    this.choices = this.choices.filter((c) => c.app !== app || people.includes(c.person));
    return this.developers(app);
  }

  async previewChoices(person?: string) {
    return this.choices.filter((c) => !person || c.person === person).map((c) => ({ ...c }));
  }

  async choosePreview(person: string, app: string, pr: number | null) {
    this.choices = this.choices.filter((c) => c.person !== person || c.app !== app);
    if (pr !== null) this.choices.push({ person, app, pr });
  }

  async installedApps() {
    const last = new Map<string, AppJob>();
    for (const j of this.jobs) if (j.state === 'done' && j.pr === undefined) last.set(j.app, j);
    return [...last.values()].filter((j) => j.action === 'install' && j.release).map((j) => ({ app: j.app, release: structuredClone(j.release!), installedAt: j.finishedAt! }));
  }

  async follows() {
    return followsOf(await this.desiredStates());
  }

  async setFollow(follow: Omit<AppFollow, 'setAt'>) {
    const set = await this.setDesiredState(withFollow(await this.desiredStates(), follow));
    return { ...follow, setAt: set.setAt };
  }

  async desiredStates() {
    return [...this.desired.values()].sort((a, b) => a.unit.localeCompare(b.unit)).map((s) => structuredClone(s));
  }

  async setDesiredState(state: Omit<StoredDesiredState, 'setAt'>) {
    const set = { ...structuredClone(state), setAt: new Date().toISOString() };
    this.desired.set(state.unit, set);
    this.desiredHistory.push(set);
    return structuredClone(set);
  }

  async desiredStateHistory(unit: string) {
    return this.desiredHistory.filter((s) => s.unit === unit).slice(-DESIRED_HISTORY_LISTED).reverse().map((s) => structuredClone(s));
  }

  async markSeen(kind: 'upgrade' | 'app-job', id: string, by: string) {
    const found = kind === 'upgrade' ? this.upgradeList.find((u) => u.id === id) : this.jobs.find((j) => j.id === id);
    if (!found?.finishedAt) return false;
    found.seenBy = by;
    found.seenAt = new Date().toISOString();
    return true;
  }

  async appJobs(app?: string) {
    return this.jobs.filter((j) => !app || j.app === app).slice(-APP_JOBS_LISTED).reverse().map((j) => structuredClone(j));
  }

  async nextAppJob() {
    const job = this.jobs.find((j) => isOpen(j));
    return job && structuredClone(job);
  }

  async requestAppJob(job: Pick<AppJob, 'id' | 'app' | 'action' | 'release' | 'pr' | 'requestedBy'>) {
    if (this.jobs.some((j) => j.app === job.app && j.pr === job.pr && isOpen(j))) return false;
    this.jobs.push({ ...structuredClone(job), requestedAt: new Date().toISOString(), state: 'requested', steps: [] });
    return true;
  }

  async progressAppJob(id: string, step: Omit<AppJobStepState, 'at'>, outcome?: { state: AppJobOutcome; message?: string; upstream?: string }) {
    const job = this.jobs.find((j) => j.id === id && isOpen(j));
    if (!job) return undefined;
    const at = new Date().toISOString();
    job.steps = withStep(job.steps, { ...step, at });
    job.state = outcome?.state ?? 'running';
    if (outcome) {
      job.finishedAt = at;
      if (outcome.message) job.message = outcome.message;
      if (outcome.upstream) job.upstream = outcome.upstream;
    }
    return structuredClone(job);
  }

  async cancelAppJob(id: string) {
    const job = this.jobs.find((j) => j.id === id && j.state === 'requested');
    if (!job) return false;
    job.state = 'cancelled';
    job.finishedAt = new Date().toISOString();
    return true;
  }

  async frontends(app?: string) {
    return this.kept.filter((f) => !app || f.app === app).map((f) => structuredClone(f));
  }

  async putFrontend(frontend: Omit<StoredFrontend, 'publishedAt'>) {
    const had = this.kept.find((f) => f.app === frontend.app && f.version === frontend.version);
    if (had) return structuredClone(had);
    const stored = { ...frontend, files: [...frontend.files], publishedAt: new Date().toISOString() };
    this.kept.push(stored);
    return structuredClone(stored);
  }

  async upgrade() {
    const last = this.upgradeList.at(-1);
    return last && structuredClone(last);
  }

  async upgrades(limit = UPGRADES_LISTED) {
    return structuredClone(this.upgradeList.slice(-limit).reverse());
  }

  async requestUpgrade(u: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy' | 'requestedByName'>) {
    if (isOpen(this.upgradeList.at(-1))) return false;
    this.upgradeList.push({ ...u, requestedAt: new Date().toISOString(), state: 'requested', steps: [] });
    return true;
  }

  async progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }) {
    const u = this.upgradeList.at(-1);
    if (!u || u.id !== id || !isOpen(u)) return undefined;
    const at = new Date().toISOString();
    u.steps = withStep(u.steps, { ...step, at });
    u.state = outcome?.state ?? 'running';
    if (outcome) {
      u.finishedAt = at;
      if (outcome.message) u.message = outcome.message;
    }
    return structuredClone(u);
  }

  async cancelUpgrade(id: string) {
    const u = this.upgradeList.at(-1);
    if (!u || u.id !== id || u.state !== 'requested') return false;
    u.state = 'cancelled';
    u.finishedAt = new Date().toISOString();
    return true;
  }

  async origins() {
    return [...this.allowed.values()].sort((a, b) => a.origin.localeCompare(b.origin)).map((o) => ({ ...o }));
  }

  async allowOrigin(origin: string, addedBy: string) {
    if (this.allowed.has(origin)) return false;
    this.allowed.set(origin, { origin, addedBy, addedAt: new Date().toISOString() });
    return true;
  }

  async removeOrigin(origin: string) {
    return this.allowed.delete(origin);
  }

  async list() {
    return (await this.records()).map((r) => r.entry);
  }

  async records() {
    return [...this.apps.values()].sort((a, b) => a.entry.id.localeCompare(b.entry.id)).map((r) => structuredClone(r));
  }

  async put(entry: AppEntry, registeredBy: string) {
    const now = new Date().toISOString();
    const before = this.apps.get(entry.id);
    const kept = (this.history.get(entry.id) ?? []).filter((v) => v.version !== entry.version);
    kept.unshift({ version: entry.version, entry, registeredBy, registeredAt: now });
    this.history.set(entry.id, trim(kept, before?.pinnedVersion));
    if (before?.pinnedVersion) return false;
    this.apps.set(entry.id, {
      entry,
      enabled: before?.enabled ?? true,
      registeredBy,
      registeredAt: before?.registeredAt ?? now,
      updatedAt: now,
      grantedScopes: before?.grantedScopes ?? [...(entry.scopes ?? [])],
      ...(before?.uploadLimitMb !== undefined ? { uploadLimitMb: before.uploadLimitMb } : {}),
      ...(before?.settings ? { settings: before.settings } : {}),
      ...(before?.featurePreviews ? { featurePreviews: before.featurePreviews } : {}),
      ...(before?.upstream ? { upstream: before.upstream } : {}),
    });
    return !before;
  }

  async versions(id: string) {
    return structuredClone(this.history.get(id) ?? []);
  }

  async pin(id: string, version: string | null) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    const kept = this.history.get(id) ?? [];
    const target = version === null ? kept[0] : kept.find((v) => v.version === version);
    if (!target) throw new UnknownVersionError(`${record.entry.name} has no version ${version} kept.`);
    record.entry = target.entry;
    record.updatedAt = new Date().toISOString();
    if (version === null) delete record.pinnedVersion;
    else record.pinnedVersion = version;
    return structuredClone(record);
  }

  async setEnabled(id: string, enabled: boolean) {
    const record = this.apps.get(id);
    if (record) record.enabled = enabled;
    return Boolean(record);
  }

  async remove(id: string) {
    this.history.delete(id);
    this.optIns = this.optIns.filter((o) => o.app !== id);
    this.kept = this.kept.filter((f) => f.app !== id);
    this.floorRules = this.floorRules.filter((r) => r.app !== id);
    return this.apps.delete(id);
  }

  async grant(id: string, scopes: Scope[]) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    record.grantedScopes = [...scopes];
    return structuredClone(record);
  }

  async limitUploads(id: string, mb: number | null) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    if (mb === null) delete record.uploadLimitMb;
    else record.uploadLimitMb = mb;
    return structuredClone(record);
  }

  async setUpstream(id: string, url: string | null) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    if (url === null) delete record.upstream;
    else record.upstream = url;
    return structuredClone(record);
  }

  async setSetting(id: string, setting: string, value: number | null, by: string) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    const settings = { ...record.settings };
    if (value === null) delete settings[setting];
    else settings[setting] = { value, setBy: by, setAt: new Date().toISOString() };
    if (Object.keys(settings).length) record.settings = settings;
    else delete record.settings;
    return structuredClone(record);
  }

  async rules(app?: string) {
    return this.floorRules.filter((r) => !app || r.app === app).map((r) => ({ ...r }));
  }

  async setRule(rule: Omit<FloorRule, 'setAt'>) {
    const set = { ...rule, carriesOn: rule.state === 'blocked' || rule.carriesOn, setAt: new Date().toISOString() };
    this.floorRules = [...this.floorRules.filter((r) => !(r.app === rule.app && r.workspace === rule.workspace)), set];
    return { ...set };
  }

  async clearRule(app: string, workspace: string) {
    const before = this.floorRules.length;
    this.floorRules = this.floorRules.filter((r) => !(r.app === app && r.workspace === workspace));
    return this.floorRules.length < before;
  }
}

/** Newest first, the newest KEPT_VERSIONS plus the pinned one wherever it is. */
const trim = (versions: AppVersion[], pinned?: string) =>
  versions.filter((v, i) => i < KEPT_VERSIONS || v.version === pinned);

/**
 * Schema changes, applied in order and recorded so each runs once. The registry
 * owns the `registry` schema; no other service reads or writes it.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_apps',
    sql: `
      create table registry.apps (
        id text primary key,
        route text not null unique,
        manifest jsonb not null,
        registered_by text not null,
        registered_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
  },
  {
    id: '002_enabled',
    sql: 'alter table registry.apps add column enabled boolean not null default true;',
  },
  {
    id: '003_versions',
    sql: `
      alter table registry.apps add column pinned_version text;
      create table registry.app_versions (
        app_id text not null references registry.apps (id) on delete cascade,
        version text not null,
        manifest jsonb not null,
        registered_by text not null,
        registered_at timestamptz not null default now(),
        primary key (app_id, version)
      );
      -- Every app already registered starts its history with the version it serves.
      insert into registry.app_versions (app_id, version, manifest, registered_by, registered_at)
        select id, manifest->>'version', manifest, registered_by, updated_at from registry.apps;`,
  },
  {
    id: '004_origins',
    sql: `
      create table registry.allowed_origins (
        origin text primary key,
        added_by text not null,
        added_at timestamptz not null default now()
      );`,
  },
  {
    id: '005_floors',
    sql: `
      alter table registry.apps add column granted_scopes text[] not null default '{}';
      -- Apps already registered keep what they could do.
      update registry.apps set granted_scopes = array(select jsonb_array_elements_text(coalesce(manifest->'scopes', '[]'::jsonb)));
      -- Installs: an app on or off on a floor, and whether that carries on to the teams below.
      create table registry.installs (
        app_id text not null references registry.apps (id) on delete cascade,
        workspace_id text not null,
        enabled boolean not null,
        carries_on boolean not null default true,
        set_by text not null,
        set_at timestamptz not null default now(),
        primary key (app_id, workspace_id)
      );
      -- Guardrails: a floor that blocks an app for itself and every floor below.
      create table registry.guardrails (
        app_id text not null references registry.apps (id) on delete cascade,
        workspace_id text not null,
        set_by text not null,
        set_at timestamptz not null default now(),
        primary key (app_id, workspace_id)
      );`,
  },
  {
    id: '006_upgrades',
    sql: `
      -- Upgrades admins asked for, and how the deployment's updater got on with each.
      create table registry.upgrades (
        id text primary key,
        from_version text not null,
        version text not null,
        images jsonb not null,
        requested_by text not null,
        requested_at timestamptz not null default now(),
        state text not null default 'requested',
        steps jsonb not null default '[]',
        message text,
        finished_at timestamptz
      );
      -- At most one waiting or under way, however many admins press Upgrade at once.
      create unique index upgrades_one_open on registry.upgrades ((true)) where state in ('requested', 'running');`,
  },
  {
    id: '007_upload_limit',
    sql: `
      -- An admin's lower limit on what an app may be sent in one request, in MB; null keeps its manifest's.
      alter table registry.apps add column upload_limit_mb integer;`,
  },
  {
    id: '008_settings',
    sql: `
      -- What admins set an app's own settings to: { "<setting>": { "value", "setBy", "setAt" } }. Unset ones take their default.
      alter table registry.apps add column settings jsonb not null default '{}'::jsonb;`,
  },
  {
    id: '009_frontends',
    sql: `
      -- Apps' frontends kept by version in the frontends bucket. Not tied to registry.apps: an app gives its
      -- frontend before it registers the version, so the shell is never given code that isn't there yet.
      create table registry.app_frontends (
        app_id text not null,
        version text not null,
        digest text not null,
        files jsonb not null,
        bytes bigint not null,
        published_by text not null,
        published_at timestamptz not null default now(),
        primary key (app_id, version)
      );`,
  },
  {
    id: '010_upstream',
    sql: `
      -- Where the gateway reaches the app's service, set by whatever runs it; null leaves it to APP_UPSTREAMS.
      alter table registry.apps add column upstream text;`,
  },
  {
    id: '011_app_jobs',
    sql: `
      -- What admins asked the deployment's app runner to do (install a release, remove an app), and how it went.
      -- Not tied to registry.apps: an app is installed before it first registers.
      create table registry.app_jobs (
        id text primary key,
        app_id text not null,
        action text not null,
        release jsonb,
        requested_by text not null,
        requested_at timestamptz not null default now(),
        state text not null default 'requested',
        steps jsonb not null default '[]',
        message text,
        finished_at timestamptz
      );
      -- At most one waiting or under way for each app.
      create unique index app_jobs_one_open on registry.app_jobs (app_id) where state in ('requested', 'running');`,
  },
  {
    id: '012_app_follows',
    sql: `
      -- Which releases of each installed app the deployment takes, and whether they install by themselves.
      create table registry.app_follows (
        app_id text primary key,
        channel text not null,
        policy text not null,
        set_by text not null,
        set_at timestamptz not null default now()
      );`,
  },
  {
    id: '013_previews',
    sql: `
      -- Pull requests' previews are app runner jobs too: the pull request, and where its preview answers once running.
      alter table registry.app_jobs add column pr integer;
      alter table registry.app_jobs add column upstream text;
      -- At most one waiting or under way for each app, and for each of its pull requests.
      drop index registry.app_jobs_one_open;
      create unique index app_jobs_one_open on registry.app_jobs (app_id, coalesce(pr, 0)) where state in ('requested', 'running');
      -- Who may try each app's previews, and which preview each of them is using instead of the app.
      create table registry.app_developers (
        app_id text not null,
        person_id text not null,
        added_by text not null,
        added_at timestamptz not null default now(),
        primary key (app_id, person_id)
      );
      create table registry.preview_choices (
        person_id text not null,
        app_id text not null,
        pr integer not null,
        primary key (person_id, app_id)
      );`,
  },
  {
    id: '014_upgrade_names',
    sql: `
      -- Who asked for each upgrade, by name, for the Updates page's history.
      alter table registry.upgrades add column requested_by_name text;`,
  },
  {
    id: '015_feature_previews',
    sql: `
      -- Who admins gave each of an app's feature previews to: { "<preview>": { "mode", "setBy", "setAt" } }. Unset ones take the server's default.
      alter table registry.apps add column feature_previews jsonb not null default '{}'::jsonb;
      -- Who turned which feature previews on for themselves.
      create table registry.feature_opt_ins (
        person_id text not null,
        app_id text not null,
        preview_id text not null,
        opted_at timestamptz not null default now(),
        primary key (person_id, app_id, preview_id)
      );`,
  },
  {
    id: '016_desired_state',
    sql: `
      -- Each unit's desired state (ADR 0020): AUGUR ('augur') and each installed app. A null time_zone takes the deployment's.
      create table registry.desired_states (
        unit text primary key,
        channel text not null,
        policy text not null,
        automatic_up_to text not null,
        pin text,
        windows jsonb not null default '[]',
        time_zone text,
        set_by text not null,
        set_at timestamptz not null default now()
      );
      -- Every record set, newest last, for the Upgrade Centre's history.
      create table registry.desired_state_history (
        id bigserial primary key,
        unit text not null,
        record jsonb not null,
        set_by text not null,
        set_at timestamptz not null default now()
      );
      create index desired_state_history_unit on registry.desired_state_history (unit, id);
      -- What admins chose for apps before there were records: patch and minor releases, at any time.
      insert into registry.desired_states (unit, channel, policy, automatic_up_to, set_by, set_at)
        select app_id, channel, policy, 'minor', set_by, set_at from registry.app_follows;
      -- Who looked at a finished upgrade or app job, so Needs you is the same for every admin.
      alter table registry.upgrades add column seen_by text;
      alter table registry.upgrades add column seen_at timestamptz;
      alter table registry.app_jobs add column seen_by text;
      alter table registry.app_jobs add column seen_at timestamptz;`,
  },
];

type FrontendRow = { app_id: string; version: string; digest: string; files: string[]; bytes: string; published_by: string; published_at: Date };

const fromFrontendRow = (r: FrontendRow): StoredFrontend => ({
  app: r.app_id,
  version: r.version,
  digest: r.digest,
  files: r.files,
  bytes: Number(r.bytes),
  publishedBy: r.published_by,
  publishedAt: r.published_at.toISOString(),
});

type AppRow = {
  manifest: AppEntry;
  enabled: boolean;
  registered_by: string;
  registered_at: Date;
  updated_at: Date;
  pinned_version: string | null;
  granted_scopes: Scope[];
  upload_limit_mb: number | null;
  settings: Record<string, SettingValue> | null;
  feature_previews: Record<string, FeaturePreviewSetting> | null;
  upstream: string | null;
};

const fromAppRow = (r: AppRow): AppRecord => ({
  entry: r.manifest,
  enabled: r.enabled,
  registeredBy: r.registered_by,
  registeredAt: r.registered_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  ...(r.pinned_version ? { pinnedVersion: r.pinned_version } : {}),
  grantedScopes: r.granted_scopes,
  ...(r.upload_limit_mb !== null ? { uploadLimitMb: r.upload_limit_mb } : {}),
  ...(r.settings && Object.keys(r.settings).length ? { settings: r.settings } : {}),
  ...(r.feature_previews && Object.keys(r.feature_previews).length ? { featurePreviews: r.feature_previews } : {}),
  ...(r.upstream ? { upstream: r.upstream } : {}),
});

export class PgAppStore implements AppStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgAppStore(steadyPool(new pg.Pool({ connectionString })));
    await store.migrate();
    return store;
  }

  /** Brings the schema up to date. Safe to run from several instances at once. */
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('registry.migrate'))");
      // On a server the storage job makes the schema for registry's own login, which may not create schemas.
      const { rowCount: hasSchema } = await client.query("select 1 from pg_namespace where nspname = 'registry'");
      if (!hasSchema) await client.query('create schema registry');
      await client.query('create table if not exists registry.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from registry.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into registry.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async origins() {
    const { rows } = await this.pool.query<{ origin: string; added_by: string; added_at: Date }>('select * from registry.allowed_origins order by origin');
    return rows.map((r) => ({ origin: r.origin, addedBy: r.added_by, addedAt: r.added_at.toISOString() }));
  }

  async allowOrigin(origin: string, addedBy: string) {
    const { rowCount } = await this.pool.query('insert into registry.allowed_origins (origin, added_by) values ($1, $2) on conflict do nothing', [origin, addedBy]);
    return rowCount === 1;
  }

  async removeOrigin(origin: string) {
    const { rowCount } = await this.pool.query('delete from registry.allowed_origins where origin = $1', [origin]);
    return rowCount === 1;
  }

  async list() {
    const { rows } = await this.pool.query<{ manifest: AppEntry }>('select manifest from registry.apps order by id');
    return rows.map((r) => r.manifest);
  }

  async records() {
    const { rows } = await this.pool.query<AppRow>('select * from registry.apps order by id');
    return rows.map(fromAppRow);
  }

  async setEnabled(id: string, enabled: boolean) {
    const { rowCount } = await this.pool.query('update registry.apps set enabled = $2 where id = $1', [id, enabled]);
    return rowCount === 1;
  }

  async put(entry: AppEntry, registeredBy: string) {
    return this.transaction(async (client) => {
      // A pinned app keeps what it serves; only its history learns the new version.
      const { rows } = await client
        .query<{ created: boolean; pinned_version: string | null }>(
          `insert into registry.apps (id, route, manifest, registered_by, granted_scopes) values ($1, $2, $3, $4, $5)
           on conflict (id) do update set
             route = case when registry.apps.pinned_version is null then excluded.route else registry.apps.route end,
             manifest = case when registry.apps.pinned_version is null then excluded.manifest else registry.apps.manifest end,
             registered_by = case when registry.apps.pinned_version is null then excluded.registered_by else registry.apps.registered_by end,
             updated_at = case when registry.apps.pinned_version is null then now() else registry.apps.updated_at end
           returning (xmax = 0) as created, pinned_version`,
          [entry.id, entry.route, entry, registeredBy, entry.scopes ?? []],
        )
        .catch((err: { code?: string }) => {
          throw err.code === '23505' ? new RouteTakenError(`Another app already lives at ${entry.route}.`) : err;
        });
      await client.query(
        `insert into registry.app_versions (app_id, version, manifest, registered_by) values ($1, $2, $3, $4)
         on conflict (app_id, version) do update set manifest = excluded.manifest, registered_by = excluded.registered_by, registered_at = now()`,
        [entry.id, entry.version, entry, registeredBy],
      );
      await client.query(
        `delete from registry.app_versions v where v.app_id = $1
           and v.version is distinct from (select pinned_version from registry.apps where id = $1)
           and v.version not in (select version from registry.app_versions where app_id = $1 order by registered_at desc, version desc limit $2)`,
        [entry.id, KEPT_VERSIONS],
      );
      return rows[0].created;
    });
  }

  async versions(id: string) {
    const { rows } = await this.pool.query<{ version: string; manifest: AppEntry; registered_by: string; registered_at: Date }>(
      'select version, manifest, registered_by, registered_at from registry.app_versions where app_id = $1 order by registered_at desc, version desc',
      [id],
    );
    return rows.map((r) => ({ version: r.version, entry: r.manifest, registeredBy: r.registered_by, registeredAt: r.registered_at.toISOString() }));
  }

  async pin(id: string, version: string | null) {
    return this.transaction(async (client) => {
      const { rows: apps } = await client.query<AppRow>('select * from registry.apps where id = $1 for update', [id]);
      if (!apps.length) return undefined;
      const { rows } = await client.query<{ manifest: AppEntry }>(
        version === null
          ? 'select manifest from registry.app_versions where app_id = $1 order by registered_at desc, version desc limit 1'
          : 'select manifest from registry.app_versions where app_id = $1 and version = $2',
        version === null ? [id] : [id, version],
      );
      if (!rows.length) throw new UnknownVersionError(`${apps[0].manifest.name} has no version ${version} kept.`);
      const { rows: updated } = await client
        .query<AppRow>('update registry.apps set manifest = $2, route = $3, pinned_version = $4, updated_at = now() where id = $1 returning *', [
          id,
          rows[0].manifest,
          rows[0].manifest.route,
          version,
        ])
        .catch((err: { code?: string }) => {
          throw err.code === '23505' ? new RouteTakenError(`Another app now lives at ${rows[0].manifest.route}.`) : err;
        });
      return fromAppRow(updated[0]);
    });
  }

  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    const { rowCount } = await this.pool.query('delete from registry.apps where id = $1', [id]);
    await this.pool.query('delete from registry.app_frontends where app_id = $1', [id]);
    await this.pool.query('delete from registry.feature_opt_ins where app_id = $1', [id]);
    return rowCount === 1;
  }

  async frontends(app?: string) {
    const { rows } = await this.pool.query<FrontendRow>(
      app ? 'select * from registry.app_frontends where app_id = $1 order by published_at desc' : 'select * from registry.app_frontends order by app_id, published_at desc',
      app ? [app] : [],
    );
    return rows.map(fromFrontendRow);
  }

  async putFrontend(f: Omit<StoredFrontend, 'publishedAt'>) {
    await this.pool.query(
      `insert into registry.app_frontends (app_id, version, digest, files, bytes, published_by) values ($1, $2, $3, $4, $5, $6)
       on conflict (app_id, version) do nothing`,
      [f.app, f.version, f.digest, JSON.stringify(f.files), f.bytes, f.publishedBy],
    );
    const { rows } = await this.pool.query<FrontendRow>('select * from registry.app_frontends where app_id = $1 and version = $2', [f.app, f.version]);
    return fromFrontendRow(rows[0]);
  }

  async setUpstream(id: string, url: string | null) {
    const { rows } = await this.pool.query<AppRow>('update registry.apps set upstream = $2 where id = $1 returning *', [id, url]);
    return rows[0] && fromAppRow(rows[0]);
  }

  async grant(id: string, scopes: Scope[]) {
    const { rows } = await this.pool.query<AppRow>('update registry.apps set granted_scopes = $2 where id = $1 returning *', [id, scopes]);
    return rows[0] && fromAppRow(rows[0]);
  }

  async limitUploads(id: string, mb: number | null) {
    const { rows } = await this.pool.query<AppRow>('update registry.apps set upload_limit_mb = $2 where id = $1 returning *', [id, mb]);
    return rows[0] && fromAppRow(rows[0]);
  }

  async setSetting(id: string, setting: string, value: number | null, by: string) {
    const { rows } = await this.pool.query<AppRow>(
      value === null
        ? 'update registry.apps set settings = settings - $2 where id = $1 returning *'
        : `update registry.apps set settings = settings || jsonb_build_object($2::text, jsonb_build_object('value', $3::numeric, 'setBy', $4::text, 'setAt', $5::text)) where id = $1 returning *`,
      value === null ? [id, setting] : [id, setting, value, by, new Date().toISOString()],
    );
    return rows[0] && fromAppRow(rows[0]);
  }

  async rules(app?: string) {
    const { rows } = await this.pool.query<{ app_id: string; workspace_id: string; state: FloorRule['state']; carries_on: boolean; set_by: string; set_at: Date }>(
      `select app_id, workspace_id, case when enabled then 'on' else 'off' end as state, carries_on, set_by, set_at from registry.installs where $1::text is null or app_id = $1
       union all
       select app_id, workspace_id, 'blocked', true, set_by, set_at from registry.guardrails where $1::text is null or app_id = $1
       order by app_id, set_at`,
      [app ?? null],
    );
    return rows.map((r) => ({ app: r.app_id, workspace: r.workspace_id, state: r.state, carriesOn: r.carries_on, setBy: r.set_by, setAt: r.set_at.toISOString() }));
  }

  async setRule(rule: Omit<FloorRule, 'setAt'>) {
    return this.transaction(async (client) => {
      await client.query('delete from registry.installs where app_id = $1 and workspace_id = $2', [rule.app, rule.workspace]);
      await client.query('delete from registry.guardrails where app_id = $1 and workspace_id = $2', [rule.app, rule.workspace]);
      const { rows } = await client.query<{ set_at: Date }>(
        rule.state === 'blocked'
          ? 'insert into registry.guardrails (app_id, workspace_id, set_by) values ($1, $2, $3) returning set_at'
          : 'insert into registry.installs (app_id, workspace_id, set_by, enabled, carries_on) values ($1, $2, $3, $4, $5) returning set_at',
        rule.state === 'blocked' ? [rule.app, rule.workspace, rule.setBy] : [rule.app, rule.workspace, rule.setBy, rule.state === 'on', rule.carriesOn],
      );
      return { ...rule, ...(rule.state === 'blocked' ? { carriesOn: true } : {}), setAt: rows[0].set_at.toISOString() };
    });
  }

  async clearRule(app: string, workspace: string) {
    return this.transaction(async (client) => {
      const a = await client.query('delete from registry.installs where app_id = $1 and workspace_id = $2', [app, workspace]);
      const b = await client.query('delete from registry.guardrails where app_id = $1 and workspace_id = $2', [app, workspace]);
      return (a.rowCount ?? 0) + (b.rowCount ?? 0) > 0;
    });
  }

  async upgrade() {
    const { rows } = await this.pool.query<UpgradeRow>('select * from registry.upgrades order by requested_at desc limit 1');
    return rows[0] && fromUpgradeRow(rows[0]);
  }

  async upgrades(limit = UPGRADES_LISTED) {
    const { rows } = await this.pool.query<UpgradeRow>('select * from registry.upgrades order by requested_at desc limit $1', [limit]);
    return rows.map(fromUpgradeRow);
  }

  async requestUpgrade(u: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy' | 'requestedByName'>) {
    const { rowCount } = await this.pool.query(
      'insert into registry.upgrades (id, from_version, version, images, requested_by, requested_by_name) values ($1, $2, $3, $4, $5, $6) on conflict do nothing',
      [u.id, u.from, u.version, JSON.stringify(u.images), u.requestedBy, u.requestedByName ?? null],
    );
    return rowCount === 1;
  }

  async progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }) {
    return this.transaction(async (client) => {
      const { rows } = await client.query<UpgradeRow>("select * from registry.upgrades where id = $1 and state in ('requested', 'running') for update", [id]);
      if (!rows[0]) return undefined;
      const at = new Date().toISOString();
      const steps = withStep(fromUpgradeRow(rows[0]).steps, { ...step, at });
      const { rows: updated } = await client.query<UpgradeRow>(
        `update registry.upgrades set steps = $2, state = $3, message = coalesce($4, message), finished_at = case when $5 then now() else finished_at end
         where id = $1 returning *`,
        [id, JSON.stringify(steps), outcome?.state ?? 'running', outcome?.message ?? null, Boolean(outcome)],
      );
      return fromUpgradeRow(updated[0]);
    });
  }

  async cancelUpgrade(id: string) {
    const { rowCount } = await this.pool.query("update registry.upgrades set state = 'cancelled', finished_at = now() where id = $1 and state = 'requested'", [id]);
    return rowCount === 1;
  }

  async appJobs(app?: string) {
    const { rows } = await this.pool.query<AppJobRow>(
      'select * from registry.app_jobs where $1::text is null or app_id = $1 order by requested_at desc limit $2',
      [app ?? null, APP_JOBS_LISTED],
    );
    return rows.map(fromAppJobRow);
  }

  async nextAppJob() {
    const { rows } = await this.pool.query<AppJobRow>("select * from registry.app_jobs where state in ('requested', 'running') order by requested_at limit 1");
    return rows[0] && fromAppJobRow(rows[0]);
  }

  async requestAppJob(job: Pick<AppJob, 'id' | 'app' | 'action' | 'release' | 'pr' | 'requestedBy'>) {
    const { rowCount } = await this.pool.query(
      'insert into registry.app_jobs (id, app_id, action, release, pr, requested_by) values ($1, $2, $3, $4, $5, $6) on conflict do nothing',
      [job.id, job.app, job.action, job.release ? JSON.stringify(job.release) : null, job.pr ?? null, job.requestedBy],
    );
    return rowCount === 1;
  }

  async progressAppJob(id: string, step: Omit<AppJobStepState, 'at'>, outcome?: { state: AppJobOutcome; message?: string; upstream?: string }) {
    return this.transaction(async (client) => {
      const { rows } = await client.query<AppJobRow>("select * from registry.app_jobs where id = $1 and state in ('requested', 'running') for update", [id]);
      if (!rows[0]) return undefined;
      const steps = withStep(fromAppJobRow(rows[0]).steps, { ...step, at: new Date().toISOString() });
      const { rows: updated } = await client.query<AppJobRow>(
        `update registry.app_jobs set steps = $2, state = $3, message = coalesce($4, message), finished_at = case when $5 then now() else finished_at end,
           upstream = coalesce($6, upstream)
         where id = $1 returning *`,
        [id, JSON.stringify(steps), outcome?.state ?? 'running', outcome?.message ?? null, Boolean(outcome), outcome?.upstream ?? null],
      );
      return fromAppJobRow(updated[0]);
    });
  }

  async cancelAppJob(id: string) {
    const { rowCount } = await this.pool.query("update registry.app_jobs set state = 'cancelled', finished_at = now() where id = $1 and state = 'requested'", [id]);
    return rowCount === 1;
  }

  async installedApps() {
    const { rows } = await this.pool.query<AppJobRow>("select distinct on (app_id) * from registry.app_jobs where state = 'done' and pr is null order by app_id, finished_at desc");
    return rows.filter((r) => r.action === 'install' && r.release).map((r) => ({ app: r.app_id, release: r.release!, installedAt: r.finished_at!.toISOString() }));
  }

  async runningPreviews() {
    const { rows } = await this.pool.query<AppJobRow>(
      "select distinct on (app_id, pr) * from registry.app_jobs where state = 'done' and pr is not null order by app_id, pr, finished_at desc",
    );
    return rows
      .filter((r) => r.action === 'preview' && r.release && r.upstream)
      .map((r) => ({ app: r.app_id, pr: r.pr!, release: r.release!, upstream: r.upstream!, startedAt: r.finished_at!.toISOString() }));
  }

  async developers(app?: string) {
    const { rows } = await this.pool.query<{ app_id: string; person_id: string; added_by: string; added_at: Date }>(
      'select * from registry.app_developers where $1::text is null or app_id = $1 order by app_id, added_at',
      [app ?? null],
    );
    return rows.map((r) => ({ app: r.app_id, person: r.person_id, addedBy: r.added_by, addedAt: r.added_at.toISOString() }));
  }

  async setDevelopers(app: string, people: string[], by: string) {
    await this.transaction(async (client) => {
      await client.query('delete from registry.app_developers where app_id = $1 and not (person_id = any($2::text[]))', [app, people]);
      await client.query('delete from registry.preview_choices where app_id = $1 and not (person_id = any($2::text[]))', [app, people]);
      await client.query('insert into registry.app_developers (app_id, person_id, added_by) select $1, unnest($2::text[]), $3 on conflict do nothing', [app, people, by]);
    });
    return this.developers(app);
  }

  async previewChoices(person?: string) {
    const { rows } = await this.pool.query<{ person_id: string; app_id: string; pr: number }>(
      'select * from registry.preview_choices where $1::text is null or person_id = $1 order by person_id, app_id',
      [person ?? null],
    );
    return rows.map((r) => ({ person: r.person_id, app: r.app_id, pr: r.pr }));
  }

  async setFeaturePreview(id: string, preview: string, mode: FeaturePreviewMode | null, by: string) {
    const { rows } = await this.pool.query<AppRow>(
      mode === null
        ? 'update registry.apps set feature_previews = feature_previews - $2 where id = $1 returning *'
        : `update registry.apps set feature_previews = feature_previews || jsonb_build_object($2::text, jsonb_build_object('mode', $3::text, 'setBy', $4::text, 'setAt', $5::text)) where id = $1 returning *`,
      mode === null ? [id, preview] : [id, preview, mode, by, new Date().toISOString()],
    );
    return rows[0] && fromAppRow(rows[0]);
  }

  async featureOptIns(filter: { person?: string; app?: string } = {}) {
    const { rows } = await this.pool.query<{ person_id: string; app_id: string; preview_id: string }>(
      'select person_id, app_id, preview_id from registry.feature_opt_ins where ($1::text is null or person_id = $1) and ($2::text is null or app_id = $2) order by person_id, app_id, preview_id',
      [filter.person ?? null, filter.app ?? null],
    );
    return rows.map((r) => ({ person: r.person_id, app: r.app_id, preview: r.preview_id }));
  }

  async setFeatureOptIn(person: string, app: string, preview: string, on: boolean) {
    if (on) await this.pool.query('insert into registry.feature_opt_ins (person_id, app_id, preview_id) values ($1, $2, $3) on conflict do nothing', [person, app, preview]);
    else await this.pool.query('delete from registry.feature_opt_ins where person_id = $1 and app_id = $2 and preview_id = $3', [person, app, preview]);
  }

  async choosePreview(person: string, app: string, pr: number | null) {
    if (pr === null) await this.pool.query('delete from registry.preview_choices where person_id = $1 and app_id = $2', [person, app]);
    else await this.pool.query('insert into registry.preview_choices (person_id, app_id, pr) values ($1, $2, $3) on conflict (person_id, app_id) do update set pr = excluded.pr', [person, app, pr]);
  }

  async follows() {
    return followsOf(await this.desiredStates());
  }

  async setFollow(f: Omit<AppFollow, 'setAt'>) {
    const set = await this.setDesiredState(withFollow(await this.desiredStates(), f));
    return { ...f, setAt: set.setAt };
  }

  async desiredStates() {
    const { rows } = await this.pool.query<DesiredStateRow>('select * from registry.desired_states order by unit');
    return rows.map(fromDesiredStateRow);
  }

  async setDesiredState(state: Omit<StoredDesiredState, 'setAt'>) {
    return this.transaction(async (client) => {
      const { rows } = await client.query<DesiredStateRow>(
        `insert into registry.desired_states (unit, channel, policy, automatic_up_to, pin, windows, time_zone, set_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (unit) do update set channel = excluded.channel, policy = excluded.policy, automatic_up_to = excluded.automatic_up_to, pin = excluded.pin,
           windows = excluded.windows, time_zone = excluded.time_zone, set_by = excluded.set_by, set_at = now()
         returning *`,
        [state.unit, state.channel, state.policy, state.automaticUpTo, state.pin ?? null, JSON.stringify(state.windows), state.timeZone ?? null, state.setBy],
      );
      const set = fromDesiredStateRow(rows[0]);
      await client.query('insert into registry.desired_state_history (unit, record, set_by) values ($1, $2, $3)', [set.unit, JSON.stringify(set), set.setBy]);
      // Kept too for a release before desired states, which reads app_follows, if the server goes back to one.
      if (set.unit !== AUGUR_UNIT) {
        await client.query(
          `insert into registry.app_follows (app_id, channel, policy, set_by) values ($1, $2, $3, $4)
           on conflict (app_id) do update set channel = excluded.channel, policy = excluded.policy, set_by = excluded.set_by, set_at = now()`,
          [set.unit, set.channel, set.policy, set.setBy],
        );
      }
      return set;
    });
  }

  async desiredStateHistory(unit: string) {
    const { rows } = await this.pool.query<{ record: StoredDesiredState }>('select record from registry.desired_state_history where unit = $1 order by id desc limit $2', [unit, DESIRED_HISTORY_LISTED]);
    return rows.map((r) => r.record);
  }

  async markSeen(kind: 'upgrade' | 'app-job', id: string, by: string) {
    const table = kind === 'upgrade' ? 'registry.upgrades' : 'registry.app_jobs';
    const { rowCount } = await this.pool.query(`update ${table} set seen_by = $2, seen_at = now() where id = $1 and finished_at is not null`, [id, by]);
    return rowCount === 1;
  }

  close() {
    return this.pool.end();
  }
}

type UpgradeRow = {
  id: string;
  from_version: string;
  version: string;
  images: Record<string, string>;
  requested_by: string;
  requested_by_name: string | null;
  requested_at: Date;
  state: Upgrade['state'];
  steps: UpgradeStepState[];
  message: string | null;
  finished_at: Date | null;
  seen_by?: string | null;
  seen_at?: Date | null;
};

const fromUpgradeRow = (r: UpgradeRow): Upgrade => ({
  id: r.id,
  from: r.from_version,
  version: r.version,
  images: r.images,
  requestedBy: r.requested_by,
  ...(r.requested_by_name ? { requestedByName: r.requested_by_name } : {}),
  requestedAt: r.requested_at.toISOString(),
  state: r.state,
  steps: r.steps,
  ...(r.message ? { message: r.message } : {}),
  ...(r.finished_at ? { finishedAt: r.finished_at.toISOString() } : {}),
  ...(r.seen_by ? { seenBy: r.seen_by, ...(r.seen_at ? { seenAt: r.seen_at.toISOString() } : {}) } : {}),
});

type AppJobRow = {
  id: string;
  app_id: string;
  action: AppJob['action'];
  release: AppRelease | null;
  pr: number | null;
  upstream: string | null;
  requested_by: string;
  requested_at: Date;
  state: AppJob['state'];
  steps: AppJobStepState[];
  message: string | null;
  finished_at: Date | null;
  seen_by?: string | null;
  seen_at?: Date | null;
};

const fromAppJobRow = (r: AppJobRow): AppJob => ({
  id: r.id,
  app: r.app_id,
  action: r.action,
  ...(r.release ? { release: r.release } : {}),
  ...(r.pr !== null ? { pr: r.pr } : {}),
  ...(r.upstream ? { upstream: r.upstream } : {}),
  requestedBy: r.requested_by,
  requestedAt: r.requested_at.toISOString(),
  state: r.state,
  steps: r.steps,
  ...(r.message ? { message: r.message } : {}),
  ...(r.finished_at ? { finishedAt: r.finished_at.toISOString() } : {}),
  ...(r.seen_by ? { seenBy: r.seen_by, ...(r.seen_at ? { seenAt: r.seen_at.toISOString() } : {}) } : {}),
});

type DesiredStateRow = {
  unit: string;
  channel: StoredDesiredState['channel'];
  policy: StoredDesiredState['policy'];
  automatic_up_to: StoredDesiredState['automaticUpTo'];
  pin: string | null;
  windows: StoredDesiredState['windows'];
  time_zone: string | null;
  set_by: string;
  set_at: Date;
};

const fromDesiredStateRow = (r: DesiredStateRow): StoredDesiredState => ({
  unit: r.unit,
  channel: r.channel,
  policy: r.policy,
  automaticUpTo: r.automatic_up_to,
  ...(r.pin ? { pin: r.pin } : {}),
  windows: r.windows,
  ...(r.time_zone ? { timeZone: r.time_zone } : {}),
  setBy: r.set_by,
  setAt: r.set_at.toISOString(),
});
