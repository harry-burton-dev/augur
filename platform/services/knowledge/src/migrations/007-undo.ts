// Migration 7: undo and retire (plan PR 6). An answer remembers when it was undone. Undoing what was retained
// retracts it (the store already can); undoing a hold withdraws the belief from every floor it reached and
// restores what it replaced, or takes back only the evidence it added; undoing a keep lets the observation fall
// back to flagged. Retire takes an entity out of use on a floor's authority, as merge does; nothing is deleted.
export const sql = String.raw`
-- Each function here is new, made and handed to kg_owner in this migration, so no release before runs on them.
alter table kg.action_answers add column undone_at timestamptz, add column undone_why text;

-- When the person acting undid one of their own actions, by the id its answer gave, or null.
create function kg.run_undone(p_id text) returns timestamptz language sql stable security definer set search_path = kg, pg_temp as $$
  select a.undone_at from kg.action_answers a where a.person = kg.me() and a.answer ->> 'actionId' = p_id $$;
alter function kg.run_undone(text) owner to kg_owner;

-- Marks one of the person's own answers undone, once.
create function kg.act_mark_undone(p_id text, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  update kg.action_answers set undone_at = clock_timestamp(), undone_why = p_why
   where person = kg.me() and answer ->> 'actionId' = p_id and undone_at is null;
  perform kg.require(found, 'that action is not yours, or it was already undone');
end $$;
alter function kg.act_mark_undone(text, text) owner to kg_owner;

-- Undo a hold. p_obs is the evidence the hold gave. When the belief rests on more than that, the hold added
-- evidence to it, and only that evidence goes; otherwise the belief is withdrawn from every floor it reached,
-- and what it superseded stands again.
create function kg.act_unhold(p_belief uuid, p_obs uuid[], p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare b kg.beliefs;
begin
  select * into b from kg.beliefs where id = p_belief;
  perform kg.require(b.id is not null and b.held_by <> 'memory', 'that belief was not held by anyone');
  perform kg.require(kg.can_stand(kg.me(), b.home_floor), 'you are not on that floor');
  perform kg.require((select hold_policy from kg.floors where id = b.home_floor) = 'auto' or kg.has_role(b.home_floor, 'settler'), 'undoing a hold needs the floor''s settler role');
  if exists (select 1 from kg.belief_evidence where belief = p_belief and observation <> all (p_obs)) then
    delete from kg.belief_evidence where belief = p_belief and observation = any (p_obs);
  else
    update kg.belief_reach set withdrawn_at = clock_timestamp(), withdrawn_by = kg.me() where belief = p_belief and withdrawn_at is null;
    update kg.beliefs set superseded_at = null, superseded_by = null where superseded_by = p_belief;
  end if;
  perform kg.record('unhold', b.home_floor, jsonb_build_object('belief', p_belief, 'observations', p_obs, 'why', p_why));
end $$;
alter function kg.act_unhold(uuid, uuid[], text) owner to kg_owner;

-- Undo a keep: the observation is flagged again, and the memory it made is withdrawn.
create function kg.act_unkeep(p_obs uuid, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations;
begin
  select * into o from kg.observations where id = p_obs;
  perform kg.require((select owner from kg.floors where id = o.floor) = kg.me(), 'only the owner undoes a keep, on their own floor');
  perform kg.require(o.kept_at is not null, 'it is not kept');
  update kg.observations set kept_at = null, kept_by = null where id = p_obs;
  update kg.belief_reach set withdrawn_at = clock_timestamp(), withdrawn_by = kg.me()
   where withdrawn_at is null and belief in (select e.belief from kg.belief_evidence e join kg.beliefs bb on bb.id = e.belief where e.observation = p_obs and bb.held_by = 'memory');
  perform kg.record('unkeep', o.floor, jsonb_build_object('observation', p_obs, 'why', p_why));
end $$;
alter function kg.act_unkeep(uuid, text) owner to kg_owner;

-- Retire: an entity stops being used on this floor's authority. It stays, with all that was said of it.
create function kg.act_retire(p_entity uuid, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.has_role(kg.here(), 'settler'), 'retiring needs the floor''s settler role');
  perform kg.require((select state from kg.entities where id = p_entity) = 'active', 'only an active entity is retired');
  update kg.entities set state = 'retired' where id = p_entity;
  perform kg.record('retire', kg.here(), jsonb_build_object('entity', p_entity, 'why', p_why));
end $$;
alter function kg.act_retire(uuid, text) owner to kg_owner;

grant execute on function kg.run_undone(text), kg.act_mark_undone(text, text), kg.act_unhold(uuid, uuid[], text), kg.act_unkeep(uuid, text), kg.act_retire(uuid, text) to kg_app;
`;
