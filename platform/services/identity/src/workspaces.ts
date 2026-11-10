import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Migration } from '@augur/service-kit';
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

/**
 * A position (ADR 0089): a job on a team, such as Harbour master, that a person holds. Teams are joined by
 * positions, not people: whoever holds a position now is a member (or lead) of its team, and the next holder is
 * at once. A position with nobody in it keeps its place. A person's own floor is the only one they're on directly.
 */
export interface Position {
  id: string;
  workspace: string;
  role: MemberRole;
  name: string;
  /** Who holds it now; absent while it's vacant. */
  holder?: string;
}

/** A position's name at most this long. */
export const MAX_POSITION_NAME = 80;

/** What a position made from someone's place on a team is called until an admin names it (by its role). */
export const UNNAMED_POSITION: Record<MemberRole, string> = { member: 'Member', lead: 'Lead' };

/** Teams nest at most this deep below the org. */
export const MAX_TEAM_DEPTH = 5;

/**
 * What each level of team is called, from the top: teams right below the org
 * are Departments, and those below them Teams, unless an admin renames them.
 * A level deeper than the names given takes the last one. The kind stays
 * `team` whatever it's called, so apps that check the kind keep working.
 */
export const DEFAULT_LEVELS = ['Department', 'Team'];

/** A level's name at most this long. */
export const MAX_LEVEL_NAME = 40;

/** The name of the level a team sits at: 1 right below the org. */
export const levelName = (levels: string[], depth: number) => levels[Math.min(depth, levels.length) - 1] ?? DEFAULT_LEVELS[DEFAULT_LEVELS.length - 1];

/** Tidied names for each level, or why they can't be used. */
export const checkLevels = (names: string[]): string[] => {
  const tidy = names.map((n) => n.trim().replace(/\s+/g, ' '));
  if (!tidy.length || tidy.length > MAX_TEAM_DEPTH) throw new DirectoryError(`Name between 1 and ${MAX_TEAM_DEPTH} levels.`, 400);
  if (tidy.some((n) => !n || n.length > MAX_LEVEL_NAME)) throw new DirectoryError(`Each level needs a name of up to ${MAX_LEVEL_NAME} characters.`, 400);
  const seen = new Set<string>();
  for (const n of tidy) {
    if (seen.has(n.toLowerCase())) throw new DirectoryError(`Two levels can’t both be called “${n}”: people tell them apart by name.`, 400);
    seen.add(n.toLowerCase());
  }
  return tidy;
};

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
  /** Any floor by id, archived teams included, so old links and audit entries still resolve. */
  workspace(id: string): Promise<Workspace | undefined>;
  memberships(filter?: { person?: string; workspace?: string }): Promise<Membership[]>;
  /** A new team below `parentId`, or right below the org without one. */
  createTeam(name: string, parentId?: string): Promise<Workspace>;
  /** Renames a team. Its slug stays, so links to it keep working. */
  renameTeam(id: string, name: string): Promise<Workspace>;
  /** Renames the organisation's own floor, which is the organisation's name (ADR 0042). */
  renameOrg(name: string): Promise<Workspace>;
  /** What each level of team is called, from the top (see DEFAULT_LEVELS). */
  levels(): Promise<string[]>;
  /** Renames the levels; the names are checked with checkLevels. */
  setLevels(names: string[]): Promise<string[]>;
  /**
   * Adds someone to a team or changes their role; `null` takes them off it. Kept for callers that think in
   * people: it gives the person a position of their own on the team (or changes or empties it).
   */
  setMember(team: string, person: string, role: MemberRole | null): Promise<void>;
  /** The positions on a team, or every team's, that aren't retired, each with who holds it now. */
  positions(filter?: { workspace?: string; holder?: string }): Promise<Position[]>;
  /** A new, vacant position on a team. */
  createPosition(team: string, name: string, role: MemberRole): Promise<Position>;
  /** Renames a position, or changes whether it leads its team. */
  updatePosition(id: string, change: { name?: string; role?: MemberRole }): Promise<Position>;
  /**
   * Hands a position to `person`, or leaves it vacant with `null`: the holder before stops holding it at that
   * moment, and everything given to the position goes with it to the next holder (ADR 0089).
   */
  handOver(id: string, person: string | null): Promise<Position>;
  /** Takes a vacant position away. One that someone holds is handed over first. */
  retirePosition(id: string): Promise<void>;
  /** A deleted person (ADR 0072): out of every team, and their own floor archived under a name that isn't theirs. */
  forgetPerson(person: string, name: string): Promise<void>;
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

/**
 * Schema changes for workspaces, run after the preferences ones in store.ts.
 * `path` is an ltree of ids from the root, so "everything under Finance" is
 * one indexed query.
 */
export const workspaceMigrations: Migration[] = [
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
  {
    // What each level of team is called, 1 right below the org; without a row, DEFAULT_LEVELS.
    id: '003_team_levels',
    sql: `
      create table identity.team_levels (
        depth int primary key check (depth between 1 and ${MAX_TEAM_DEPTH}),
        name text not null,
        updated_at timestamptz not null default now()
      );`,
  },
];

/**
 * Positions (ADR 0089), run last of identity's migrations. Each place someone had on a team becomes a position
 * on that team, named by its role until an admin names it, that the person holds from when they joined.
 * workspace_members is no longer read, but every change still writes it for one major, so going back to an
 * earlier release finds who is on each team as it is now.
 */
export const positionMigrations: Migration[] = [
  {
    id: 'workspaces_004_positions',
    sql: `
      create table identity.positions (
        id text primary key,
        workspace_id text not null references identity.workspaces (id),
        role text not null check (role in ('member', 'lead')),
        name text not null,
        created_at timestamptz not null default now(),
        retired_at timestamptz
      );
      create index positions_workspace on identity.positions (workspace_id) where retired_at is null;
      create table identity.position_holders (
        position_id text not null references identity.positions (id),
        person text not null,
        since timestamptz not null default now(),
        until timestamptz,
        check (until is null or until >= since)
      );
      create unique index position_holders_now on identity.position_holders (position_id) where until is null;
      create index position_holders_person on identity.position_holders (person) where until is null;
      insert into identity.positions (id, workspace_id, role, name, created_at)
        select md5(workspace_id || '/' || person), workspace_id, role, case role when 'lead' then 'Lead' else 'Member' end, added_at
        from identity.workspace_members;
      insert into identity.position_holders (position_id, person, since)
        select md5(workspace_id || '/' || person), person, added_at from identity.workspace_members;`,
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

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

interface PositionRow {
  id: string;
  workspace_id: string;
  role: MemberRole;
  name: string;
  holder: string | null;
}
const POSITION_COLUMNS = 'p.id, p.workspace_id, p.role, p.name, h.person as holder';
const POSITION_FROM = 'from identity.positions p left join identity.position_holders h on h.position_id = p.id and h.until is null';
const fromPositionRow = (r: PositionRow): Position => ({ id: r.id, workspace: r.workspace_id, role: r.role, name: r.name, ...(r.holder ? { holder: r.holder } : {}) });

/** A position's tidied name, or why it can't be used. */
export const checkPositionName = (name: string) => {
  const tidy = name.trim().replace(/\s+/g, ' ');
  if (!tidy || tidy.length > MAX_POSITION_NAME) throw new DirectoryError(`A position needs a name of up to ${MAX_POSITION_NAME} characters.`, 400);
  return tidy;
};

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

  async workspace(id: string) {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from identity.workspaces where id = $1`, [id]);
    return rows[0] && fromRow(rows[0]);
  }

  async memberships(filter: { person?: string; workspace?: string } = {}) {
    // Where people stand comes from the positions they hold (ADR 0089). Someone holding two on one team is
    // on it once, as its lead if either leads it; they're listed from when they first held one there.
    const { rows } = await this.pool.query<{ workspace_id: string; person: string; lead: boolean }>(
      `select p.workspace_id, h.person, bool_or(p.role = 'lead') as lead
       from identity.positions p join identity.position_holders h on h.position_id = p.id and h.until is null
       where p.retired_at is null and ($1::text is null or h.person = $1) and ($2::text is null or p.workspace_id = $2)
       group by p.workspace_id, h.person
       order by min(h.since), h.person`,
      [filter.person ?? null, filter.workspace ?? null],
    );
    return rows.map((r) => ({ workspace: r.workspace_id, person: r.person, role: (r.lead ? 'lead' : 'member') as MemberRole }));
  }

  async positions(filter: { workspace?: string; holder?: string } = {}) {
    const { rows } = await this.pool.query<PositionRow>(
      `select ${POSITION_COLUMNS} ${POSITION_FROM}
       where p.retired_at is null and ($1::text is null or p.workspace_id = $1) and ($2::text is null or h.person = $2)
       order by p.created_at, p.id`,
      [filter.workspace ?? null, filter.holder ?? null],
    );
    return rows.map(fromPositionRow);
  }

  async createPosition(team: string, name: string, role: MemberRole) {
    await this.liveTeam(team);
    const position = { id: newId(), workspace: team, role, name: checkPositionName(name) };
    await this.pool.query('insert into identity.positions (id, workspace_id, role, name) values ($1, $2, $3, $4)', [position.id, team, role, position.name]);
    return position;
  }

  updatePosition(id: string, change: { name?: string; role?: MemberRole }) {
    const name = change.name === undefined ? null : checkPositionName(change.name);
    return this.inTransaction(async (q) => {
      const { rows } = await q.query<{ workspace_id: string }>(
        `update identity.positions set name = coalesce($2, name), role = coalesce($3, role) where id = $1 and retired_at is null returning workspace_id`,
        [id, name, change.role ?? null],
      );
      if (!rows[0]) throw new DirectoryError('That position no longer exists.', 404);
      await this.mirror(q, rows[0].workspace_id);
      return (await this.position(id, q))!;
    });
  }

  handOver(id: string, person: string | null) {
    return this.inTransaction(async (q) => {
      const { rows } = await q.query<{ workspace_id: string }>('select workspace_id from identity.positions where id = $1 and retired_at is null for update', [id]);
      if (!rows[0]) throw new DirectoryError('That position no longer exists.', 404);
      await q.query('update identity.position_holders set until = now() where position_id = $1 and until is null', [id]);
      if (person) await q.query('insert into identity.position_holders (position_id, person) values ($1, $2)', [id, person]);
      await this.mirror(q, rows[0].workspace_id);
      return (await this.position(id, q))!;
    });
  }

  retirePosition(id: string) {
    return this.inTransaction(async (q) => {
      await q.query('update identity.position_holders set until = now() where position_id = $1 and until is null', [id]);
      const { rows } = await q.query<{ workspace_id: string }>('update identity.positions set retired_at = coalesce(retired_at, now()) where id = $1 returning workspace_id', [id]);
      if (rows[0]) await this.mirror(q, rows[0].workspace_id);
    });
  }

  /** Writes workspace_members for one team from who holds its positions now, for a release before positions. */
  private async mirror(q: Querier, team: string) {
    await q.query('delete from identity.workspace_members where workspace_id = $1', [team]);
    await q.query(
      `insert into identity.workspace_members (workspace_id, person, role, added_at)
       select p.workspace_id, h.person, case when bool_or(p.role = 'lead') then 'lead' else 'member' end, min(h.since)
       from identity.positions p join identity.position_holders h on h.position_id = p.id and h.until is null
       where p.workspace_id = $1 and p.retired_at is null
       group by p.workspace_id, h.person`,
      [team],
    );
  }

  private async position(id: string, q: Queryable = this.pool) {
    const { rows } = await q.query<PositionRow>(`select ${POSITION_COLUMNS} ${POSITION_FROM} where p.id = $1 and p.retired_at is null`, [id]);
    return rows[0] && fromPositionRow(rows[0]);
  }

  private async liveTeam(team: string, q: Queryable = this.pool) {
    const { rowCount } = await q.query(`select 1 from identity.workspaces where id = $1 and kind = 'team' and archived_at is null`, [team]);
    if (!rowCount) throw new DirectoryError('That department no longer exists.', 404);
  }

  private async inTransaction<T>(work: (q: pg.PoolClient) => Promise<T>): Promise<T> {
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

  async levels() {
    const { rows } = await this.pool.query<{ name: string }>('select name from identity.team_levels order by depth');
    return rows.length ? rows.map((r) => r.name) : [...DEFAULT_LEVELS];
  }

  async setLevels(names: string[]) {
    const levels = checkLevels(names);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from identity.team_levels');
      for (const [i, name] of levels.entries()) await client.query('insert into identity.team_levels (depth, name) values ($1, $2)', [i + 1, name]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return levels;
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

  renameOrg(name: string) {
    return this.locked(async (q) => {
      const org = await this.orgIn(q);
      await q.query('update identity.workspaces set name = $2 where id = $1', [org.id, name]);
      return { ...org, name };
    });
  }

  setMember(team: string, person: string, role: MemberRole | null) {
    return this.inTransaction(async (q) => {
      await this.liveTeam(team, q);
      const { rows } = await q.query<{ id: string; role: MemberRole }>(
        `select p.id, p.role from identity.positions p join identity.position_holders h on h.position_id = p.id and h.until is null
         where p.workspace_id = $1 and h.person = $2 and p.retired_at is null order by h.since`,
        [team, person],
      );
      if (!role) {
        // Off the team: they stop holding its positions. One still named for its role was made for them alone
        // and goes too; one an admin named stays, vacant, for whoever holds it next.
        for (const p of rows) {
          await q.query('update identity.position_holders set until = now() where position_id = $1 and until is null', [p.id]);
          await q.query('update identity.positions set retired_at = now() where id = $1 and name = $2', [p.id, UNNAMED_POSITION[p.role]]);
        }
      } else if (rows.some((p) => p.role === role)) return;
      else if (rows[0]) await q.query('update identity.positions set role = $2 where id = $1', [rows[0].id, role]);
      else {
        const id = newId();
        await q.query('insert into identity.positions (id, workspace_id, role, name) values ($1, $2, $3, $4)', [id, team, role, UNNAMED_POSITION[role]]);
        await q.query('insert into identity.position_holders (position_id, person) values ($1, $2)', [id, person]);
      }
      await this.mirror(q, team);
    });
  }

  async forgetPerson(person: string, name: string) {
    // A deleted person leaves no trace in who held what (ADR 0072); the positions they held stay, vacant.
    await this.pool.query('delete from identity.position_holders where person = $1', [person]);
    await this.pool.query('delete from identity.workspace_members where person = $1', [person]);
    await this.pool.query(`update identity.workspaces set name = $2, archived_at = coalesce(archived_at, now()) where kind = 'personal' and owner = $1`, [person, name]);
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
          const id = newId();
          await q.query(`insert into identity.positions (id, workspace_id, role, name) values ($1, $2, 'member', $3)`, [id, team.id, UNNAMED_POSITION.member]);
          await q.query('insert into identity.position_holders (position_id, person) values ($1, $2)', [id, person]);
        }
        await this.mirror(q, team.id);
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
  /** A team's level, by name: "Department" right below the org, "Team" below that, unless an admin renamed them. */
  level?: string;
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

/** A team's depth below the org: 1 right below it. */
export const depthOf = (w: Pick<Workspace, 'path'>) => w.path.length - 1;

const ref = (w: Workspace, levels: string[], name = w.name): WorkspaceRef => ({
  id: w.id,
  kind: w.kind,
  name,
  slug: w.slug,
  ...(w.kind === 'team' ? { level: levelName(levels, depthOf(w)) } : {}),
});

/**
 * Every floor a person can stand on: their own, the org, each team they're on,
 * and every team above those. Access flows down only: being on Finance doesn't
 * put you on Payroll. Ordered your own floor first, then the org, then teams
 * in tree order.
 */
export const floorsFor = async (store: WorkspaceStore, person: { id: string; name: string }): Promise<Floor[]> => {
  const [own, org, teams, mine, levels] = await Promise.all([store.personal(person.id, person.name), store.org(), store.teams(), store.memberships({ person: person.id }), store.levels()]);
  const byId = new Map([org, ...teams].map((w) => [w.id, w]));
  const direct = new Map(mine.map((m) => [m.workspace, m.role]));
  const reachable = new Set<string>();
  for (const m of mine) for (const id of byId.get(m.workspace)?.path ?? []) reachable.add(id);
  const pathOf = (w: Workspace) => w.path.map((id) => byId.get(id)).filter((x): x is Workspace => !!x).map((x) => ref(x, levels));
  const floor = (w: Workspace, role: MemberRole, isDirect: boolean): Floor => ({ ...ref(w, levels), path: pathOf(w), role, direct: isDirect });
  return [
    { ...ref(own, levels, 'You'), path: [ref(own, levels, 'You')], role: 'lead', direct: true },
    floor(org, 'member', true),
    ...teams.filter((t) => reachable.has(t.id)).map((t) => floor(t, direct.get(t.id) ?? 'member', direct.has(t.id))),
  ];
};

/** The floors to roll up from one: it and every team below it that the person can stand on. */
export const rollupFor = (floors: Floor[], id: string) => floors.filter((f) => f.path.some((p) => p.id === id));
