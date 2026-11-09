// Migration 3: the floor fence, hardened from the threat model in fence.test.ts (T-numbers there). Draft 4's
// proof ran its checks with `set role kg_app` from a superuser; this closes what that hid.
export const sql = String.raw`
-- Every object these statements change is made by migration 001 in the same release, so no release before
-- runs on them: revoking and replacing here changes nothing a rollback could meet.
-- squawk-ignore-file ban-revoke, ban-replace-view-function
-- T1. Security definer functions ran as whoever ran the migration, which on a deployment is the shared
-- migrating login, a superuser. Everything in kg is now owned by kg_owner: no login, not a superuser, no BYPASSRLS. As the
-- tables' owner it is not fenced by row security, which is what the act_* functions rely on; kg_app owns nothing.
grant usage on schema kg to kg_owner;
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'kg' and c.relkind in ('r', 'v', 'p') and c.relname <> 'migrations' loop
    execute format('alter table kg.%I owner to kg_owner', r.relname);
  end loop;
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'kg' loop
    execute format('alter function %s owner to kg_owner', r.fn);
  end loop;
end $$;

-- T2. Tables kg_app could read in full although their rows belong to floors: floors themselves (every personal
-- floor and its owner), entities (the floor each was first seen on), disputes (their reasons), merges (their
-- reasons), faithful checks, candidates (terms asked for by personal reports), the evidence behind a belief
-- (the ids of observations out of sight) and the forget ledger. Each is fenced now, or not granted.
alter table kg.floors enable row level security;
create policy see on kg.floors for select to kg_app using (id = any ((select kg.my_sight())::text[]));
alter table kg.entities enable row level security;
create policy see on kg.entities for select to kg_app using (exists (select 1 from kg.entity_names n where n.entity = id));
alter table kg.disputes enable row level security;
create policy see on kg.disputes for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
alter table kg.merges enable row level security;
create policy see on kg.merges for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
alter table kg.faithful_checks enable row level security;
create policy see on kg.faithful_checks for select to kg_app using (exists (select 1 from kg.observations o where o.id = observation));
alter table kg.belief_evidence enable row level security;
create policy see on kg.belief_evidence for select to kg_app using (exists (select 1 from kg.observations o where o.id = observation));
alter table kg.candidates enable row level security;
create policy see on kg.candidates for select to kg_app using (exists (select 1 from kg.sources s where s.id = first_source));
revoke select on kg.forget_ledger from kg_app;

-- A dispute's reason is the disputing floor's, but that a belief is disputed shows wherever the belief does
-- (draft 4: "shown as disputed, not hidden"), so live_beliefs asks through a function that answers yes or no.
create function kg.is_disputed(b uuid) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.disputes d where d.belief = b and d.settled_at is null) $$;
alter function kg.is_disputed(uuid) owner to kg_owner;
create or replace view kg.live_beliefs with (security_invoker = true) as
  select b.*, kg.sources_behind(b.id) as sources_behind, kg.evidence_unseen(b.id) as evidence_unseen,
    kg.is_disputed(b.id) as disputed,
    array(select r.floor from kg.belief_reach r where r.belief = b.id and r.withdrawn_at is null) as reach
  from kg.beliefs b where b.superseded_at is null and b.ended_at is null and kg.stands(b.id);

-- T3. A key looked up outside sight answered with the entity's id, which a caller could then use elsewhere.
-- Now it says only that the key is known and the kind of floor that keeps it.
create or replace function kg.lookup_key(p_scheme text, p_value text) returns table (entity uuid, in_sight boolean, kept_on text, name text)
language sql stable security definer set search_path = kg, pg_temp as $$
  select case when k.floor = any ((select kg.my_sight())::text[]) then k.entity end,
         k.floor = any ((select kg.my_sight())::text[]),
         case when k.floor = any ((select kg.my_sight())::text[]) then k.floor else (select kind from kg.floors where id = k.floor) end,
         case when k.floor = any ((select kg.my_sight())::text[]) then (select n.name from kg.entity_names n where n.entity = k.entity and n.floor = k.floor and n.is_label limit 1) end
  from kg.identity_keys k where k.scheme = p_scheme and k.value = p_value
$$;

-- T7. act_retain said "no such source" for an id that doesn't exist and something else for one out of sight,
-- which told a caller whether a source exists. Both now get the same refusal.
create or replace function kg.act_retain(p_source uuid, p_subject uuid, p_predicate text, p_value jsonb, p_object uuid, p_quote text, p_anchor int4range,
  p_valid tstzrange, p_precision text, p_modality text, p_attributed text, p_extractor text, p_prompt text, p_version integer,
  p_flagged boolean default false, p_flag_reason text default null, p_derived uuid default null)
returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare s kg.sources; oid uuid; pr kg.predicates; fk text;
begin
  select * into s from kg.sources where id = p_source;
  perform kg.require(s.id is not null and kg.can_stand(kg.me(), s.floor) and s.floor = kg.here(), 'the source is not on the floor you stand on');
  select * into pr from kg.predicates where iri = p_predicate and status in ('base', 'accepted');
  perform kg.require(pr.iri is not null, 'the predicate is not declared: use the nearest accepted one and propose it');
  if pr.kind = 'link' then
    perform kg.require(p_object is not null and p_value is null, 'a link names an object entity');
    perform kg.require(pr.domain is null or kg.subclass_of((select class from kg.entities where id = p_subject), pr.domain), 'subject is outside the predicate''s domain');
    perform kg.require(pr.range is null or kg.subclass_of((select class from kg.entities where id = p_object), pr.range), 'object is outside the predicate''s range');
  else
    perform kg.require(p_value is not null and p_object is null, 'a property carries a value');
    if pr.datatype = 'quantity' and pr.unit is not null and p_value ? 'v' and not (p_value ? 'unit') then p_value := p_value || jsonb_build_object('unit', pr.unit); end if;
    perform kg.require(pr.domain is null or kg.subclass_of((select class from kg.entities where id = p_subject), pr.domain), 'subject is outside the predicate''s domain');
  end if;
  insert into kg.observations (floor, source, anchor, quote, subject, predicate, value, object, modality, valid, valid_precision, attributed_to,
    flagged, flag_reason, derived_from, extractor, prompt_version, ontology_version)
  values (s.floor, s.id, p_anchor, coalesce(p_quote, ''), p_subject, p_predicate, p_value, p_object, coalesce(p_modality, 'reported'),
    coalesce(p_valid, tstzrange(null, null)), coalesce(p_precision, 'unknown'), p_attributed, p_flagged, p_flag_reason, p_derived, p_extractor, coalesce(p_prompt, ''), p_version)
  returning id into oid;
  select kind into fk from kg.floors where id = s.floor;
  if fk = 'personal' and not p_flagged then perform kg.hold_internal(s.floor, array[oid], 'memory', '{}'); end if;
  perform kg.record('retain', s.floor, jsonb_build_object('source', s.id, 'predicate', p_predicate), jsonb_build_object('observation', oid));
  perform kg.emit('kg.observation.retained', s.floor, jsonb_build_object('observation', oid));
  return oid;
end $$;
alter function kg.act_retain(uuid, uuid, text, jsonb, uuid, text, int4range, tstzrange, text, text, text, text, text, integer, boolean, text, uuid) owner to kg_owner;

-- T12. kg_app could call every function in kg. kg.sight('<someone's personal floor>') answered which floors that
-- person is a member of, and kg.can_stand answered it for anyone; the internal helpers wrote the audit and
-- the outbox directly. kg_app may now execute only the actions, the reads the views need and its own sight.
revoke execute on all functions in schema kg from kg_app;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'kg' and (p.proname like 'act\_%' or p.proname in (
             'me', 'here', 'app', 'my_sight', 'lookup_key', 'known_entities', 'accepted_class',
             'stands', 'sources_behind', 'evidence_unseen', 'last_change', 'is_disputed')) loop
    execute format('grant execute on function %s to kg_app', r.fn);
  end loop;
end $$;
-- Functions are executable by everyone unless said otherwise, including those made after this migration.
alter default privileges for role kg_owner in schema kg revoke execute on functions from public;

-- T1 again: every function that runs as its owner fixes its search_path. The draft-4 ones already did; this
-- keeps it true for any added later (fence.test.ts checks the catalog).
`;
