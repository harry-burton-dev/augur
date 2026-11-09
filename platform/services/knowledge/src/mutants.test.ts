// Leaks planted on purpose. Each mutant breaks the fence one known way; the suite must notice every one,
// either the oracle property (a viewer sees what the rules say they mustn't) or the catalog check. A mutant
// that nothing notices means the tests prove less than they claim. No mutation tool: plain SQL.
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { fenceFindings } from './fence.testing.ts';
import { fenceHolds } from './oracle.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);

const sightLooksDown = `create or replace function kg.sight(f text) returns setof text language sql stable security definer set search_path = kg, pg_temp as $$
  with recursive up(id) as (
    select f
    union select m.floor from kg.floors p join kg.floor_members m on m.person = p.owner where p.id = f and p.kind = 'personal'
    union select fl.parent from kg.floors fl join up on fl.id = up.id where fl.parent is not null
  ) select id from up union select id from kg.floors where parent = f $$;`;
const standingUnchecked = `create or replace function kg.my_sight() returns text[] language sql stable security definer set search_path = kg, pg_temp as $$
  select array(select kg.sight(kg.here())) $$;`;
const lookupNames = `create or replace function kg.lookup_key(p_scheme text, p_value text) returns table (entity uuid, in_sight boolean, kept_on text, name text)
  language sql stable security definer set search_path = kg, pg_temp as $$
  select case when k.floor = any ((select kg.my_sight())::text[]) then k.entity end, k.floor = any ((select kg.my_sight())::text[]),
         case when k.floor = any ((select kg.my_sight())::text[]) then k.floor else (select kind from kg.floors where id = k.floor) end,
         (select n.name from kg.entity_names n where n.entity = k.entity and n.floor = k.floor and n.is_label limit 1)
  from kg.identity_keys k where k.scheme = p_scheme and k.value = p_value $$;`;

/** [what it breaks, the SQL that breaks it]. */
const MUTANTS: [string, string][] = [
  ['observations visible from every floor', `alter policy see on kg.observations using (true)`],
  ['row security off on sources', `alter table kg.sources disable row level security`],
  ['beliefs visible whatever their reach', `alter policy see on kg.beliefs using (true)`],
  ['names visible on every floor', `alter policy see on kg.entity_names using (true)`],
  ['evidence ids unfenced', `alter table kg.belief_evidence disable row level security`],
  ['sight looks down as well as up', sightLooksDown],
  ['standing on a floor is not checked', standingUnchecked],
  ['a lookup out of sight gives the name', lookupNames],
  ['kg_app skips row security', `alter role kg_app bypassrls`],
  ['kg_app owns the observations', `alter table kg.observations owner to kg_app`],
  ['kg_app is a member of kg_owner', `grant kg_owner to kg_app`],
  ['live_beliefs runs as its owner', `alter view kg.live_beliefs reset (security_invoker)`],
  ['a definer function without a fixed search_path', `alter function kg.my_sight() reset search_path`],
  ['kg_app can write observations directly', `grant insert on kg.observations to kg_app`],
  ['kg_app can ask any floor its sight', `grant execute on function kg.sight(text) to kg_app`],
  ['floors visible to everyone', `alter policy see on kg.floors using (true)`],
];

describe.skipIf(!DATABASE_URL)('planted leaks', () => {
  afterAll(async () => {
    await db.admin?.query('revoke kg_owner from kg_app').catch(() => undefined);
    await db.rebuild?.();
  });
  it.each(MUTANTS)('notices: %s', async (_, sql) => {
    await db.admin.query('revoke kg_owner from kg_app').catch(() => undefined);
    await db.rebuild(sql);
    const catalog = await fenceFindings(db.admin);
    const property = await fc.check(fenceHolds(db), { numRuns: 40, seed: 20261109 });
    console.log(`mutant | catalog ${catalog.length ? 'noticed' : '-'} | property ${property.failed ? `noticed after ${property.numRuns} worlds` : '-'}`);
    expect(catalog.length > 0 || property.failed, 'neither the catalog check nor the oracle property noticed').toBe(true);
  }, 300_000);
});
