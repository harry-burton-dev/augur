import type { AppManifestEntry } from '@augur/mfe-sdk';

export interface Person {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  enabled: boolean;
  /** Still has to choose their own password. */
  invited: boolean;
  roles: string[];
  departments: string[];
  createdAt?: string;
  /** Where their account is in its life (ADR 0040). Older identities don't send it. */
  state?: 'invited' | 'active' | 'disabled' | 'left';
  /** How they were asked to start. */
  invite?: { method: 'email' | 'temporary-password'; sentAt?: string; expiresAt?: string; expired: boolean; count: number };
  /** Their last sign-in that AUGUR has seen. */
  lastSignInAt?: string;
  /** Why their sign-in is off, when AUGUR knows. */
  disabledCause?: 'admin' | 'idle' | 'leaver' | 'outside';
  /** When they left, who ran the leaver flow, and who took on their work. */
  left?: { at: string; by: string; handOverTo?: string; deleteAfter?: string };
  /** Deleting their account has started and got this far (ADR 0072); it carries on by itself. */
  deleting?: 'redacted' | 'tidied' | 'keycloak-deleted';
  /** How they sign in: a password here, or the organisation's sign-in (Entra). */
  source?: 'local' | 'federated';
  /** Locked out for now after repeated wrong passwords. */
  locked?: boolean;
  /** As the sign-in service has it now; only on one person read on their own. */
  lockout?: { locked: boolean; failures: number; lastFailureAt?: string };
  /** A leaver flow set for after their last day (YYYY-MM-DD, the organisation's time zone). */
  leaving?: { on: string; handOverTo?: string };
  /** For an active person: when an idle sign-in turns off, or why it won't. */
  idle?: { warnsAt: string; turnsOffAt: string; warned: boolean } | { exempt: 'off' | 'no-email' | 'deployment-admin' | 'not-tracked' };
}

/** What the account lifecycle can do here. */
export interface LifecycleInfo {
  /** Whether invites can be emailed. */
  email: boolean;
  /** Today where the organisation is: the earliest last day a leaver can have. */
  today?: string;
  /** How many days ahead a last day can be. */
  lastDayAhead?: number;
}

/** Someone who asked to leave in their account (ADR 0040), until an admin's leaver flow closes it. */
export interface LeaveRequest {
  person: string;
  requestedAt: string;
  note?: string;
}

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  members: string[];
}

/** The organisation's settings (ADR 0042). */
export interface Organisation {
  name: string;
  /** An IANA time zone, e.g. Europe/London. */
  timeZone: string;
  sender: { name: string; address?: string };
  /** Idle accounts: warned after `warningDays` without a sign-in, turned off at `turnOffDays`. */
  idle: Idle;
  /** A PNG, at `url` for anyone, signed in or not. */
  logo?: { url: string; sha256: string; width: number; height: number };
  /** The sign-in notice, shown as Keycloak's Terms and Conditions step. */
  notice: SignInNotice;
  /** The languages offered at sign-in and in Account. */
  languages: string[];
  defaultLanguage: string;
  /** Changed only by a deployment admin who just entered their password. */
  security: Security;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SignInNotice {
  on: boolean;
  title?: string;
  text?: string;
  /** Goes up each time everyone is asked to accept it again. */
  version: number;
  changedAt?: string;
  changedBy?: string;
}

export interface Security {
  twoStepForAll: boolean;
  leaverRetentionDays: number;
  activityRetentionDays: number;
}

export interface Idle {
  on: boolean;
  warningDays: number;
  turnOffDays: number;
}

/** Only what changes; a sender address of `null` takes it away. */
export interface OrganisationChanges {
  name?: string;
  timeZone?: string;
  sender?: { name: string; address: string | null };
  idle?: Partial<Idle>;
  notice?: { on?: boolean; title?: string; text?: string; askAgain?: boolean };
  languages?: string[];
  defaultLanguage?: string;
  security?: Partial<Security>;
}

export interface Role {
  name: string;
  description?: string;
}

export interface CatalogueApp extends AppManifestEntry {
  /** Built into AUGUR (Home, Admin, the Upgrade Centre); can't be turned off. */
  platform: boolean;
  /** Ships with AUGUR but is an ordinary app: turned off rather than removed, and its version comes with the release. */
  ships?: boolean;
  /** @deprecated The registry's old name for `ships`, read only from a registry that doesn't send `ships`. */
  pillar?: boolean;
  /** The kind its manifest claims when the registry doesn't honour it (ADR 0032), and why. `category` is then absent. */
  categoryRefused?: { asked: string; why: string };
  enabled: boolean;
  registeredBy?: string;
  registeredAt?: string;
  updatedAt?: string;
  /** Set when an admin holds the app at this version. */
  pinnedVersion?: string;
  /** Set when the app loads from a site no longer allowed: why it isn't offered. */
  blocked?: string;
  /** What the app's service asks to do on the platform. */
  scopes?: string[];
  /** What an admin has let it do, of what it asks for. */
  grantedScopes?: string[];
  /** What a newer version asks for that no admin has allowed yet. */
  awaitingScopes?: string[];
  /** The kinds of floor it works on; every kind when absent. */
  floors?: ('personal' | 'team' | 'org')[];
  /** What the gateway lets through to its service in one request, in MB. */
  uploadLimit?: number;
  /** Set when an admin has lowered that below what the app asks. */
  uploadLimitLowered?: boolean;
  /** Settings the app offers admins, from its manifest. */
  settings?: AppSetting[];
  /** Features it's trying before they're everyone's (SDK 1.7). */
  previews?: { id: string; name: string; detail?: string; until?: string }[];
  /** The kinds of work it puts in people's inboxes, from its manifest (SDK 1.12). */
  inbox?: { kinds: { id: string; label: string; icon?: string }[] };
}

/** One setting an app offers admins: a whole number between min and max. */
export interface AppSetting {
  id: string;
  label: string;
  detail?: string;
  type: 'integer';
  unit?: string;
  min: number;
  max: number;
  default: number;
}

/** A setting with the value in force: an admin's, or its default. */
export interface AppSettingValue extends AppSetting {
  value: number;
  setBy?: string;
  setAt?: string;
}

/** What one floor says about an app: on or off there and below, or blocked for it and every floor below. */
export interface FloorRule {
  app: string;
  workspace: string;
  state: 'on' | 'off' | 'blocked';
  carriesOn: boolean;
  setBy: string;
  setAt: string;
}

/** What an admin can set on a floor; `inherit` takes the floor's rule away. */
export type FloorChoice = FloorRule['state'] | 'inherit';

/** An app's own sign-in, straight after it is issued: the secret is shown this once. */
export interface IssuedSignIn {
  clientId: string;
  secret: string;
}

/** A site apps may load from besides the platform itself. */
export interface AllowedOrigin {
  origin: string;
  addedBy: string;
  addedAt: string;
}

/** One kept version of an app. */
export interface AppVersion {
  version: string;
  entry: AppManifestEntry;
  registeredBy: string;
  registeredAt: string;
  /** The one the shell is given now. */
  serving: boolean;
}

/** One part of the platform as the gateway last saw it (see contracts/gateway.openapi.yaml). */
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

/** How one app's part is taking the events pushed to it (the events service's GET /deliveries, contract 3). */
export interface EventDelivery {
  app: string;
  cursor: string;
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

/** Whether events are being pushed to apps' parts at all, and when not, why and who can change that. */
export type EventPushing = { on: true; problem?: string } | { on: false; why: string; whoCanChange: string };

/** One entry in the audit log (see contracts/events.openapi.yaml). */
export interface AuditEntry {
  id: string;
  at: string;
  actor: { id: string; kind: 'user' | 'service' };
  app: string;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  /** The floor it happened on, with its path from the org as it stood then. */
  workspace?: { id: string; path: string[] };
}

export interface AuditQuery {
  actor?: string;
  app?: string;
  since?: string;
  until?: string;
  /** The id of the oldest entry already shown. */
  before?: string;
  /** Only what happened on this floor and the floors below it. */
  workspace?: string;
  /** Only entries about this (an id). */
  target?: string;
  /** Only entries by, about or naming this person. */
  person?: string;
  /** Only sign-ins, or only every other change. */
  kind?: 'change' | 'sign-in';
  limit: number;
}

/** What the backup container last reported (see contracts/gateway.openapi.yaml). */
export interface BackupStatus {
  state: 'ok' | 'attention';
  problem?: string;
  lastBackup?: { at: string; ok: boolean; file?: string; bytes?: number; problem?: string };
  /** The last copy off the server (ADR 0060); absent while backups stay on the server only. */
  offsite?: { at: string; ok: boolean; snapshot?: string; keepDays?: number; problem?: string };
  /** Restoring to a point in time (ADR 0064); absent where Postgres doesn't archive yet. */
  pointInTime?: {
    at: string;
    ok: boolean;
    bases?: number;
    earliest?: string;
    archivedAt?: string;
    copiedAt?: string;
    problem?: string;
    lastTest?: { at: string; ok: boolean; base?: string; seconds?: number; mark?: string; reached?: string; problem?: string };
  };
  lastRestoreTest?: { at: string; ok: boolean; from?: 'local' | 'offsite'; file?: string; seconds?: number; people?: number; apps?: number; auditEntries?: number; problem?: string };
}

/** Whether AUGUR is open to the internet, from infra/deploy/public.sh (see contracts/gateway.openapi.yaml). */
export interface PublicAccess {
  open: boolean;
  until?: string;
}

/** Whether AUGUR can send email through the organisation's relay (ADR 0035, 0065). */
export interface EmailStatus {
  state: 'off' | 'ok' | 'attention';
  /** Why, and who can change it, when it isn't ok. */
  problem?: string;
  /** host:port, never its sign-in. */
  relay?: string;
  from?: string;
  checkedAt?: string;
}

export interface PlatformStatus {
  components: ComponentStatus[];
  /** Absent when the gateway isn't told where backups are. */
  backups?: BackupStatus;
  /** Absent when the gateway isn't told where to look. */
  publicAccess?: PublicAccess;
  /** Absent from a gateway older than the mail sender. */
  email?: EmailStatus;
}

/** One change in a changelog, and the parts it moved (registry's changes.ts). */
export interface Change {
  id?: string;
  kind: 'major' | 'minor' | 'patch';
  text: string;
  parts: string[];
}

/** stable is on production, beta on preview, dev a dev build that only the workbench takes. */
export type ReleaseChannel = 'stable' | 'beta' | 'dev';

/** An AUGUR release as Updates shows it (see contracts/registry.openapi.yaml). */
export interface ReleaseSummary {
  version: string;
  channel: ReleaseChannel;
  released?: string;
  notesUrl?: string;
  breaking: string[];
  changes?: Change[];
  /** Its publisher halted it (ADR 0018): listed, never offered. */
  halted?: Halt;
}

/** Why a release's publisher halted it. */
export interface Halt {
  reason: string;
  at: string;
  by?: string;
}

/** How far the release feed this server read can be trusted (ADR 0017). */
export interface FeedTrust {
  state: 'verified' | 'mirror' | 'unchecked';
  expires?: string;
  signer?: string;
  note?: string;
}

/** An earlier release the server could go back to. */
export interface GoBackTarget {
  version: string;
  channel: ReleaseChannel;
  released?: string;
  problem?: string;
  breakingAfter?: string;
  halted?: Halt;
}

/** One upgrade in the Updates page's history. */
export interface UpdateHistoryEntry {
  id: string;
  from: string;
  version: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'rolled-back' | 'failed' | 'cancelled';
  message?: string;
  finishedAt?: string;
  backup?: string;
}

/** Something to do or know before upgrading. */
export interface NeedsYou {
  kind: 'halted' | 'path' | 'setting' | 'breaking' | 'app' | 'unknown';
  message: string;
  version?: string;
  key?: string;
  required?: boolean;
  /** For a setting: a secret the updater makes up itself. */
  madeUp?: boolean;
  app?: string;
}

/** What the registry last found in the release feed, against the running release. */
/** One step the updater took (see contracts/registry.openapi.yaml). */
export interface UpgradeStepState {
  step: 'preflight' | 'backup' | 'pull' | 'roll-forward' | 'verify' | 'watch' | 'roll-back';
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/** An upgrade an admin asked for, and how the deployment's updater is getting on. */
export interface Upgrade {
  id: string;
  from: string;
  version: string;
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'rolled-back' | 'failed' | 'cancelled';
  steps: UpgradeStepState[];
  message?: string;
  finishedAt?: string;
}

/** The Upgrade Centre's line (see contracts/registry.openapi.yaml, PipelineLine). */
export interface PipelineLine {
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  generatedAt?: string;
  repository?: string;
  units: {
    id: string;
    name: string;
    versions: Record<'dev' | 'preview' | 'production', string | null>;
    devBuild?: { version: string; released?: string };
    waiting: string[];
    previews: { pr: number; version: string }[];
    running?: string;
  }[];
  steps: { from: 'dev' | 'preview' | 'production'; to: 'dev' | 'preview' | 'production'; merged: number; pulls: { number: number; title: string; mergedAt?: string }[] }[];
  pulls?: {
    versionPackages?: { number: number; title: string; url: string };
    promoteToPreview?: { number: number; title: string; url: string };
    promoteToProduction: { number: number; title: string; url: string; unit: string; version: string }[];
  };
}

export interface PlatformUpdates {
  running: { version: string; channel: ReleaseChannel; build?: 'source' };
  channel: ReleaseChannel;
  /** What kind of server this is (SERVER_RING), which bounds the channel. */
  ring?: 'dev' | 'preview' | 'production';
  channelNote?: string;
  /** Off when the deployment set RELEASE_FEED_URL=off. */
  feed: 'on' | 'off';
  /** How far the feed it read can be trusted. */
  feedTrust?: FeedTrust;
  checkedAt?: string;
  problem?: string;
  available?: ReleaseSummary & { parts: { name: string; from?: string; to: string }[] };
  newer: ReleaseSummary[];
  beta?: ReleaseSummary;
  next?: string;
  needsYou: NeedsYou[];
  /** The upgrade asked for, while it's waiting or under way, and for a week after. */
  upgrade?: Upgrade;
  /** Every upgrade asked for, newest first. */
  history?: UpdateHistoryEntry[];
  /** Earlier releases to go back to, newest first, each with why not when it can't. */
  goBack?: GoBackTarget[];
  /** When the deployment's updater last asked for work, since the registry started. */
  updaterSeenAt?: string;
  /** The line from dev to production, from the pipeline feed, with what this server runs of each unit. */
  line?: PipelineLine;
  /** The company's Backstage (PORTAL_URL), which the Upgrade Centre links to. */
  portalUrl?: string;
}

/** One step the app runner took (see contracts/registry.openapi.yaml). */
export interface AppJobStepState {
  step: 'verify' | 'storage' | 'sign-in' | 'start' | 'health' | 'switch' | 'watch' | 'retire' | 'remove';
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/** An install or removal an admin (or an automatic update) asked the app runner for. */
export interface AppJob {
  id: string;
  app: string;
  action: 'install' | 'remove';
  release?: { version: string; channel: string };
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'failed' | 'cancelled';
  steps: AppJobStepState[];
  message?: string;
  finishedAt?: string;
}

/** Who gets a feature preview: nobody, those who turn it on, everyone, or chosen floors and those beneath them. */
export type FeaturePreviewMode = 'off' | 'opt-in' | 'everyone' | 'floors';

/** An app's feature previews as Admin shows them. */
export interface FeaturePreviews {
  /** Who gets one nobody chose for: opt-in on a dev or preview server, off on a production one. */
  defaultMode: FeaturePreviewMode;
  ring: 'dev' | 'preview' | 'production';
  previews: { id: string; name: string; detail?: string; until?: string; mode: FeaturePreviewMode; floors?: string[]; ended: boolean; chosen: boolean; setBy?: string; setAt?: string; optedIn: number }[];
}

/** stable is production releases, beta preview releases too, dev dev builds too (a dev or preview server only). */
export type AppChannel = 'stable' | 'beta' | 'dev';

/** One of an app's jobs, as its history shows it. */
export interface AppHistoryEntry {
  id: string;
  action: 'install' | 'remove' | 'preview' | 'preview-remove';
  version?: string;
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'failed' | 'cancelled';
  message?: string;
  finishedAt?: string;
}
export type AppPolicy = 'automatic' | 'ask' | 'hold';

/** An app the app runner installed, and how it takes new releases. */
export interface InstalledApp {
  app: string;
  name: string;
  version: string;
  installedAt: string;
  channel: AppChannel;
  policy: AppPolicy;
  /** The newest release on its channel, when newer; `needs` says why it waits for an admin. */
  update?: { version: string; channel: AppChannel; notesUrl?: string; needs: string[]; changes?: Change[] };
  job?: AppJob;
  /** What changed in the version it runs. */
  changes?: Change[];
  /** Its jobs, newest first: installs, updates, going back and removals. */
  history?: AppHistoryEntry[];
  /** Earlier versions in the feed to go back to, newest first. */
  older?: { version: string; channel: AppChannel }[];
  /** Who may try its pull requests' previews, by person id. */
  developers?: string[];
  previews?: AppPreview[];
}

/** A pull request's build of an installed app, running beside it for its developers. */
export interface AppPreview {
  pr: number;
  version: string;
  title?: string;
  url?: string;
  startedAt: string;
  endsAt: string;
}

/** What a contract 3 release asks an admin to agree to. */
interface AppAsks {
  scopes: string[];
  /** Each resource a part asks for, with its params. */
  resources: { part: string; type: string; params?: Record<string, unknown> }[];
  /** Each part's limits, by part name. */
  limits: Record<string, { memory: string; cpu: string }>;
  floors: string[];
  maxUpload: number;
  /** The ids of the settings it offers. */
  settings: string[];
  canvas: boolean;
}

/** An app the feed offers that isn't installed. */
export interface AvailableApp {
  app: string;
  name: string;
  description?: string;
  version: string;
  channel: AppChannel;
  notesUrl?: string;
  /** The feed it is listed in, one of APP_FEEDS. */
  feed?: string;
  /** Missing for a release that can't install here, such as one on contract 2. */
  signer?: { repository: string; workflow: string };
  /** What its release asks for, as the file carries it (contract 3, spec 9.4); missing for one that can't install here. */
  asks?: AppAsks;
  /** Why it can't open in this AUGUR. */
  problem?: string;
  job?: AppJob;
}

/** Admin → Apps' installs: what the app runner installed, and what the app feed offers. */
export interface AppInstalls {
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  runnerSeenAt?: string;
  sdkVersion: string;
  /** What kind of server this is (SERVER_RING): a production one follows stable releases only. */
  ring?: 'dev' | 'preview' | 'production';
  previewsAllowed?: boolean;
  channelNote?: string;
  installed: InstalledApp[];
  available: AvailableApp[];
}

export interface NewPerson {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  roles: string[];
  departments: string[];
  /** An invite email, or a one-time password; identity picks email when it works. */
  start?: 'email' | 'temporary-password';
}

/** How someone was asked to start, as identity answers it. */
export interface InviteResult {
  method: 'email' | 'temporary-password';
  sentTo?: string;
  expiresAt?: string;
  /** The account was made but the email couldn't be sent. */
  error?: string;
}

export type PersonChanges = Partial<Pick<Person, 'firstName' | 'lastName' | 'email' | 'enabled' | 'roles' | 'departments'>>;

/** A call the platform turned down; `code` is its `error`, such as `sign_in_again`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * Admin's calls, all through the gateway: people and departments to identity
 * (which talks to the sign-in service), apps to the registry, activity to events, status to the gateway itself. The browser never
 * calls the sign-in service's admin API itself.
 */
export class AdminApi {
  private readonly getToken: () => Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor(getToken: () => Promise<string>, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.getToken = getToken;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: string, url: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: { authorization: `Bearer ${await this.getToken()}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('AUGUR can’t be reached. Check your connection; nothing was changed.');
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new ApiError(data.message ?? `That didn’t work (${res.status}). Nothing was changed.`, res.status, (data as { error?: string }).error);
    return data;
  }

  people = () => this.call<Person[]>('GET', '/api/identity/v1/admin/people');
  addPerson = (person: NewPerson) => this.call<{ person: Person; invite?: InviteResult; temporaryPassword?: string }>('POST', '/api/identity/v1/admin/people', person);
  /** A new invite email for someone who hasn't set up yet. */
  resendInvite = (id: string) => this.call<{ invite: InviteResult }>('POST', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/invite`);
  /** What the account lifecycle can do here: whether invites can be emailed, and today's date for a last day. */
  lifecycle = () => this.call<LifecycleInfo>('GET', '/api/identity/v1/admin/lifecycle');
  /** One person, with whether they're locked out as the sign-in service has it now. */
  person = (id: string) => this.call<Person>('GET', `/api/identity/v1/admin/people/${encodeURIComponent(id)}`);
  /** Lifts a lockout for wrong passwords. */
  unlock = (id: string) => this.call<void>('POST', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/unlock`);
  /** Deletes a leaver's account now (deployment admins only). Turned down with `sign_in_again` unless the admin just entered their password. */
  deletePerson = (id: string) => this.call<{ deleted: true }>('DELETE', `/api/identity/v1/admin/people/${encodeURIComponent(id)}`);
  /** Cancels a leaver flow set for after their last day. */
  cancelLeave = (id: string) => this.call<Person>('DELETE', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/leave`);
  updatePerson = (id: string, changes: PersonChanges) => this.call<Person>('PATCH', `/api/identity/v1/admin/people/${encodeURIComponent(id)}`, changes);
  resetPassword = (id: string) => this.call<{ temporaryPassword: string }>('POST', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/password`);
  leaveRequests = () => this.call<LeaveRequest[]>('GET', '/api/identity/v1/admin/leave-requests');
  /** The leaver flow: their sign-in off, signed out everywhere, and apps told to hand on what they own. */
  leave = (id: string, how: { handOverTo?: string; note?: string; lastDay?: string }) => this.call<Person>('POST', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/leave`, how);
  roles = () => this.call<Role[]>('GET', '/api/identity/v1/admin/roles');

  departments = () => this.call<Department[]>('GET', '/api/identity/v1/admin/departments');
  addDepartment = (name: string, parentId?: string) =>
    this.call<Department>('POST', '/api/identity/v1/admin/departments', { name, ...(parentId ? { parentId } : {}) });
  /** What each level of department is called, from the top, and how many levels there can be. */
  levels = () => this.call<TeamLevels>('GET', '/api/identity/v1/admin/levels');
  setLevels = (levels: string[]) => this.call<TeamLevels>('PUT', '/api/identity/v1/admin/levels', { levels });
  renameDepartment = (id: string, name: string) => this.call<Department>('PATCH', `/api/identity/v1/admin/departments/${encodeURIComponent(id)}`, { name });
  addMember = (department: string, person: string) =>
    this.call<void>('PUT', `/api/identity/v1/admin/departments/${encodeURIComponent(department)}/members/${encodeURIComponent(person)}`);
  removeMember = (department: string, person: string) =>
    this.call<void>('DELETE', `/api/identity/v1/admin/departments/${encodeURIComponent(department)}/members/${encodeURIComponent(person)}`);

  organisation = () => this.call<Organisation>('GET', '/api/identity/v1/organisation');
  setOrganisation = (changes: OrganisationChanges) => this.call<Organisation>('PATCH', '/api/identity/v1/admin/organisation', changes);
  /** The time zones an admin can choose, UTC first. */
  timeZones = () => this.call<string[]>('GET', '/api/identity/v1/admin/organisation/time-zones');
  /** The languages the sign-in pages have words in, which an admin can offer. */
  signInLanguages = () => this.call<string[]>('GET', '/api/identity/v1/admin/organisation/languages');
  /** Keeps a PNG as the organisation's logo; identity says why when it can't be one. */
  setLogo = async (png: Blob) => {
    let res: Response;
    try {
      res = await this.fetchImpl('/api/identity/v1/admin/organisation/logo', { method: 'PUT', headers: { authorization: `Bearer ${await this.getToken()}`, 'content-type': 'image/png' }, body: png });
    } catch {
      throw new Error('AUGUR can’t be reached. Check your connection; nothing was changed.');
    }
    const data = (await res.json().catch(() => ({}))) as NonNullable<Organisation['logo']> & { message?: string; error?: string };
    if (res.status === 413) throw new ApiError('The logo is too large. Save it smaller and try again.', 413, data.error);
    if (!res.ok) throw new ApiError(data.message ?? `That didn’t work (${res.status}). Nothing was changed.`, res.status, data.error);
    return data;
  };
  removeLogo = () => this.call<void>('DELETE', '/api/identity/v1/admin/organisation/logo');

  apps = () => this.call<CatalogueApp[]>('GET', '/api/registry/v1/apps');
  setAppEnabled = (id: string, enabled: boolean) => this.call<CatalogueApp>('PATCH', `/api/registry/v1/apps/${encodeURIComponent(id)}`, { enabled });
  appFloors = (id: string) => this.call<FloorRule[]>('GET', `/api/registry/v1/apps/${encodeURIComponent(id)}/floors`);
  setAppFloor = (id: string, workspace: string, state: FloorChoice) =>
    this.call<{ rules: FloorRule[] }>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/floors/${encodeURIComponent(workspace)}`, { state });
  /** Lowers how much an app may be sent at once, in MB, or with `null` gives it what it asks again. */
  limitUploads = (id: string, mb: number | null) => this.call<CatalogueApp>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/upload-limit`, { mb });
  appSettings = async (id: string) => (await this.call<{ settings: AppSettingValue[] }>('GET', `/api/registry/v1/apps/${encodeURIComponent(id)}/settings`)).settings;
  /** Sets one of an app's settings; `null` puts it back to its default. */
  setAppSetting = async (id: string, setting: string, value: number | null) =>
    (await this.call<{ settings: AppSettingValue[] }>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/settings/${encodeURIComponent(setting)}`, { value })).settings;
  /** Who gets each of an app's feature previews, and how many turned each on. */
  featurePreviews = (id: string) => this.call<FeaturePreviews>('GET', `/api/registry/v1/apps/${encodeURIComponent(id)}/feature-previews`);
  /** Sets who gets one of an app's feature previews; `null` goes back to the server's default. */
  /** With mode `floors`, `floors` says which: it's on there and on the floors beneath them. */
  setFeaturePreview = (id: string, preview: string, mode: FeaturePreviewMode | null, floors?: string[]) =>
    this.call<FeaturePreviews>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/feature-previews/${encodeURIComponent(preview)}`, { mode, ...(floors ? { floors } : {}) });
  grantScopes = (id: string, scopes: string[]) => this.call<CatalogueApp>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/scopes`, { scopes });
  /** The org's own floor, which every app rule starts from. */
  org = async () => {
    const { workspaces } = await this.call<{ workspaces: { id: string; kind: string; name: string }[] }>('GET', '/api/identity/v1/me/workspaces');
    const org = workspaces.find((w) => w.kind === 'org');
    if (!org) throw new Error('The org’s floor couldn’t be found.');
    return { id: org.id, name: org.name };
  };
  appVersions = (id: string) => this.call<AppVersion[]>('GET', `/api/registry/v1/apps/${encodeURIComponent(id)}/versions`);
  /** Serve one kept version and hold the app there; `null` follows new versions again. */
  pinApp = (id: string, version: string | null) =>
    version === null
      ? this.call<CatalogueApp>('DELETE', `/api/registry/v1/apps/${encodeURIComponent(id)}/pin`)
      : this.call<CatalogueApp>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/pin`, { version });

  /** A new secret for the app's own sign-in; the old one stops working. */
  issueSignIn = (id: string) => this.call<IssuedSignIn>('POST', `/api/identity/v1/admin/apps/${encodeURIComponent(id)}/credential`);

  /** The entries the filters show, as a CSV file (the events service's GET /audit/export; each export is recorded). */
  exportAudit = async (query: Omit<AuditQuery, 'before' | 'limit'>): Promise<{ blob: Blob; filename: string }> => {
    const url = `/api/events/v1/audit/export?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'GET', headers: { authorization: `Bearer ${await this.getToken()}` } });
    } catch {
      throw new Error('AUGUR can’t be reached. Check your connection and try again.');
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new ApiError(data.message ?? `The export didn’t work (${res.status}). Try again.`, res.status, data.error);
    }
    const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'activity.csv';
    return { blob: await res.blob(), filename };
  };
  audit = (query: AuditQuery) =>
    this.call<AuditEntry[]>('GET', `/api/events/v1/audit?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`);

  /** How each subscribing app's part is taking the events pushed to it (admins). */
  deliveries = () => this.call<{ deliveries: EventDelivery[]; pushing: EventPushing }>('GET', '/api/events/v1/deliveries');

  origins = () => this.call<AllowedOrigin[]>('GET', '/api/registry/v1/origins');
  allowOrigin = (origin: string) => this.call<AllowedOrigin>('POST', '/api/registry/v1/origins', { origin });
  removeOrigin = (origin: string) => this.call<void>('DELETE', `/api/registry/v1/origins/${encodeURIComponent(origin)}`);

  status = () => this.call<PlatformStatus>('GET', '/api/gateway/v1/status');

  updates = () => this.call<PlatformUpdates>('GET', '/api/registry/v1/platform/updates');
  /** Reads the release feed now rather than waiting for the daily check. */
  checkUpdates = () => this.call<PlatformUpdates>('POST', '/api/registry/v1/platform/updates/check');
  /**
   * Asks the updater to move to `version`, with any new settings entered for .env. Turned down with
   * `sign_in_again` unless the admin just entered their password.
   */
  upgrade = (version: string, settings: Record<string, string> = {}) =>
    this.call<PlatformUpdates>('PUT', '/api/registry/v1/platform/upgrade', Object.keys(settings).length ? { version, settings } : { version });
  /** Asks the updater to go back to an earlier release Updates offers. Turned down with `sign_in_again` too. */
  goBack = (version: string) => this.call<PlatformUpdates>('PUT', '/api/registry/v1/platform/go-back', { version });
  installs = () => this.call<AppInstalls>('GET', '/api/registry/v1/app-runner/apps');
  /** Reads the app feed now, starting any automatic updates it finds. */
  checkInstalls = () => this.call<AppInstalls>('POST', '/api/registry/v1/app-runner/check');
  /** Asks the app runner to install a release from the feed. Turned down with `sign_in_again` unless the admin just entered their password. */
  installApp = (app: string, version: string) => this.call<AppJob>('POST', '/api/registry/v1/app-runner/jobs', { action: 'install', app, version });
  /** Asks the app runner to stop and remove an app's containers. Needs the password just entered too. */
  uninstallApp = (app: string) => this.call<AppJob>('POST', '/api/registry/v1/app-runner/jobs', { action: 'remove', app });
  setDevelopers = (app: string, people: string[]) => this.call<AppInstalls>('PUT', `/api/registry/v1/app-runner/apps/${encodeURIComponent(app)}/developers`, { people });
  /** Takes back an upgrade the updater hasn't started. */
  cancelUpgrade = () => this.call<PlatformUpdates>('DELETE', '/api/registry/v1/platform/upgrade');
}

export const fullName = (p: Pick<Person, 'firstName' | 'lastName' | 'username'>) => `${p.firstName} ${p.lastName}`.trim() || p.username;

/** The names of the levels of department, the first right below the org; a deeper level takes the last name. */
export interface TeamLevels {
  levels: string[];
  max: number;
}

/** How deep a department sits: 1 at the top. */
export const departmentDepth = (id: string, all: Department[]): number => {
  let depth = 0;
  for (let at = all.find((d) => d.id === id); at && depth < 20; at = at.parentId ? all.find((d) => d.id === at!.parentId) : undefined) depth++;
  return depth;
};

/** The name of the level a department sits at. */
export const levelOf = (id: string, all: Department[], levels: string[]) => levels[Math.min(departmentDepth(id, all), levels.length) - 1] ?? '';

/** "Finance / Payroll": a department's name with the ones it sits inside. */
export const departmentPath = (id: string, all: Department[]): string => {
  const names: string[] = [];
  let at = all.find((d) => d.id === id);
  for (let guard = 0; at && guard < 20; guard++) {
    names.unshift(at.name);
    at = at.parentId ? all.find((d) => d.id === at!.parentId) : undefined;
  }
  return names.join(' / ');
};
