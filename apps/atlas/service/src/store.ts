import pg from 'pg';
import { ulid } from 'ulid';
import { detailsOf, starterSql, type DetailDef, type Ontology, type TypeDef } from './ontology.ts';

/**
 * One real thing the organisation keeps track of: a ship, a port, a company.
 * It has one id for life, a kind (its type in the ontology), a name and the
 * other names it goes by, and the details that say which thing it is. It sits
 * on one floor (`floor`, a principal), which decides who sees it from where.
 */
export interface Entity {
  /** `ent_` and a ULID. */
  id: string;
  type: string;
  label: string;
  /** Other names it goes by, such as a former name or a short one. */
  aliases: string[];
  description: string;
  /** Its details by key, as the ontology names them (`imo`, `mmsi`). */
  details: Record<string, string>;
  /** The floor it was made on. */
  workspace: string;
  /** Who that floor lets in: `person:<owner>`, `tree:<team>` or `org`. */
  floor: string;
  state: 'active' | 'retired';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface NewEntity {
  type: string;
  label: string;
  aliases?: string[];
  description?: string;
  details?: Record<string, string>;
  workspace: string;
  floor: string;
  createdBy: string;
}

export type EntityChange = Partial<Pick<Entity, 'label' | 'aliases' | 'description' | 'details'>>;

export interface EntityQuery {
  /** Only entities kept on these floors. */
  floors: readonly string[];
  /** Words in its name, another name, or an identity key's value. */
  q?: string;
  /** Only these types (a kind's subtypes are the caller's to add). */
  types?: readonly string[];
  limit?: number;
  offset?: number;
}

/** Another entity already has that identity key: it's the same real thing, or the value is wrong. */
export class KeyTakenError extends Error {
  readonly detail: DetailDef;
  readonly value: string;
  readonly holder: Pick<Entity, 'id' | 'type' | 'label' | 'floor'>;
  constructor(detail: DetailDef, value: string, holder: Pick<Entity, 'id' | 'type' | 'label' | 'floor'>) {
    super(`${detail.label} ${value} is already ${holder.label}’s.`);
    this.detail = detail;
    this.value = value;
    this.holder = holder;
  }
}

/** Each change to the database, in order. A shipped one never changes: add another. */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_entities',
    sql: `
      create table atlas.ontology_versions (
        version integer primary key,
        note text not null default '',
        made_at timestamptz not null default now()
      );
      -- The kinds of thing kept, as a tree. Each names the ontology pack it comes from and that pack's own term for it.
      create table atlas.ontology_types (
        key text primary key,
        parent text references atlas.ontology_types(key),
        label text not null,
        plural text not null,
        abstract boolean not null default false,
        icon text not null,
        pack text not null,
        pack_term text not null,
        pack_iri text,
        sort integer not null default 0
      );
      create table atlas.ontology_details (
        type text not null references atlas.ontology_types(key),
        key text not null,
        label text not null,
        kind text not null check (kind in ('text', 'number', 'date')),
        identity boolean not null default false,
        pattern text,
        hint text,
        sort integer not null default 0,
        primary key (type, key)
      );
      create table atlas.entities (
        id text primary key,
        type text not null references atlas.ontology_types(key),
        label text not null,
        aliases text[] not null default '{}',
        description text not null default '',
        details jsonb not null default '{}',
        workspace_id text not null,
        floor text not null,
        state text not null default 'active' check (state in ('active', 'retired')),
        -- Reserved for protective markings, should AUGUR take them up.
        marking jsonb,
        created_by text not null,
        created_at timestamptz not null default now(),
        updated_by text not null,
        updated_at timestamptz not null default now()
      );
      create index entities_floor on atlas.entities (floor) where state = 'active';
      create index entities_type on atlas.entities (type) where state = 'active';
      -- Identity keys, one row each, so no two entities share one whatever their floor.
      create table atlas.entity_keys (
        entity text not null references atlas.entities(id),
        type text not null,
        key text not null,
        value text not null,
        primary key (entity, key),
        unique (type, key, value)
      );
    `,
  },
  { id: '002_starter_ontology', sql: starterSql() },
];

interface EntityRow {
  id: string;
  type: string;
  label: string;
  aliases: string[];
  description: string;
  details: Record<string, string>;
  workspace_id: string;
  floor: string;
  state: Entity['state'];
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

const ENTITY_COLUMNS = 'id, type, label, aliases, description, details, workspace_id, floor, state, created_by, created_at, updated_by, updated_at';

const fromRow = (r: EntityRow): Entity => ({
  id: r.id,
  type: r.type,
  label: r.label,
  aliases: r.aliases,
  description: r.description,
  details: r.details,
  workspace: r.workspace_id,
  floor: r.floor,
  state: r.state,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString(),
  updatedBy: r.updated_by,
  updatedAt: r.updated_at.toISOString(),
});

/** A new entity's id: `ent_` and a ULID, so ids sort by when they were made. */
export const newEntityId = () => `ent_${ulid()}`;

/** Data Atlas's tables, in its own schema. The graph lives in Postgres (decided 27 October 2026). */
export class PgAtlasStore {
  private readonly pool: pg.Pool;

  private constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  static async connect(connectionString: string) {
    const store = new PgAtlasStore(new pg.Pool({ connectionString, max: 4, options: '-c search_path=atlas' }));
    await store.migrate();
    return store;
  }

  /** Brings the schema up to date. Safe to run from several instances at once. */
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('atlas.migrate'))");
      // On a server the platform makes the schema for Data Atlas's login, which may not create schemas
      // itself: Postgres checks that right even for "if not exists", so only ask when there is none.
      const { rowCount } = await client.query("select 1 from pg_namespace where nspname = 'atlas'");
      if (!rowCount) await client.query('create schema atlas');
      await client.query('create table if not exists atlas.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from atlas.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into atlas.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async ontology(): Promise<Ontology> {
    const [version, types, details] = await Promise.all([
      this.pool.query<{ version: number }>('select coalesce(max(version), 0) as version from atlas.ontology_versions'),
      this.pool.query<{ key: string; parent: string | null; label: string; plural: string; abstract: boolean; icon: string; pack: string; pack_term: string }>(
        'select key, parent, label, plural, abstract, icon, pack, pack_term from atlas.ontology_types order by sort, key',
      ),
      this.pool.query<{ type: string; key: string; label: string; kind: DetailDef['kind']; identity: boolean; pattern: string | null; hint: string | null }>(
        'select type, key, label, kind, identity, pattern, hint from atlas.ontology_details order by type, sort, key',
      ),
    ]);
    return {
      version: version.rows[0].version,
      types: types.rows.map(
        (t): TypeDef => ({
          key: t.key,
          label: t.label,
          plural: t.plural,
          ...(t.parent ? { parent: t.parent } : {}),
          abstract: t.abstract,
          icon: t.icon,
          pack: t.pack,
          packTerm: t.pack_term,
          details: details.rows
            .filter((d) => d.type === t.key)
            .map((d) => ({ key: d.key, label: d.label, kind: d.kind, identity: d.identity, ...(d.pattern ? { pattern: d.pattern } : {}), ...(d.hint ? { hint: d.hint } : {}) })),
        }),
      ),
    };
  }

  async entity(id: string): Promise<Entity | undefined> {
    const { rows } = await this.pool.query<EntityRow>(`select ${ENTITY_COLUMNS} from atlas.entities where id = $1`, [id]);
    return rows[0] && fromRow(rows[0]);
  }

  /** Active entities kept on the given floors, by name. */
  async entities({ floors, q, types, limit = 50, offset = 0 }: EntityQuery): Promise<{ entities: Entity[]; total: number }> {
    const where = ["state = 'active'", 'floor = any($1)'];
    const params: unknown[] = [floors];
    if (types?.length) {
      params.push(types);
      where.push(`type = any($${params.length})`);
    }
    const words = q?.trim();
    if (words) {
      params.push(`%${words.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, words.replace(/\s+/g, '').toUpperCase());
      const like = `$${params.length - 1}`;
      const key = `$${params.length}`;
      where.push(
        `(label ilike ${like} or exists (select 1 from unnest(aliases) a where a ilike ${like}) or exists (select 1 from atlas.entity_keys k where k.entity = entities.id and upper(k.value) = ${key}))`,
      );
    }
    const filter = where.join(' and ');
    const [found, count] = await Promise.all([
      this.pool.query<EntityRow>(`select ${ENTITY_COLUMNS} from atlas.entities where ${filter} order by lower(label), id limit ${Number(limit)} offset ${Number(offset)}`, params),
      this.pool.query<{ total: string }>(`select count(*) as total from atlas.entities where ${filter}`, params),
    ]);
    return { entities: found.rows.map(fromRow), total: Number(count.rows[0].total) };
  }

  async createEntity(e: NewEntity, ontology: Ontology): Promise<Entity> {
    const id = newEntityId();
    return this.inTransaction(async (client) => {
      const { rows } = await client.query<EntityRow>(
        `insert into atlas.entities (id, type, label, aliases, description, details, workspace_id, floor, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) returning ${ENTITY_COLUMNS}`,
        [id, e.type, e.label, e.aliases ?? [], e.description ?? '', e.details ?? {}, e.workspace, e.floor, e.createdBy],
      );
      await this.keepKeys(client, id, e.type, e.details ?? {}, ontology);
      return fromRow(rows[0]);
    });
  }

  async updateEntity(id: string, change: EntityChange, by: string, ontology: Ontology): Promise<Entity | undefined> {
    return this.inTransaction(async (client) => {
      const { rows } = await client.query<EntityRow>(
        `update atlas.entities set
           label = coalesce($2, label), aliases = coalesce($3, aliases), description = coalesce($4, description), details = coalesce($5, details),
           updated_by = $6, updated_at = now()
         where id = $1 and state = 'active' returning ${ENTITY_COLUMNS}`,
        [id, change.label ?? null, change.aliases ?? null, change.description ?? null, change.details ?? null, by],
      );
      if (!rows[0]) return undefined;
      if (change.details) await this.keepKeys(client, id, rows[0].type, change.details, ontology);
      return fromRow(rows[0]);
    });
  }

  /** Takes an entity out of use. It keeps its id, so what points at it still says what it was. */
  async retireEntity(id: string, by: string): Promise<Entity | undefined> {
    return this.inTransaction(async (client) => {
      const { rows } = await client.query<EntityRow>(
        `update atlas.entities set state = 'retired', updated_by = $2, updated_at = now() where id = $1 and state = 'active' returning ${ENTITY_COLUMNS}`,
        [id, by],
      );
      // Its identity keys are free again: a retired entity is no longer the thing they name.
      if (rows[0]) await client.query('delete from atlas.entity_keys where entity = $1', [id]);
      return rows[0] && fromRow(rows[0]);
    });
  }

  /** Writes an entity's identity keys afresh, refusing one another entity holds. */
  private async keepKeys(client: pg.PoolClient, id: string, type: string, details: Record<string, string>, ontology: Ontology) {
    await client.query('delete from atlas.entity_keys where entity = $1', [id]);
    for (const detail of detailsOf(ontology, type).filter((d) => d.identity && details[d.key])) {
      const value = details[detail.key];
      const { rows } = await client.query<{ id: string; type: string; label: string; floor: string }>(
        `select e.id, e.type, e.label, e.floor from atlas.entity_keys k join atlas.entities e on e.id = k.entity where k.type = $1 and k.key = $2 and k.value = $3`,
        [type, detail.key, value],
      );
      if (rows[0]) throw new KeyTakenError(detail, value, rows[0]);
      await client.query('insert into atlas.entity_keys (entity, type, key, value) values ($1, $2, $3, $4)', [id, type, detail.key, value]);
    }
  }

  private async inTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      // Two people adding the same key at once: the second hears who has it, as if they'd been second all along.
      if ((err as { code?: string }).code === '23505' && (err as { constraint?: string }).constraint === 'entity_keys_type_key_value_key') {
        throw new Error('That identity key was just given to another entity. Try again to see which.');
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
