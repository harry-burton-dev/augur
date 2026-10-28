/**
 * What Auspex reads. Your map comes from identity and the apps on a floor
 * from the registry, both straight through the gateway as the person, so
 * Auspex never sees more than they could ask for themselves. Only what
 * changed lately comes from Auspex's own service.
 */

export type FloorKind = 'personal' | 'team' | 'org';
export type MemberRole = 'member' | 'lead';

export interface Named {
  id: string;
  name: string;
}

/** Why someone can stand on, or see into, a floor (identity's `FloorReason`). */
export type FloorReason =
  | { kind: 'own' }
  | { kind: 'org' }
  | { kind: 'member'; role: MemberRole }
  | { kind: 'inside'; via: Named }
  | { kind: 'leads-above'; team: Named }
  | { kind: 'admin' };

export interface MapFloor {
  id: string;
  kind: FloorKind;
  name: string;
  slug: string;
  parentId?: string;
  depth: number;
  /** False for a team they see into (as a lead above it, or an admin) without standing on it. */
  open: boolean;
  why: FloorReason;
  people: number;
  leads: Named[];
  members?: (Named & { role: MemberRole })[];
}

export interface ClosedTeam {
  id: string;
  name: string;
  parentId?: string;
  depth: number;
  leads: Named[];
}

export interface PersonMap {
  floors: MapFloor[];
  closed: ClosedTeam[];
  principals: string[];
}

/** Why an app is on or off on a floor (the registry's `floorState`, with who set the deciding rule). */
export type AppState =
  | { on: true; why: 'platform' }
  | { on: true; why: 'approved' }
  | { on: false; why: 'turned-off' }
  | { on: false; why: 'not-for-this-kind' }
  | { on: false; why: 'blocked'; by: string; setBy?: string; setAt?: string }
  | { on: boolean; why: 'set-here' | 'set-above'; by: string; setBy?: string; setAt?: string };

export interface FloorApp {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  floors?: FloorKind[];
  pillar?: boolean;
  state: AppState;
  requiredRole?: string;
  hasRole?: boolean;
}

export interface Change {
  at: string;
  kind: 'joined' | 'left' | 'team-made' | 'team-renamed' | 'app-on' | 'app-off' | 'app-blocked' | 'app-rule-cleared' | 'app-removed';
  floor?: string;
  person?: string;
  team?: string;
  app?: string;
  name?: string;
}

export interface Changes {
  days: number;
  changes: Change[];
  names: Record<string, string>;
}

/** Whether the person can use an app on a floor: on there, and they have any role it needs. */
export const usable = (app: FloorApp) => app.state.on && app.hasRole !== false;

type Fetch = (path: string, init?: RequestInit) => Promise<Response>;

export class AuspexError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class AuspexApi {
  constructor(private fetch: Fetch) {}

  private async get<T>(path: string, floor?: string): Promise<T> {
    // A floor other than the one they're on: the gateway checks they can stand on it.
    const res = await this.fetch(path, { headers: { accept: 'application/json', ...(floor ? { 'X-Workspace-Id': floor } : {}) } });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new AuspexError(body.message ?? `Couldn’t load this (${res.status}).`, res.status);
    return body as T;
  }

  map() {
    return this.get<PersonMap>('/api/identity/v1/me/map');
  }

  /** Every app on a floor they stand on, with why it's on or off. */
  async apps(floor: string) {
    return (await this.get<{ apps: FloorApp[] }>(`/api/registry/v1/me/apps?workspace=${encodeURIComponent(floor)}`, floor)).apps;
  }

  changes(floor: string, days = 7) {
    return this.get<Changes>(`/api/auspex/v1/changes?days=${days}`, floor);
  }

  async names(ids: string[]) {
    if (!ids.length) return {};
    return (await this.get<{ names: Record<string, string> }>(`/api/auspex/v1/names?ids=${ids.map(encodeURIComponent).join(',')}`)).names;
  }
}
