// Migration 4: what the service needs to stand between people and the store. Floors and memberships come
// from identity (the service mirrors the person acting, on each call), answers are kept per Idempotency-Key,
// and the outbox is read and marked through two functions. kg_app still writes nothing directly.
export const sql = String.raw`
-- Every object these statements change or hand to kg_owner is made by migrations in the same release, so no
-- release before runs on them: replacing or re-owning here changes nothing a rollback could meet.
-- squawk-ignore-file ban-revoke, ban-replace-view-function
-- Standing now goes by memberships, as identity's rule does: your own floor, each floor you are a member
-- of, and every floor above those. Before, it went through the person's own floor, which the service only
-- learns once they stand on it. The answer is the same whenever that floor is known (oracle.testing.ts).
create or replace function kg.can_stand(person text, f text) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.floors where id = f and owner = person)
      or exists (
        with recursive up(id) as (
          select m.floor from kg.floor_members m where m.person = can_stand.person
          union
          select fl.parent from kg.floors fl join up on fl.id = up.id where fl.parent is not null
        ) select 1 from up where up.id = f)
$$;
alter function kg.can_stand(text, text) owner to kg_owner;

-- T6 again: the service says who is acting, so it also says where they stand, as identity told it. It
-- passes the floors from the org down (parents first), the ones the person is a member of, and their own
-- floor once it knows it. A team that moved takes its new parent; a membership identity no longer gives goes.
create function kg.sync_person(p_person text, p_floors jsonb, p_member_of text[], p_personal text default null)
returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare f jsonb;
begin
  perform kg.require(p_person is not null and p_person <> '', 'no person is named');
  for f in select value from jsonb_array_elements(coalesce(p_floors, '[]')) loop
    insert into kg.floors (id, kind, parent) values (f->>'id', f->>'kind', nullif(f->>'parent', ''))
    on conflict (id) do update set parent = excluded.parent where kg.floors.kind <> 'personal' and kg.floors.parent is distinct from excluded.parent;
  end loop;
  if p_personal is not null then
    insert into kg.floors (id, kind, owner) values (p_personal, 'personal', p_person) on conflict (id) do nothing;
    perform kg.require((select owner from kg.floors where id = p_personal) = p_person, 'that floor is someone else''s');
  end if;
  -- This runs on each call, not at migration, and drops only the memberships identity no longer gives.
  -- squawk-ignore augur-delete-rows
  delete from kg.floor_members where person = p_person and not (floor = any (coalesce(p_member_of, '{}')));
  insert into kg.floor_members (floor, person) select m, p_person from unnest(coalesce(p_member_of, '{}')) m on conflict do nothing;
end $$;
alter function kg.sync_person(text, jsonb, text[], text) owner to kg_owner;

-- An action's first answer, by the person's Idempotency-Key, so a repeat replays it and the same key with
-- another body is refused. Kept with the action, in its transaction: an action that rolls back keeps no answer.
create table kg.action_answers (
  person text not null,
  idempotency_key text not null,
  action text not null,
  body_sha256 text not null,
  answer jsonb not null,
  at timestamptz not null default clock_timestamp(),
  primary key (person, idempotency_key));
alter table kg.action_answers owner to kg_owner;
alter table kg.action_answers enable row level security;
create function kg.answer_for(p_key text) returns table (action text, body_sha256 text, answer jsonb)
language sql stable security definer set search_path = kg, pg_temp as $$
  select a.action, a.body_sha256, a.answer from kg.action_answers a where a.person = kg.me() and a.idempotency_key = p_key $$;
alter function kg.answer_for(text) owner to kg_owner;
create function kg.keep_answer(p_key text, p_action text, p_sha text, p_answer jsonb) returns void
language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.me() is not null, 'no person is acting');
  insert into kg.action_answers (person, idempotency_key, action, body_sha256, answer) values (kg.me(), p_key, p_action, p_sha, p_answer);
end $$;
alter function kg.keep_answer(text, text, text, jsonb) owner to kg_owner;

-- The outbox, for the relay: the oldest rows not sent, locked for this transaction, and marking them sent.
create function kg.outbox_take(p_limit integer) returns setof kg.outbox language sql security definer set search_path = kg, pg_temp as $$
  select * from kg.outbox where sent_at is null order by id limit greatest(1, least(p_limit, 500)) for update skip locked $$;
alter function kg.outbox_take(integer) owner to kg_owner;
create function kg.outbox_sent(p_ids bigint[]) returns void language sql security definer set search_path = kg, pg_temp as $$
  update kg.outbox set sent_at = now() where id = any (p_ids) and sent_at is null $$;
alter function kg.outbox_sent(bigint[]) owner to kg_owner;

-- An entity asked for by id that isn't in sight: the kind of floor it was first seen on, so the answer can be an
-- Unseen that names no label (draft 4, "explain, never hide"). One first seen on a personal floor gives
-- nothing: nobody but its owner may know a personal floor holds anything.
create function kg.entity_elsewhere(p_entity uuid) returns text language sql stable security definer set search_path = kg, pg_temp as $$
  select f.kind from kg.entities e join kg.floors f on f.id = e.created_on
  where e.id = p_entity and f.kind <> 'personal' and not exists (select 1 from kg.entity_names n where n.entity = e.id and n.floor = any ((select kg.my_sight())::text[])) $$;
alter function kg.entity_elsewhere(uuid) owner to kg_owner;

-- The floors the person acting can stand on, and what one of them sees: for GET /floors. Asking about a floor
-- they can't stand on gives nothing, as my_sight does.
create function kg.standable() returns setof kg.floors language sql stable security definer set search_path = kg, pg_temp as $$
  select * from kg.floors f where kg.can_stand(kg.me(), f.id) order by f.kind = 'personal' desc, f.id $$;
alter function kg.standable() owner to kg_owner;
create function kg.sight_from(f text) returns setof text language sql stable security definer set search_path = kg, pg_temp as $$
  select s from kg.sight(f) s where kg.can_stand(kg.me(), f) $$;
alter function kg.sight_from(text) owner to kg_owner;

-- The ontology's versions, like its classes and predicates, belong to no floor: the seam names the current one.
grant select on kg.ontology_versions to kg_app;

grant execute on function kg.standable(), kg.sight_from(text), kg.entity_elsewhere(uuid), kg.sync_person(text, jsonb, text[], text), kg.answer_for(text), kg.keep_answer(text, text, text, jsonb),
  kg.outbox_take(integer), kg.outbox_sent(bigint[]) to kg_app;
`;
