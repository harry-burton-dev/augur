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
}

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  members: string[];
}

export interface Role {
  name: string;
  description?: string;
}

export interface CatalogueApp extends AppManifestEntry {
  /** Ships with the platform; can't be turned off. */
  platform: boolean;
  /** Ships with AUGUR but is an ordinary app: turned off rather than removed, and its version comes with the release. */
  pillar?: boolean;
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
  limit: number;
}

/** What the backup container last reported (see contracts/gateway.openapi.yaml). */
export interface BackupStatus {
  state: 'ok' | 'attention';
  problem?: string;
  lastBackup?: { at: string; ok: boolean; file?: string; bytes?: number; problem?: string };
  lastRestoreTest?: { at: string; ok: boolean; file?: string; seconds?: number; people?: number; apps?: number; auditEntries?: number; problem?: string };
}

export interface PlatformStatus {
  components: ComponentStatus[];
  /** Absent when the gateway isn't told where backups are. */
  backups?: BackupStatus;
}

/** An AUGUR release as Updates shows it (see contracts/registry.openapi.yaml). */
export interface ReleaseSummary {
  version: string;
  channel: 'stable' | 'beta';
  released?: string;
  notesUrl?: string;
  breaking: string[];
}

/** Something to do or know before upgrading. */
export interface NeedsYou {
  kind: 'path' | 'setting' | 'breaking' | 'app' | 'unknown';
  message: string;
  version?: string;
  key?: string;
  required?: boolean;
  app?: string;
}

/** What the registry last found in the release feed, against the running release. */
/** One step the updater took (see contracts/registry.openapi.yaml). */
export interface UpgradeStepState {
  step: 'preflight' | 'backup' | 'pull' | 'roll-forward' | 'verify' | 'roll-back';
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

export interface PlatformUpdates {
  running: { version: string; channel: 'stable' | 'beta' };
  channel: 'stable' | 'beta';
  /** Off when the deployment set RELEASE_FEED_URL=off. */
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  available?: ReleaseSummary & { parts: { name: string; from?: string; to: string }[] };
  newer: ReleaseSummary[];
  beta?: ReleaseSummary;
  next?: string;
  needsYou: NeedsYou[];
  /** The upgrade asked for, while it's waiting or under way, and for a week after. */
  upgrade?: Upgrade;
  /** When the deployment's updater last asked for work, since the registry started. */
  updaterSeenAt?: string;
}

export interface NewPerson {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  roles: string[];
  departments: string[];
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
      throw new Error('The platform can’t be reached. Check your connection; nothing was changed.');
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new ApiError(data.message ?? `That didn’t work (${res.status}). Nothing was changed.`, res.status, (data as { error?: string }).error);
    return data;
  }

  people = () => this.call<Person[]>('GET', '/api/identity/v1/admin/people');
  addPerson = (person: NewPerson) => this.call<{ person: Person; temporaryPassword: string }>('POST', '/api/identity/v1/admin/people', person);
  updatePerson = (id: string, changes: PersonChanges) => this.call<Person>('PATCH', `/api/identity/v1/admin/people/${encodeURIComponent(id)}`, changes);
  resetPassword = (id: string) => this.call<{ temporaryPassword: string }>('POST', `/api/identity/v1/admin/people/${encodeURIComponent(id)}/password`);
  roles = () => this.call<Role[]>('GET', '/api/identity/v1/admin/roles');

  departments = () => this.call<Department[]>('GET', '/api/identity/v1/admin/departments');
  addDepartment = (name: string, parentId?: string) =>
    this.call<Department>('POST', '/api/identity/v1/admin/departments', { name, ...(parentId ? { parentId } : {}) });
  renameDepartment = (id: string, name: string) => this.call<Department>('PATCH', `/api/identity/v1/admin/departments/${encodeURIComponent(id)}`, { name });
  addMember = (department: string, person: string) =>
    this.call<void>('PUT', `/api/identity/v1/admin/departments/${encodeURIComponent(department)}/members/${encodeURIComponent(person)}`);
  removeMember = (department: string, person: string) =>
    this.call<void>('DELETE', `/api/identity/v1/admin/departments/${encodeURIComponent(department)}/members/${encodeURIComponent(person)}`);

  apps = () => this.call<CatalogueApp[]>('GET', '/api/registry/v1/apps');
  setAppEnabled = (id: string, enabled: boolean) => this.call<CatalogueApp>('PATCH', `/api/registry/v1/apps/${encodeURIComponent(id)}`, { enabled });
  appFloors = (id: string) => this.call<FloorRule[]>('GET', `/api/registry/v1/apps/${encodeURIComponent(id)}/floors`);
  setAppFloor = (id: string, workspace: string, state: FloorChoice) =>
    this.call<{ rules: FloorRule[] }>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/floors/${encodeURIComponent(workspace)}`, { state });
  /** Lowers how much an app may be sent at once, in MB, or with `null` gives it what it asks again. */
  limitUploads = (id: string, mb: number | null) => this.call<CatalogueApp>('PUT', `/api/registry/v1/apps/${encodeURIComponent(id)}/upload-limit`, { mb });
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

  audit = (query: AuditQuery) =>
    this.call<AuditEntry[]>('GET', `/api/events/v1/audit?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`);

  origins = () => this.call<AllowedOrigin[]>('GET', '/api/registry/v1/origins');
  allowOrigin = (origin: string) => this.call<AllowedOrigin>('POST', '/api/registry/v1/origins', { origin });
  removeOrigin = (origin: string) => this.call<void>('DELETE', `/api/registry/v1/origins/${encodeURIComponent(origin)}`);

  status = () => this.call<PlatformStatus>('GET', '/api/gateway/v1/status');

  updates = () => this.call<PlatformUpdates>('GET', '/api/registry/v1/platform/updates');
  /** Reads the release feed now rather than waiting for the daily check. */
  checkUpdates = () => this.call<PlatformUpdates>('POST', '/api/registry/v1/platform/updates/check');
  /** Asks the updater to move to `version`. Turned down with `sign_in_again` unless the admin just entered their password. */
  upgrade = (version: string) => this.call<PlatformUpdates>('PUT', '/api/registry/v1/platform/upgrade', { version });
  /** Takes back an upgrade the updater hasn't started. */
  cancelUpgrade = () => this.call<PlatformUpdates>('DELETE', '/api/registry/v1/platform/upgrade');
}

export const fullName = (p: Pick<Person, 'firstName' | 'lastName' | 'username'>) => `${p.firstName} ${p.lastName}`.trim() || p.username;

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
