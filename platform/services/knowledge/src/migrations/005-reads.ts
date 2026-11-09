// Migration 5: what the seam's object reads need that row security alone can't answer. An action's record is
// the caller's own; an observation or a source asked for by id that isn't in sight says only the kind of floor
// it is on (never a personal floor's); and the ontology's own helpers, which hold nothing of any floor.
export const sql = String.raw`
-- Each function here is new, made and handed to kg_owner in this migration, so no release before runs on them.
-- squawk-ignore-file ban-revoke
-- The record of one action the person acting took, by the id its answer gave.
create function kg.my_run(p_id text) returns table (action text, answer jsonb, at timestamptz)
language sql stable security definer set search_path = kg, pg_temp as $$
  select a.action, a.answer, a.at from kg.action_answers a where a.person = kg.me() and a.answer ->> 'actionId' = p_id $$;
alter function kg.my_run(text) owner to kg_owner;

-- An observation or source asked for by id that isn't in sight: the kind of floor it is on, as entity_elsewhere
-- does for entities. Nothing for a personal floor's, or for one in sight (row security answers those).
create function kg.observation_elsewhere(p_id uuid) returns text language sql stable security definer set search_path = kg, pg_temp as $$
  select f.kind from kg.observations o join kg.floors f on f.id = o.floor
  where o.id = p_id and f.kind <> 'personal' and not (o.floor = any ((select kg.my_sight())::text[])) $$;
alter function kg.observation_elsewhere(uuid) owner to kg_owner;
create function kg.source_elsewhere(p_id uuid) returns text language sql stable security definer set search_path = kg, pg_temp as $$
  select f.kind from kg.sources s join kg.floors f on f.id = s.floor
  where s.id = p_id and f.kind <> 'personal' and not (s.floor = any ((select kg.my_sight())::text[])) $$;
alter function kg.source_elsewhere(uuid) owner to kg_owner;

grant execute on function kg.my_run(text), kg.observation_elsewhere(uuid), kg.source_elsewhere(uuid), kg.subclass_of(text, text), kg.is_occurrent(text) to kg_app;
`;
