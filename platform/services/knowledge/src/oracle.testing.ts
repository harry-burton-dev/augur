// The reference oracle for the floor fence: who may see what, computed straight from the trust-by-floor rules
// (PDR-022: D9 to D13, X1 to X3), in plain TypeScript with no SQL. The property tests build random worlds,
// write them through the service's actions, and compare every read the database answers with this.
// It is written from the rules, not from kg.sight(): where they disagree, one of them is wrong.
import fc from 'fast-check';
import type { KnowledgeDb } from './db.testing.ts';
import { asPerson } from './store.ts';

export interface Floor {
  id: string;
  kind: 'org' | 'team' | 'personal';
  parent?: string;
  owner?: string;
}

/** One person writing one thing on one floor: a source, an entity named there, one observation about it. */
export interface Post {
  by: string;
  on: string;
  /** On a team floor: another member confirms it, the floor holds it (its policy is auto), and the holder raises it. */
  hold?: { checker: string; raise: boolean };
  /** An identity key given to the post's entity. */
  key?: string;
}

export interface World {
  floors: Floor[];
  people: string[];
  members: [floor: string, person: string][];
  posts: Post[];
}

// ---------------------------------------------------------------------------------------------------------
// The rules.

const parentOf = (w: World, f: string) => w.floors.find((x) => x.id === f)?.parent;
const personalOf = (w: World, p: string) => w.floors.find((x) => x.kind === 'personal' && x.owner === p)?.id;
const memberFloors = (w: World, p: string) => w.members.filter(([, q]) => q === p).map(([f]) => f);

/** A floor and every floor above it. */
const andAbove = (w: World, f: string) => {
  const out: string[] = [];
  for (let at: string | undefined = f; at && !out.includes(at); at = parentOf(w, at)) out.push(at);
  return out;
};

/** D13: a floor sees itself and the floors above it. A personal floor also sees its owner's floors and theirs above. */
export const sightOf = (w: World, f: string): Set<string> => {
  const floor = w.floors.find((x) => x.id === f);
  if (!floor) return new Set();
  const out = new Set(andAbove(w, f));
  if (floor.kind === 'personal' && floor.owner) for (const m of memberFloors(w, floor.owner)) for (const a of andAbove(w, m)) out.add(a);
  return out;
};

/** A person stands on their own floor, a floor they are a member of, or one above those. */
export const canStand = (w: World, person: string, f: string) => {
  const own = personalOf(w, person);
  return !!own && sightOf(w, own).has(f);
};

/** What a person standing on a floor sees: nothing at all if they cannot stand there. */
export const mySight = (w: World, person: string, f: string) => (canStand(w, person, f) ? sightOf(w, f) : new Set<string>());

/** A post's held belief reaches its floor, and the floor above once raised (F2: reach, never a copy). */
const reachOf = (w: World, post: Post) => {
  const kind = w.floors.find((x) => x.id === post.on)?.kind;
  if (kind === 'personal') return [post.on];
  if (!post.hold) return [];
  const up = parentOf(w, post.on);
  return post.hold.raise && up ? [post.on, up] : [post.on];
};

/** Whether each step of a post goes through. The oracle predicts refusals too: they are part of the fence. */
export const postSucceeds = (w: World, post: Post) => canStand(w, post.by, post.on);
const holdSucceeds = (w: World, post: Post) =>
  !!post.hold && w.floors.find((x) => x.id === post.on)?.kind === 'team' && post.hold.checker !== post.by && canStand(w, post.hold.checker, post.on);

// ---------------------------------------------------------------------------------------------------------
// Worlds.

/** A random world: one org, a few teams (some nested), a few people with their own floors and memberships, posts. */
export const worldArb: fc.Arbitrary<World> = fc
  .record({
    teams: fc.integer({ min: 1, max: 3 }),
    nest: fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
    people: fc.integer({ min: 2, max: 4 }),
    membership: fc.array(fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }), { minLength: 4, maxLength: 4 }),
  })
  .chain(({ teams, nest, people, membership }) => {
    const floors: Floor[] = [{ id: 'o', kind: 'org' }];
    for (let i = 0; i < teams; i++) floors.push({ id: `t${i}`, kind: 'team', parent: i > 0 && nest[i] ? `t${i - 1}` : 'o' });
    const ps = Array.from({ length: people }, (_, i) => `p${i}`);
    for (const p of ps) floors.push({ id: `y-${p}`, kind: 'personal', owner: p });
    const members: [string, string][] = [];
    ps.forEach((p, i) => floors.filter((f) => f.kind !== 'personal').forEach((f, j) => membership[i]![j] && members.push([f.id, p])));
    const floorIds = floors.map((f) => f.id);
    const post = fc.record(
      {
        by: fc.constantFrom(...ps),
        on: fc.constantFrom(...floorIds),
        hold: fc.option(fc.record({ checker: fc.constantFrom(...ps), raise: fc.boolean() }), { nil: undefined }),
        key: fc.option(fc.constantFrom('k1', 'k2', 'k3'), { nil: undefined }),
      },
      { requiredKeys: ['by', 'on'] },
    );
    return fc.array(post, { minLength: 1, maxLength: 8 }).map((posts) => ({ floors, people: ps, members, posts }));
  });

// ---------------------------------------------------------------------------------------------------------
// Writing a world through the service, and reading it back.

/** What was made for each post, so reads can be compared by id. Keys: the first post to claim a key keeps it. */
export interface Made {
  posts: { post: Post; ok: boolean; held: boolean; source?: string; entity?: string; observation?: string; belief?: string; label: string; key?: string }[];
}

/** Floors and memberships as identity would mirror them; everything else as actions by kg_app. */
export const writeWorld = async (db: KnowledgeDb, w: World): Promise<Made> => {
  await db.empty();
  for (const f of w.floors)
    await db.admin.query(`insert into kg.floors (id, kind, parent, owner, hold_policy) values ($1, $2, $3, $4, $5)`, [f.id, f.kind, f.parent ?? null, f.owner ?? null, f.kind === 'team' ? 'auto' : 'role']);
  for (const [f, p] of w.members) await db.admin.query(`insert into kg.floor_members values ($1, $2)`, [f, p]);
  const made: Made = { posts: [] };
  const keys = new Set<string>();
  for (const [i, post] of w.posts.entries()) {
    const label = `thing-${i}`;
    const acting = { person: post.by, floor: post.on };
    const out: Made['posts'][number] = { post, ok: false, held: false, label };
    try {
      await asPerson(db.app, acting, async (c) => {
        const one = async (sql: string, params: unknown[]) => (await c.query({ text: sql, values: params, rowMode: 'array' })).rows[0]?.[0] as string;
        out.source = await one(`select kg.act_add_source('test', $1, 1, 'x', $2)`, [`ref-${i}`, label]);
        out.entity = await one(`select kg.act_new_entity('kg:Entity', $1)`, [label]);
        out.observation = await one(
          `select kg.act_retain($1, $2, 'kg:note', '{"v":"x"}', null, $3, null, null, 'unknown', 'reported', null, 'test', 'test', 1)`,
          [out.source, out.entity, `quote ${i}`],
        );
        if (post.key && !keys.has(post.key)) {
          await one(`select kg.act_add_key($1, 'test', $2)`, [out.entity, post.key]);
          keys.add(post.key);
          out.key = post.key;
        }
      });
      out.ok = true;
    } catch (err) {
      if (!/refused/.test((err as Error).message)) throw err;
    }
    if (out.ok && w.floors.find((f) => f.id === post.on)?.kind === 'personal') {
      out.belief = (await db.admin.query(`select belief from kg.belief_evidence where observation = $1`, [out.observation])).rows[0]?.belief;
      out.held = true;
    }
    if (out.ok && post.hold) {
      try {
        await asPerson(db.app, { person: post.hold.checker, floor: post.on }, (c) => c.query(`select kg.act_check_faithful($1, 'faithful')`, [out.observation]));
        out.belief = await asPerson(db.app, acting, async (c) => (await c.query({ text: `select kg.act_hold($1::uuid[])`, values: [[out.observation]], rowMode: 'array' })).rows[0]![0]);
        out.held = true;
        if (post.hold.raise && w.floors.find((f) => f.id === post.on)?.parent) {
          await db.admin.query(`insert into kg.floor_roles values ($1, $2, 'raiser') on conflict do nothing`, [post.on, post.by]);
          await asPerson(db.app, acting, (c) => c.query(`select kg.act_raise($1, 'test')`, [out.belief]));
        }
      } catch (err) {
        if (!/refused/.test((err as Error).message)) throw err;
      }
    }
    made.posts.push(out);
  }
  return made;
};

/** What one viewer sees, as sets of ids (and the lookups' answers), from the database or from the oracle. */
export interface View {
  floors: string[];
  sources: string[];
  observations: string[];
  beliefs: string[];
  /** Through the live_beliefs view, which must fence as its readers do. Every belief a world makes stays live. */
  live: string[];
  names: string[];
  entities: string[];
  evidence: string[];
  lookups: string[];
}

const sorted = (xs: Iterable<string>) => [...xs].sort();

export const observe = async (db: KnowledgeDb, person: string, floor: string): Promise<View> => {
  const [row] = await db.peek<Record<string, string[]>>(
    { person, floor },
    `select
      array(select id from kg.floors order by 1) floors,
      array(select id::text from kg.sources order by 1) sources,
      array(select id::text from kg.observations order by 1) observations,
      array(select id::text from kg.beliefs order by 1) beliefs,
      array(select id::text from kg.live_beliefs order by 1) live,
      array(select entity::text || '@' || floor || ':' || name from kg.entity_names order by 1) names,
      array(select id::text from kg.entities order by 1) entities,
      array(select observation::text from kg.belief_evidence order by 1) evidence,
      array(select v || '=' || coalesce(l.entity::text, '-') || '/' || l.in_sight || '/' || l.kept_on || '/' || coalesce(l.name, '-')
            from unnest(array['k1','k2','k3']) v, kg.lookup_key('test', v) l order by 1) lookups`,
  );
  return row as unknown as View;
};

export const predict = (w: World, made: Made, person: string, floor: string): View => {
  const sight = mySight(w, person, floor);
  const ok = made.posts.filter((m) => m.ok);
  const kindOf = (f: string) => w.floors.find((x) => x.id === f)!.kind;
  const seenBeliefs = ok.filter((m) => m.held && m.belief && reachOf(w, m.post).some((f) => sight.has(f)));
  return {
    floors: sorted(w.floors.map((f) => f.id).filter((f) => sight.has(f))),
    sources: sorted(ok.filter((m) => sight.has(m.post.on)).map((m) => m.source!)),
    observations: sorted(ok.filter((m) => sight.has(m.post.on)).map((m) => m.observation!)),
    beliefs: sorted(seenBeliefs.map((m) => m.belief!)),
    live: sorted(seenBeliefs.map((m) => m.belief!)),
    names: sorted(ok.filter((m) => sight.has(m.post.on)).map((m) => `${m.entity}@${m.post.on}:${m.label}`)),
    entities: sorted(ok.filter((m) => sight.has(m.post.on)).map((m) => m.entity!)),
    evidence: sorted(seenBeliefs.filter((m) => sight.has(m.post.on)).map((m) => m.observation!)),
    lookups: sorted(
      ok
        .filter((m) => m.key)
        .map((m) =>
          sight.has(m.post.on)
            ? `${m.key}=${m.entity}/true/${m.post.on}/${m.label}`
            : `${m.key}=-/false/${kindOf(m.post.on)}/-`,
        ),
    ),
  };
};

/** Whether each post's writes went through as the oracle says they should. */
export const predictWrites = (w: World, made: Made) =>
  made.posts.map((m) => ({ post: m.post, ok: m.ok, expectOk: postSucceeds(w, m.post), held: m.held, expectHeld: m.ok && (kindOf(w, m.post.on) === 'personal' || holdSucceeds(w, m.post)) }));
const kindOf = (w: World, f: string) => w.floors.find((x) => x.id === f)!.kind;

/** Every (person, floor) pair in the world, including floors the person may not stand on. */
export const viewers = (w: World) => w.people.flatMap((p) => w.floors.map((f) => [p, f.id] as const));

/** The property: for every viewer, the database shows exactly what the oracle says, and writes succeed or are refused as it says. */
export const fenceHolds = (db: KnowledgeDb) =>
  fc.asyncProperty(worldArb, async (w) => {
    const made = await writeWorld(db, w);
    for (const x of predictWrites(w, made)) {
      if (x.ok !== x.expectOk || x.held !== x.expectHeld) throw new Error(`write: ${JSON.stringify(x)}`);
    }
    for (const [person, floor] of viewers(w)) {
      const got = await observe(db, person, floor);
      const want = predict(w, made, person, floor);
      for (const k of Object.keys(want) as (keyof View)[]) {
        if (JSON.stringify(got[k]) !== JSON.stringify(want[k])) throw new Error(`${person} on ${floor} sees ${k} ${JSON.stringify(got[k])}, the oracle says ${JSON.stringify(want[k])}`);
      }
    }
  });
