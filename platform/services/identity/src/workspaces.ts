import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { DirectoryError } from './directory.ts';

/**
 * Workspaces: the floors people stand on. One org per deployment at the top,
 * teams below it that nest up to five deep, and a personal floor for each
 * person that is its own root, never inside a team. Identity owns this tree;
 * every other service stores only a workspace id. People never see the word
 * "workspace": the shell calls them by their names.
 */

export type WorkspaceKind = 'org' | 'personal' | 'team';
export type MemberRole = 'member' | 'lead';

/** Teams nest at most this deep below the org. */
export const MAX_TEAM_DEPTH = 5;

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  /** The word in links, `/@finance/…`. Unique across the org and its teams; every personal floor is `me`. */
  slug: string;
  /** The org or team above. Absent for the org and for personal floors. */
  parentId?: string;
  /** Ids from the root down to this one, itself included. */
  path: string[];
  /** The person a personal floor belongs to. */
  owner?: string;
  /** Teams are archived, never deleted, so audit entries and links keep working. */
  archivedAt?: string;
}

/** Someone's place on a team. Membership of the org and of your own floor is implied, never stored. */
export interface Membership {
  workspace: string;
  person: string;
  role: MemberRole;
}

/** A team to copy in from somewhere else, by that source's own keys. */
export interface ImportedTeam {
  key: string;
  name: string;
  parentKey?: string;
  members: string[];
}

export interface WorkspaceStore {
  /** The deployment's org, made the first time it's asked for. */
  org(): Promise<Workspace>;
  /** A person's own floor, made the first time it's asked for. */
  personal(owner: string, name: string): Promise<Workspace>;
  /** Every team that isn't archived, each below the one it sits in. */
  teams(): Promise<Workspace[]>;
  memberships(filter?: { person?: string; workspace?: string }): Promise<Membership[]>;
  /** A new team below `parentId`, or right below the org without one. */
  createTeam(name: string, parentId?: string): Promise<Workspace>;
  /** Renames a team. Its slug stays, so links to it keep working. */
  renameTeam(id: string, name: string): Promise<Workspace>;
  /** Adds someone to a team or changes their role; `null` takes them off it. */
  setMember(team: string, person: string, role: MemberRole | null): Promise<void>;
  /**
   * Copies teams in from `source` the first time only, as one change. Answers
   * false when that source was imported before; `load` is then not called.
   */
  importOnce(source: string, load: () => Promise<ImportedTeam[]>): Promise<boolean>;
}

/** Slugs a team can't take: they mean something else in links. */
const RESERVED = new Set(['me', 'org', 'api', 'admin', 'home', 'new']);

/** "Finance & Ops" → "finance-ops". */
export const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '') || 'team';

const freeSlug = (name: string, taken: Set<string>) => {
  const base = slugify(name);
  if (!RESERVED.has(base) && !taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
};

/** Ltree labels can't hold hyphens on every Postgres we run, so ids are plain hex. */
const newId = () => randomUUID().replaceAll('-', '');

/**
 * The checks every store makes before adding a team, over the org and its
 * teams as they stand: where it goes, how deep that is, and its slug.
 */
const placeTeam = (org: Workspace, teams: Workspace[], name: string, parentId?: string, except?: string) => {
  const parent = !parentId || parentId === org.id ? org : teams.find((t) => t.id === parentId);
  if (!parent) throw new DirectoryError('The department to put it in no longer exists.', 400);
  if (parent.path.length - 1 >= MAX_TEAM_DEPTH) throw new DirectoryError(`Departments can sit at most ${MAX_TEAM_DEPTH} deep.`, 400);
  const clash = teams.find((t) => t.id !== except && t.parentId === parent.id && t.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new DirectoryError(`There is already a department called “${clash.name}” there.`, 409);
  return parent;
};

/** Parents before children, and only what fits under the depth limit. */
const importOrder = (teams: ImportedTeam[]) => {
  const byKey = new Map(teams.map((t) => [t.key, t]));
  const depth = (t: ImportedTeam, seen = new Set<string>()): number => {
    if (!t.parentKey || !byKey.has(t.parentKey) || seen.has(t.key)) return 1;
    seen.add(t.key);
    return 1 + depth(byKey.get(t.parentKey)!, seen);
  };
  return teams
    .map((t) => ({ t, d: depth(t) }))
    .filter(({ d }) => d <= MAX_TEAM_DEPTH)
    .sort((a, b) => a.d - b.d)
    .map(({ t }) => t);
};

export interface OrgSettings {
  /** What the org's floor is called, e.g. the organisation's own name. */
  orgName?: string;
}

/** For tests, and for running identity locally without Postgres. Forgets everything on restart. */
export class MemoryWorkspaceStore implements WorkspaceStore {
  private readonly all = new Map<string, Workspace>();
  private members: Membership[] = [];
  private readonly imported = new Set<string>();
  private readonly orgName: string;

  constructor({ orgName = 'Organisation' }: OrgSettings = {}) {
    this.orgName = orgName;
  }

  async org() {
    let org = [...this.all.values()].find((w) => w.kind === 'org');
    if (!org) {
      const id = newId();
      org = { id, kind: 'org', name: this.orgName, slug: 'org', path: [id] };
      this.all.set(id, org);
    }
    return structuredClone(org);
  }

  async personal(owner: string, name: string) {
    let floor = [...this.all.values()].find((w) => w.kind === 'personal' && w.owner === owner);
    if (!floor) {
      const id = newId();
      floor = { id, kind: 'personal', name, slug: 'me', path: [id], owner };
      this.all.set(id, floor);
    }
    return structuredClone(floor);
  }

  async teams() {
    return [...this.all.values()]
      .filter((w) => w.kind === 'team' && !w.archivedAt)
      .sort((a, b) => a.path.join('.').localeCompare(b.path.join('.')))
      .map((w) => structuredClone(w));
  }

  async memberships(filter: { person?: string; workspace?: string } = {}) {
    return this.members.filter((m) => (!filter.person || m.person === filter.person) && (!filter.workspace || m.workspace === filter.workspace)).map((m) => ({ ...m }));
  }

  private add(name: string, parent: Workspace) {
    const taken = new Set([...this.all.values()].filter((w) => w.kind !== 'personal').map((w) => w.slug));
    const id = newId();
    const team: Workspace = { id, kind: 'team', name, slug: freeSlug(name, taken), parentId: parent.id, path: [...parent.path, id] };
    this.all.set(id, team);
    return team;
  }

  async createTeam(name: string, parentId?: string) {
    const parent = placeTeam(await this.org(), await this.teams(), name, parentId);
    return structuredClone(this.add(name, parent));
  }

  async renameTeam(id: string, name: string) {
    const team = this.all.get(id);
    if (!team || team.kind !== 'team' || team.archivedAt) throw new DirectoryError('That department no longer exists.', 404);
    placeTeam(await this.org(), await this.teams(), name, team.parentId, id);
    team.name = name;
    return structuredClone(team);
  }

  async setMember(team: string, person: string, role: MemberRole | null) {
    const t = this.all.get(team);
    if (!t || t.kind !== 'team' || t.archivedAt) throw new DirectoryError('That department no longer exists.', 404);
    this.members = this.members.filter((m) => !(m.workspace === team && m.person === person));
    if (role) this.members.push({ workspace: team, person, role });
  }

  async importOnce(source: string, load: () => Promise<ImportedTeam[]>) {
    if (this.imported.has(source)) return false;
    const teams = importOrder(await load());
    const org = await this.org();
    const ids = new Map<string, Workspace>();
    for (const t of teams) {
      const parent = (t.parentKey && ids.get(t.parentKey)) || org;
      const team = this.add(t.name, parent);
      ids.set(t.key, team);
      for (const person of new Set(t.members)) this.members.push({ workspace: team.id, person, role: 'member' });
    }
    this.imported.add(source);
    return true;
  }
}

/**
 * Schema changes for workspaces, run after the preferences ones in store.ts.
 * `path` is an ltree of ids from the root, so "everything under Finance" is
 * one indexed query.
 */
export const workspaceMigrations: { id: string; sql: string }[] = [
  {
    id: '002_workspaces',
    sql: `
      create extension if not exists ltree;
      create table identity.workspaces (
        id text primary key,
        kind text not null check (kind in ('org', 'personal', 'team')),
        parent_id text references identity.workspaces (id),
        path ltree not null,
        owner text,
        name text not null,
        slug text not null,
        created_at timestamptz not null default now(),
        archived_at timestamptz,
        check ((kind = 'team') = (parent_id is not null)),
        check ((kind = 'personal') = (owner is not null)),
        check (kind <> 'team' or nlevel(path) <= ${MAX_TEAM_DEPTH + 1})
      );
      create unique index workspaces_one_org on identity.workspaces (kind) where kind = 'org';
      create unique index workspaces_one_personal on identity.workspaces (owner) where kind = 'personal';
      create unique index workspaces_slug on identity.workspaces (slug) where kind <> 'personal';
      create index workspaces_path on identity.workspaces using gist (path);
      create table identity.workspace_members (
        workspace_id text not null references identity.workspaces (id),
        person text not null,
        role text not null check (role in ('member', 'lead')),
        added_at timestamptz not null default now(),
        primary key (workspace_id, person)
      );
      create index workspace_members_person on identity.workspace_members (person);
      create table identity.imports (
        source text primary key,
        imported_at timestamptz not null default now()
      );`,
  },
];

interface Row {
  id: string;
  kind: WorkspaceKind;
  parent_id: string | null;
  path: string;
  owner: string | null;
  name: string;
  slug: string;
  archived_at: Date | null;
}

const COLUMNS = 'id, kind, parent_id, path::text as path, owner, name, slug, archived_at';

const fromRow = (r: Row): Workspace => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  slug: r.slug,
  ...(r.parent_id ? { parentId: r.parent_id } : {}),
  path: r.path.split('.'),
  ...(r.owner ? { owner: r.owner } : {}),
  ...(r.archived_at ? { archivedAt: r.archived_at.toISOString() } : {}),
});

type Querier = Pick<pg.PoolClient, 'query'>;

/** Workspaces on Postgres, in identity's own schema. The pool is shared with the preference store, which runs the migrations. */
export class PgWorkspaceStore implements WorkspaceStore {
  private readonly orgName: string;

  constructor(
    private readonly pool: pg.Pool,
    { orgName = 'Organisation' }: OrgSettings = {},
  ) {
    this.orgName = orgName;
  }

  /** Runs `fn` in a transaction that holds the workspaces lock, so slugs and sibling names can be checked and taken safely. */
  private async locked<T>(fn: (q: Querier) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('identity.workspaces'))");
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async orgIn(q: Querier) {
    await q.query(`insert into identity.workspaces (id, kind, path, name, slug) values ($1::text, 'org', $1::text::ltree, $2, 'org') on conflict do nothing`, [newId(), this.orgName]);
    const { rows } = await q.query<Row>(`select ${COLUMNS} from identity.workspaces where kind = 'org'`);
    return fromRow(rows[0]);
  }

  private async teamsIn(q: Querier) {
    const { rows } = await q.query<Row>(`select ${COLUMNS} from identity.workspaces where kind = 'team' and archived_at is null order by path`);
    return rows.map(fromRow);
  }

  private async slugsIn(q: Querier) {
    const { rows } = await q.query<{ slug: string }>(`select slug from identity.workspaces where kind <> 'personal'`);
    return new Set(rows.map((r) => r.slug));
  }

  private async insertTeam(q: Querier, name: string, parent: Workspace, taken: Set<string>) {
    const id = newId();
    const slug = freeSlug(name, taken);
    taken.add(slug);
    const team: Workspace = { id, kind: 'team', name, slug, parentId: parent.id, path: [...parent.path, id] };
    await q.query(`insert into identity.workspaces (id, kind, parent_id, path, name, slug) values ($1, 'team', $2, $3::ltree, $4, $5)`, [
      id,
      parent.id,
      team.path.join('.'),
      name,
      slug,
    ]);
    return team;
  }

  org() {
    return this.orgIn(this.pool);
  }

  async personal(owner: string, name: string) {
    await this.pool.query(`insert into identity.workspaces (id, kind, path, owner, name, slug) values ($1::text, 'personal', $1::text::ltree, $2, $3, 'me') on conflict do nothing`, [
      newId(),
      owner,
      name,
    ]);
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from identity.workspaces where kind = 'personal' and owner = $1`, [owner]);
    return fromRow(rows[0]);
  }

  teams() {
    return this.teamsIn(this.pool);
  }

  async memberships(filter: { person?: string; workspace?: string } = {}) {
    const { rows } = await this.pool.query<{ workspace_id: string; person: string; role: MemberRole }>(
      `select workspace_id, person, role from identity.workspace_members
       where ($1::text is null or person = $1) and ($2::text is null or workspace_id = $2)
       order by added_at, person`,
      [filter.person ?? null, filter.workspace ?? null],
    );
    return rows.map((r) => ({ workspace: r.workspace_id, person: r.person, role: r.role }));
  }

  createTeam(name: string, parentId?: string) {
    return this.locked(async (q) => {
      const parent = placeTeam(await this.orgIn(q), await this.teamsIn(q), name, parentId);
      return this.insertTeam(q, name, parent, await this.slugsIn(q));
    });
  }

  renameTeam(id: string, name: string) {
    return this.locked(async (q) => {
      const teams = await this.teamsIn(q);
      const team = teams.find((t) => t.id === id);
      if (!team) throw new DirectoryError('That department no longer exists.', 404);
      placeTeam(await this.orgIn(q), teams, name, team.parentId, id);
      await q.query('update identity.workspaces set name = $2 where id = $1', [id, name]);
      return { ...team, name };
    });
  }

  async setMember(team: string, person: string, role: MemberRole | null) {
    const { rowCount } = await this.pool.query(`select 1 from identity.workspaces where id = $1 and kind = 'team' and archived_at is null`, [team]);
    if (!rowCount) throw new DirectoryError('That department no longer exists.', 404);
    if (role) {
      await this.pool.query(
        `insert into identity.workspace_members (workspace_id, person, role) values ($1, $2, $3)
         on conflict (workspace_id, person) do update set role = excluded.role`,
        [team, person, role],
      );
    } else {
      await this.pool.query('delete from identity.workspace_members where workspace_id = $1 and person = $2', [team, person]);
    }
  }

  async importOnce(source: string, load: () => Promise<ImportedTeam[]>) {
    const { rowCount } = await this.pool.query('select 1 from identity.imports where source = $1', [source]);
    if (rowCount) return false;
    // Read the source outside the lock: it may be slow, and the check is made again inside.
    const teams = importOrder(await load());
    return this.locked(async (q) => {
      const { rowCount: done } = await q.query('select 1 from identity.imports where source = $1', [source]);
      if (done) return false;
      const org = await this.orgIn(q);
      const taken = await this.slugsIn(q);
      const ids = new Map<string, Workspace>();
      for (const t of teams) {
        const team = await this.insertTeam(q, t.name, (t.parentKey && ids.get(t.parentKey)) || org, taken);
        ids.set(t.key, team);
        for (const person of new Set(t.members)) {
          await q.query(`insert into identity.workspace_members (workspace_id, person, role) values ($1, $2, 'member')`, [team.id, person]);
        }
      }
      await q.query('insert into identity.imports (source) values ($1)', [source]);
      return true;
    });
  }
}

/** A floor as a link or breadcrumb draws it. */
export interface WorkspaceRef {
  id: string;
  kind: WorkspaceKind;
  name: string;
  slug: string;
}

/** A floor someone can stand on, as they see it. */
export interface Floor extends WorkspaceRef {
  /** From the org down to this floor, itself included; a personal floor is alone on its path. */
  path: WorkspaceRef[];
  /** `lead` on your own floor and on teams you lead. */
  role: MemberRole;
  /**
   * False when you're on it only because you're on a team below it: a Payroll
   * member can stand on Finance, because Finance includes Payroll.
   */
  direct: boolean;
}

const ref = (w: Workspace, name = w.name): WorkspaceRef => ({ id: w.id, kind: w.kind, name, slug: w.slug });

/**
 * Every floor a person can stand on: their own, the org, each team they're on,
 * and every team above those. Access flows down only: being on Finance doesn't
 * put you on Payroll. Ordered your own floor first, then the org, then teams
 * in tree order.
 */
export const floorsFor = async (store: WorkspaceStore, person: { id: string; name: string }): Promise<Floor[]> => {
  const [own, org, teams, mine] = await Promise.all([store.personal(person.id, person.name), store.org(), store.teams(), store.memberships({ person: person.id })]);
  const byId = new Map([org, ...teams].map((w) => [w.id, w]));
  const direct = new Map(mine.map((m) => [m.workspace, m.role]));
  const reachable = new Set<string>();
  for (const m of mine) for (const id of byId.get(m.workspace)?.path ?? []) reachable.add(id);
  const pathOf = (w: Workspace) => w.path.map((id) => byId.get(id)).filter((x): x is Workspace => !!x).map((x) => ref(x));
  const floor = (w: Workspace, role: MemberRole, isDirect: boolean): Floor => ({ ...ref(w), path: pathOf(w), role, direct: isDirect });
  return [
    { ...ref(own, 'You'), path: [ref(own, 'You')], role: 'lead', direct: true },
    floor(org, 'member', true),
    ...teams.filter((t) => reachable.has(t.id)).map((t) => floor(t, direct.get(t.id) ?? 'member', direct.has(t.id))),
  ];
};
