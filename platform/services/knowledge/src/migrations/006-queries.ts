// Migration 6: what the seam's query reads need that row security alone can't answer. The roles the person
// acting holds on a floor (for a queue's "can"), the disputes waiting on them (a dispute is the disputing
// floor's, so a settler above can't read it), the keys a text names, and whether a belief stood as recorded then.
export const sql = String.raw`
-- Each function here is new, made and handed to kg_owner in this migration, so no release before runs on them.
-- squawk-ignore-file ban-revoke
-- The roles the person acting holds on one floor.
create function kg.my_roles(f text) returns text[] language sql stable security definer set search_path = kg, pg_temp as $$
  select coalesce(array_agg(r.role order by r.role), '{}') from kg.floor_roles r where r.floor = f and r.person = kg.me() $$;
alter function kg.my_roles(text) owner to kg_owner;

-- Open disputes waiting on the person acting, from this floor: against a belief this floor holds, when they
-- settle for it, and their own anywhere, which they may withdraw. Ids only: the reason stays the disputing floor's.
create function kg.disputes_waiting() returns table (dispute uuid, belief uuid, mine boolean, settles boolean)
language sql stable security definer set search_path = kg, pg_temp as $$
  select d.id, d.belief, d.by_person = kg.me(), kg.has_role(b.home_floor, 'settler') and b.home_floor = kg.here()
  from kg.disputes d join kg.beliefs b on b.id = d.belief
  where d.settled_at is null and kg.can_stand(kg.me(), kg.here())
    and ((b.home_floor = kg.here() and kg.has_role(b.home_floor, 'settler')) or d.by_person = kg.me()) $$;
alter function kg.disputes_waiting() owner to kg_owner;

-- Whether a belief stood as the floors had it recorded at k: some evidence recorded by then, not yet retracted
-- then, and kept by then if it was flagged. What was forgotten never stood, whenever it was forgotten.
create function kg.stood_at(b uuid, k timestamptz) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.belief_evidence e join kg.observations o on o.id = e.observation
                 where e.belief = b and o.recorded_at <= k and (o.retracted_at is null or o.retracted_at > k) and o.forgotten_at is null
                   and (not o.flagged or o.kept_at <= k)) $$;
alter function kg.stood_at(uuid, timestamptz) owner to kg_owner;

-- The entities whose identity key, kept on a floor in sight, appears in a text: an extractor's surest candidates.
create function kg.keys_in(p_text text) returns setof uuid language sql stable security definer set search_path = kg, pg_temp as $$
  select distinct k.entity from kg.identity_keys k where k.floor = any ((select kg.my_sight())::text[]) and strpos(p_text, k.value) > 0 $$;
alter function kg.keys_in(text) owner to kg_owner;

grant execute on function kg.my_roles(text), kg.disputes_waiting(), kg.stood_at(uuid, timestamptz), kg.keys_in(text) to kg_app;
`;
