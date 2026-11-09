// Migration 1: the store as spec draft 4 proved it (PER-351). Hardened by migration 3, kept apart so the review
// can see what the fence threat model changed.
export const sql = String.raw`
-- Every object these statements change is made by migration 001 in the same release, so no release before
-- runs on them: revoking and replacing here changes nothing a rollback could meet.
-- squawk-ignore-file ban-revoke, ban-replace-view-function
create extension if not exists btree_gist;
create extension if not exists pg_trgm;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'kg_owner') then create role kg_owner nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'kg_app') then create role kg_app nologin; end if;
end $$;
grant usage on schema kg to kg_app;

-- ------------------------------------------------------------------------------------------------
-- Floors, members, roles (mirrored from identity through the gateway's signed caller)
create table kg.floors (
  id text primary key,
  kind text not null check (kind in ('personal', 'team', 'org')),
  parent text references kg.floors(id),
  owner text,
  hold_policy text not null default 'role' check (hold_policy in ('role', 'auto')),   -- X1
  reflect_budget_per_day integer not null default 0,                                 -- 0 = deployment default
  check ((kind = 'personal') = (owner is not null)),
  check (kind <> 'org' or parent is null)
);
create table kg.floor_members (floor text not null references kg.floors(id), person text not null, primary key (floor, person));
-- Two roles per floor (X2): settler decides what the floor holds as so (hold, settle, end, retract, merge,
-- split, retire); raiser extends reach upward. One person may hold both.
create table kg.floor_roles (floor text not null references kg.floors(id), person text not null,
  role text not null check (role in ('settler', 'raiser')), primary key (floor, person, role));

create function kg.sight(f text) returns setof text language sql stable security definer set search_path = kg, pg_temp as $$
  with recursive up(id) as (
    select f
    union
    select m.floor from kg.floors p join kg.floor_members m on m.person = p.owner where p.id = f and p.kind = 'personal'
    union
    select fl.parent from kg.floors fl join up on fl.id = up.id where fl.parent is not null
  ) select id from up
$$;
create function kg.can_stand(person text, f text) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.floors where id = f and owner = person)
      or exists (select 1 from kg.floors p where p.owner = person and f in (select kg.sight(p.id)) and f <> p.id)
$$;
create function kg.me() returns text language sql stable as $$ select nullif(current_setting('kg.person', true), '') $$;
create function kg.here() returns text language sql stable as $$ select nullif(current_setting('kg.floor', true), '') $$;
create function kg.app() returns text language sql stable as $$ select nullif(current_setting('kg.app', true), '') $$;
-- Computed once per statement as an init plan: policies use (select kg.my_sight()), never a per-row call.
create function kg.my_sight() returns text[] language sql stable security definer set search_path = kg, pg_temp as $$
  select case when kg.can_stand(kg.me(), kg.here()) then array(select kg.sight(kg.here())) else '{}'::text[] end
$$;
create function kg.has_role(f text, r text) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.floor_roles where floor = f and person = kg.me() and role = r) $$;

-- ------------------------------------------------------------------------------------------------
-- Ontology: a shipped base (CCO profile) plus adopted terms; candidates wait.
create table kg.ontology_versions (version integer primary key, made_at timestamptz not null default now(), note text not null default '');
create table kg.classes (
  iri text primary key,
  label text not null,
  parent text references kg.classes(iri),
  kind text not null default 'continuant' check (kind in ('continuant', 'occurrent')),  -- X4: occurrents are events
  status text not null default 'base' check (status in ('base', 'proposed', 'accepted', 'dismissed')),
  since_version integer references kg.ontology_versions(version),
  pack_term text                                   -- skos:exactMatch to the pack (CCO) IRI
);
create table kg.predicates (
  iri text primary key,
  label text not null,
  kind text not null check (kind in ('property', 'link')),
  domain text references kg.classes(iri),
  range text references kg.classes(iri),           -- for links
  datatype text,                                   -- for properties: quantity, date, text, boolean
  unit text,                                       -- a quantity predicate's unit when the source gives none (from the profile's units)
  single_valued boolean not null default false,
  status text not null default 'base' check (status in ('base', 'proposed', 'accepted', 'dismissed')),
  pack_term text
);
-- Candidates: one row per term extraction asked for and the ontology lacks (F5).
create table kg.candidates (
  term text not null, kind text not null check (kind in ('class', 'predicate')),
  suggested_parent text, why text not null default '',
  asked_by integer not null default 0,             -- distinct sources that asked
  status text not null default 'proposed' check (status in ('proposed', 'adopted', 'dismissed')),
  first_source uuid, primary key (term, kind)
);
create function kg.accepted_class(c text) returns boolean language sql stable as $$
  select exists (select 1 from kg.classes where iri = c and status in ('base', 'accepted')) $$;
create function kg.is_occurrent(c text) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  with recursive up(iri, kind) as (select iri, kind from kg.classes where iri = c
    union select p.iri, p.kind from kg.classes p join kg.classes ch on ch.parent = p.iri join up on up.iri = ch.iri)
  select bool_or(kind = 'occurrent') from up $$;
create function kg.subclass_of(c text, anc text) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  with recursive up(iri) as (select c union select p.parent from kg.classes p join up on up.iri = p.iri where p.parent is not null)
  select exists (select 1 from up where iri = anc) $$;

-- ------------------------------------------------------------------------------------------------
-- Entities: one per real thing (D1). Global part only. Names are per floor (F6).
create table kg.entities (
  id uuid primary key default gen_random_uuid(),
  class text not null references kg.classes(iri),
  state text not null default 'active' check (state in ('active', 'retired', 'merged')),
  merged_into uuid references kg.entities(id),
  created_at timestamptz not null default now(),
  created_on text not null references kg.floors(id)  -- where it was first seen; lookup reveals only the kind
);
create table kg.identity_keys (
  entity uuid not null references kg.entities(id), scheme text not null, value text not null,
  floor text not null references kg.floors(id), primary key (scheme, value));
create table kg.entity_names (
  entity uuid not null references kg.entities(id), floor text not null references kg.floors(id),
  name text not null, is_label boolean not null default false, primary key (entity, floor, name));
create index entity_names_trgm on kg.entity_names using gin (name gin_trgm_ops);

-- ------------------------------------------------------------------------------------------------
-- Sources: referenced, never copied. A revision is the same (app, ref) with a higher version (X5).
create table kg.sources (
  id uuid primary key default gen_random_uuid(),
  floor text not null references kg.floors(id),
  app text not null, ref text not null, version integer not null, content_sha256 text not null,
  title text not null, author text not null, written_at timestamptz,
  published_from uuid references kg.sources(id),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (app, ref, version, floor)
);

-- Observations: one claim, one source, never edited (F7, requirement 8).
create table kg.observations (
  id uuid primary key default gen_random_uuid(),
  floor text not null references kg.floors(id),
  source uuid not null references kg.sources(id),
  anchor int4range,                                -- character span of the quote in the source version
  quote text not null default '',
  subject uuid not null references kg.entities(id),
  predicate text not null references kg.predicates(iri),
  value jsonb,                                     -- {"v": 186, "unit": "container"} | {"v": "2026-11-06"} | {"v": true} | {"v": "text", "asked": "<predicate the extractor named>"}
  object uuid references kg.entities(id),
  modality text not null default 'reported' check (modality in ('reported', 'expected', 'planned', 'possible', 'denied')),
  valid tstzrange not null default tstzrange(null, null),
  valid_precision text not null default 'unknown' check (valid_precision in ('minute', 'day', 'month', 'year', 'unknown')),
  attributed_to text,                              -- the original speaker when the source relays someone
  flagged boolean not null default false, flag_reason text,   -- text that addressed the system (X3)
  kept_at timestamptz, kept_by text,               -- the owner kept a flagged observation
  derived_from uuid references kg.observations(id),
  extractor text not null, prompt_version text not null default '', ontology_version integer not null references kg.ontology_versions(version),
  recorded_at timestamptz not null default clock_timestamp(),
  retracted_at timestamptz, retracted_by text, retracted_why text,
  forgotten_at timestamptz,
  check ((value is null) <> (object is null) or forgotten_at is not null),
  check (valid_precision <> 'unknown' or valid = tstzrange(null, null) or forgotten_at is not null)
);
create index observations_subject on kg.observations (subject, predicate) where retracted_at is null;
create index observations_floor on kg.observations (floor);
create index observations_source on kg.observations (source);
create table kg.mentions (source uuid not null references kg.sources(id), entity uuid not null references kg.entities(id),
  name text not null, anchor int4range, primary key (source, entity, name));
create table kg.faithful_checks (observation uuid not null references kg.observations(id), by_person text not null,
  verdict text not null check (verdict in ('faithful', 'unfaithful')), at timestamptz not null default clock_timestamp(),
  primary key (observation, by_person));

-- Beliefs: what a floor holds, on two clocks (valid, recorded). Superseded, never updated.
create table kg.beliefs (
  id uuid primary key default gen_random_uuid(),
  home_floor text not null references kg.floors(id),
  subject uuid not null references kg.entities(id),
  predicate text not null references kg.predicates(iri),
  value jsonb, object uuid references kg.entities(id),
  valid tstzrange not null default tstzrange(null, null),
  modality text not null default 'reported',
  held_by text not null,                           -- a person, or 'memory'
  recorded_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz, ended_by text,             -- act_end: stopped being so (valid clock)
  superseded_at timestamptz, superseded_by uuid references kg.beliefs(id),
  check ((value is null) <> (object is null))
);
create index beliefs_subject on kg.beliefs (subject, predicate) where superseded_at is null;
create table kg.belief_evidence (belief uuid not null references kg.beliefs(id), observation uuid not null references kg.observations(id), primary key (belief, observation));
create table kg.belief_reach (
  belief uuid not null references kg.beliefs(id), floor text not null references kg.floors(id),
  raised_by text, raised_from text references kg.floors(id), why text not null default '',
  cite_sources boolean not null default false, raised_at timestamptz not null default clock_timestamp(),
  withdrawn_at timestamptz, withdrawn_by text, primary key (belief, floor));
create index belief_reach_floor on kg.belief_reach (floor) where withdrawn_at is null;
create table kg.disputes (
  id uuid primary key default gen_random_uuid(),
  belief uuid not null references kg.beliefs(id), floor text not null references kg.floors(id),
  by_person text not null, reason text not null, at timestamptz not null default clock_timestamp(),
  settled_by text, settled_at timestamptz, outcome text check (outcome in ('upheld', 'retracted', 'withdrawn')));
create table kg.merges (
  id uuid primary key default gen_random_uuid(), floor text not null references kg.floors(id),
  senior uuid not null references kg.entities(id), junior uuid not null references kg.entities(id),
  by_person text not null, why text not null, at timestamptz not null default clock_timestamp(),
  split_at timestamptz, split_by text, split_why text);
create table kg.summaries (
  entity uuid not null references kg.entities(id), floor text not null references kg.floors(id),
  text text not null, written_at timestamptz not null default clock_timestamp(), beliefs_as_of timestamptz not null,
  model text not null default '', primary key (entity, floor));
-- The audit: append-only, one row per action, idempotency key per caller.
create table kg.actions (
  id bigint generated always as identity primary key,
  kind text not null, person text not null, app text, floor text,
  input jsonb not null default '{}', effects jsonb not null default '{}',
  at timestamptz not null default clock_timestamp(),
  idempotency_key text, undone_at timestamptz, undone_by bigint,
  unique (person, idempotency_key));
create table kg.outbox (
  id bigint generated always as identity primary key,
  topic text not null, payload jsonb not null, floor_kind text not null,
  created_at timestamptz not null default now(), sent_at timestamptz);
-- The forget ledger: re-applied after any restore (requirement 15). Holds ids only.
create table kg.forget_ledger (observation uuid primary key, floor text not null, at timestamptz not null default clock_timestamp());

-- ------------------------------------------------------------------------------------------------
-- Immutability guards
create function kg.observation_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'observations are never deleted: retract or forget'; end if;
  if (new.source, new.subject, new.predicate, new.object, new.valid, new.modality, new.floor, new.quote)
     is distinct from (old.source, old.subject, old.predicate, old.object, old.valid, old.modality, old.floor, old.quote)
     and new.forgotten_at is null then
    raise exception 'observations are never edited: retract and add another';
  end if;
  if new.value is distinct from old.value and new.forgotten_at is null then raise exception 'only forgetting clears a value'; end if;
  return new;
end $$;
create trigger observation_guard before update or delete on kg.observations for each row execute function kg.observation_guard();
create function kg.append_only() returns trigger language plpgsql as $$ begin
  if tg_op = 'DELETE' then raise exception '% is append-only', tg_table_name; end if;
  if tg_table_name = 'actions' and (new.kind, new.person, new.input, new.at, new.effects) is distinct from (old.kind, old.person, old.input, old.at, old.effects)
    then raise exception 'actions are append-only'; end if;
  return new; end $$;
create trigger actions_append_only before update or delete on kg.actions for each row execute function kg.append_only();
create trigger ledger_append_only before update or delete on kg.forget_ledger for each row execute function kg.append_only();

-- ------------------------------------------------------------------------------------------------
-- Row security: a floor sees floors above, never below. One init plan per statement.
alter table kg.observations enable row level security;
alter table kg.sources enable row level security;
alter table kg.beliefs enable row level security;
alter table kg.belief_reach enable row level security;
alter table kg.entity_names enable row level security;
alter table kg.summaries enable row level security;
alter table kg.mentions enable row level security;
create policy see on kg.observations for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
create policy see on kg.sources for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
create policy see on kg.mentions for select to kg_app using (source in (select id from kg.sources));
create policy see on kg.belief_reach for select to kg_app using (floor = any ((select kg.my_sight())::text[]) and withdrawn_at is null);
create policy see on kg.beliefs for select to kg_app using (
  exists (select 1 from kg.belief_reach r where r.belief = id and r.withdrawn_at is null and r.floor = any ((select kg.my_sight())::text[])));
create policy see on kg.entity_names for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
create policy see on kg.summaries for select to kg_app using (floor = any ((select kg.my_sight())::text[]));
grant select on kg.observations, kg.sources, kg.beliefs, kg.belief_reach, kg.entity_names, kg.summaries, kg.mentions,
  kg.belief_evidence, kg.entities, kg.predicates, kg.classes, kg.candidates, kg.disputes, kg.faithful_checks, kg.floors, kg.merges, kg.forget_ledger to kg_app;

-- Liveness over ALL evidence (SE-08): a raised-to floor cannot read the team's observations, yet must see the belief fall.
create function kg.stands(b uuid) returns boolean language sql stable security definer set search_path = kg, pg_temp as $$
  select exists (select 1 from kg.belief_evidence e join kg.observations o on o.id = e.observation
                 where e.belief = b and o.retracted_at is null and o.forgotten_at is null
                   and (not o.flagged or o.kept_at is not null)) $$;
-- Distinct sources: versions of one (app, ref) count once (X5, requirement 9).
create function kg.sources_behind(b uuid) returns bigint language sql stable security definer set search_path = kg, pg_temp as $$
  select count(distinct (s.app, s.ref)) from kg.belief_evidence e join kg.observations o on o.id = e.observation
  join kg.sources s on s.id = o.source
  where e.belief = b and o.retracted_at is null and o.forgotten_at is null $$;
create function kg.evidence_unseen(b uuid) returns bigint language sql stable security definer set search_path = kg, pg_temp as $$
  select count(*) from kg.belief_evidence e join kg.observations o on o.id = e.observation
  where e.belief = b and o.retracted_at is null and not (o.floor = any ((select kg.my_sight())::text[])) $$;
create function kg.last_change(ent uuid) returns timestamptz language sql stable security definer set search_path = kg, pg_temp as $$
  select max(greatest(b.recorded_at, coalesce(b.superseded_at, '-infinity'), coalesce(b.ended_at, '-infinity'),
                      coalesce(o.retracted_at, '-infinity'), coalesce(o.forgotten_at, '-infinity')))
  from kg.beliefs b join kg.belief_evidence e on e.belief = b.id join kg.observations o on o.id = e.observation
  where b.subject = ent or b.object = ent $$;

create view kg.live_beliefs with (security_invoker = true) as
  select b.*, kg.sources_behind(b.id) as sources_behind, kg.evidence_unseen(b.id) as evidence_unseen,
    exists (select 1 from kg.disputes d where d.belief = b.id and d.settled_at is null) as disputed,
    array(select r.floor from kg.belief_reach r where r.belief = b.id and r.withdrawn_at is null) as reach
  from kg.beliefs b where b.superseded_at is null and b.ended_at is null and kg.stands(b.id);
grant select on kg.live_beliefs to kg_app;

-- A conflict: two live beliefs, same subject and single-valued predicate, both reported (or both the same
-- modality), overlapping valid time, different value or object. Forecast against outcome is not a conflict.
create view kg.conflicts with (security_invoker = true) as
  select a.subject, a.predicate, a.id as a, b.id as b, a.value as a_value, b.value as b_value, a.object as a_object, b.object as b_object, a.valid * b.valid as overlap
  from kg.live_beliefs a join kg.live_beliefs b on a.subject = b.subject and a.predicate = b.predicate and a.id < b.id
  join kg.predicates p on p.iri = a.predicate and p.single_valued
  where a.valid && b.valid and a.modality = b.modality and not a.disputed and not b.disputed
    and (a.value is distinct from b.value or a.object is distinct from b.object);
grant select on kg.conflicts to kg_app;
-- Possible duplicates (F6, requirement 3): a continuant whose identity-bearing single-valued predicates conflict.
create view kg.possible_duplicates with (security_invoker = true) as
  select distinct c.subject as entity, c.predicate from kg.conflicts c join kg.predicates p on p.iri = c.predicate
  where p.kind = 'link' and p.iri in ('kg:worksFor', 'kg:locatedIn', 'kg:operatedBy');
grant select on kg.possible_duplicates to kg_app;
create view kg.stale_summaries with (security_invoker = true) as
  select s.entity, s.floor, s.written_at, kg.last_change(s.entity) as beliefs_changed_at from kg.summaries s where kg.last_change(s.entity) > s.beliefs_as_of;
grant select on kg.stale_summaries to kg_app;

-- ------------------------------------------------------------------------------------------------
-- Actions: the only way in. Each checks the caller and floor, then records itself in the same transaction.
create function kg.record(kind text, f text, input jsonb, effects jsonb default '{}') returns bigint language plpgsql as $$
declare k text := nullif(current_setting('kg.idempotency_key', true), ''); aid bigint;
begin
  insert into kg.actions (kind, person, app, floor, input, effects, idempotency_key) values (kind, kg.me(), kg.app(), f, input, effects, k) returning id into aid;
  return aid;
end $$;
create function kg.require(ok boolean, why text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'refused: %', why using errcode = '42501'; end if; end $$;
create function kg.emit(topic text, f text, payload jsonb) returns void language plpgsql as $$
declare k text; begin
  select kind into k from kg.floors where id = f;
  insert into kg.outbox (topic, payload, floor_kind) values (topic, case when k = 'personal' then jsonb_build_object('floor', f) else payload || jsonb_build_object('floor', f) end, k);
end $$;

create function kg.act_add_source(p_app text, p_ref text, p_version integer, p_sha text, p_title text, p_written timestamptz default null) returns uuid
language plpgsql security definer set search_path = kg, pg_temp as $$
declare sid uuid;
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  insert into kg.sources (floor, app, ref, version, content_sha256, title, author, written_at) values (kg.here(), p_app, p_ref, p_version, p_sha, p_title, kg.me(), p_written) returning id into sid;
  perform kg.record('add-source', kg.here(), jsonb_build_object('app', p_app, 'ref', p_ref, 'version', p_version), jsonb_build_object('source', sid));
  return sid;
end $$;

-- A new entity, named on the caller's floor only. A proposed class is refused: use its accepted parent (F5).
create function kg.act_new_entity(p_class text, p_label text) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare eid uuid;
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  perform kg.require(kg.accepted_class(p_class), 'the class is not accepted: use its accepted parent and propose the class');
  insert into kg.entities (class, created_on) values (p_class, kg.here()) returning id into eid;
  insert into kg.entity_names (entity, floor, name, is_label) values (eid, kg.here(), p_label, true);
  perform kg.record('new-entity', kg.here(), jsonb_build_object('class', p_class), jsonb_build_object('entity', eid));
  perform kg.emit('kg.entity.created', kg.here(), jsonb_build_object('entity', eid));
  return eid;
end $$;
create function kg.act_mention(p_source uuid, p_entity uuid, p_name text, p_anchor int4range default null, p_label boolean default false) returns void
language plpgsql security definer set search_path = kg, pg_temp as $$
declare s kg.sources;
begin
  select * into s from kg.sources where id = p_source;
  perform kg.require(s.floor = kg.here() and kg.can_stand(kg.me(), s.floor), 'the source is not on the floor you stand on');
  insert into kg.mentions values (p_source, p_entity, p_name, p_anchor) on conflict do nothing;
  insert into kg.entity_names (entity, floor, name, is_label) values (p_entity, s.floor, p_name, p_label) on conflict (entity, floor, name) do update set is_label = kg.entity_names.is_label or excluded.is_label;
end $$;
create function kg.act_add_key(p_entity uuid, p_scheme text, p_value text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  insert into kg.identity_keys (entity, scheme, value, floor) values (p_entity, p_scheme, p_value, kg.here());
  perform kg.record('add-key', kg.here(), jsonb_build_object('entity', p_entity, 'scheme', p_scheme));
end $$;
-- Propose a term (class or predicate): one row per term, counts the sources that asked (F5).
create function kg.act_propose(p_term text, p_kind text, p_parent text, p_why text, p_source uuid) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  insert into kg.candidates (term, kind, suggested_parent, why, asked_by, first_source) values (p_term, p_kind, p_parent, p_why, 1, p_source)
    on conflict (term, kind) do update set asked_by = kg.candidates.asked_by + 1;
end $$;

-- Retain: extraction output can only add an observation. It names no status, no check and no action.
create function kg.act_retain(p_source uuid, p_subject uuid, p_predicate text, p_value jsonb, p_object uuid, p_quote text, p_anchor int4range,
  p_valid tstzrange, p_precision text, p_modality text, p_attributed text, p_extractor text, p_prompt text, p_version integer,
  p_flagged boolean default false, p_flag_reason text default null, p_derived uuid default null)
returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare s kg.sources; oid uuid; pr kg.predicates; fk text;
begin
  select * into s from kg.sources where id = p_source;
  perform kg.require(s.id is not null, 'no such source');
  perform kg.require(kg.can_stand(kg.me(), s.floor) and s.floor = kg.here(), 'the source is not on the floor you stand on');
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
  -- The personal floor is memory (D9): believed at once. A flagged observation waits for the owner (X3).
  if fk = 'personal' and not p_flagged then perform kg.hold_internal(s.floor, array[oid], 'memory', '{}'); end if;
  perform kg.record('retain', s.floor, jsonb_build_object('source', s.id, 'predicate', p_predicate), jsonb_build_object('observation', oid));
  perform kg.emit('kg.observation.retained', s.floor, jsonb_build_object('observation', oid));
  return oid;
end $$;

create function kg.hold_internal(f text, obs uuid[], who text, sup uuid[]) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations; bid uuid;
begin
  select * into o from kg.observations where id = obs[1];
  insert into kg.beliefs (home_floor, subject, predicate, value, object, valid, modality, held_by)
  values (f, o.subject, o.predicate, o.value, o.object, o.valid, o.modality, who) returning id into bid;
  insert into kg.belief_evidence select bid, unnest(obs);
  insert into kg.belief_reach (belief, floor) values (bid, f);
  update kg.beliefs set superseded_at = clock_timestamp(), superseded_by = bid where id = any(sup) and home_floor = f and superseded_at is null;
  return bid;
end $$;

-- Keep: the owner keeps a flagged observation on their own floor (X3). It becomes memory like any other.
create function kg.act_keep(p_obs uuid) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations;
begin
  select * into o from kg.observations where id = p_obs;
  perform kg.require((select owner from kg.floors where id = o.floor) = kg.me(), 'only the owner keeps, on their own floor');
  perform kg.require(o.flagged and o.kept_at is null, 'nothing to keep');
  update kg.observations set kept_at = clock_timestamp(), kept_by = kg.me() where id = p_obs;
  perform kg.hold_internal(o.floor, array[p_obs], 'memory', '{}');
  perform kg.record('keep', o.floor, jsonb_build_object('observation', p_obs));
end $$;

-- Publish: the shared floor references the same app document; observations derive, nothing is re-extracted (F8).
create function kg.act_publish(p_source uuid, p_to text) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare s kg.sources; nid uuid; o kg.observations;
begin
  select * into s from kg.sources where id = p_source;
  perform kg.require(s.author = kg.me(), 'only the author publishes their own work');
  perform kg.require((select kind from kg.floors where id = p_to) <> 'personal' and kg.can_stand(kg.me(), p_to), 'you are not on that floor');
  insert into kg.sources (floor, app, ref, version, content_sha256, title, author, written_at, published_from)
  values (p_to, s.app, s.ref, s.version, s.content_sha256, s.title, s.author, s.written_at, s.id) returning id into nid;
  for o in select * from kg.observations where source = s.id and retracted_at is null and forgotten_at is null and (not flagged or kept_at is not null) loop
    insert into kg.observations (floor, source, anchor, quote, subject, predicate, value, object, modality, valid, valid_precision, attributed_to, derived_from, extractor, prompt_version, ontology_version)
    values (p_to, nid, o.anchor, o.quote, o.subject, o.predicate, o.value, o.object, o.modality, o.valid, o.valid_precision, o.attributed_to, o.id, o.extractor, o.prompt_version, o.ontology_version);
  end loop;
  insert into kg.mentions (source, entity, name, anchor) select nid, m.entity, m.name, m.anchor from kg.mentions m where m.source = s.id;
  insert into kg.entity_names (entity, floor, name) select distinct m.entity, p_to, m.name from kg.mentions m where m.source = s.id on conflict do nothing;
  perform kg.record('publish', p_to, jsonb_build_object('from', s.id), jsonb_build_object('source', nid));
  perform kg.emit('kg.source.published', p_to, jsonb_build_object('source', nid));
  return nid;
end $$;

create function kg.act_check_faithful(p_obs uuid, p_verdict text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations; s kg.sources;
begin
  select * into o from kg.observations where id = p_obs; select * into s from kg.sources where id = o.source;
  perform kg.require((select kind from kg.floors where id = o.floor) <> 'personal', 'the personal floor has no checks');
  perform kg.require(kg.can_stand(kg.me(), o.floor) and o.floor = kg.here(), 'you are not on that floor');
  perform kg.require(s.author <> kg.me(), 'the author of the source cannot confirm its extraction');
  insert into kg.faithful_checks (observation, by_person, verdict) values (p_obs, kg.me(), p_verdict);
  perform kg.record('confirm-faithful', o.floor, jsonb_build_object('observation', p_obs, 'verdict', p_verdict));
end $$;

-- Hold: the floor holds a claim as so (D10). Needs every observation faithful, and the settler role unless the
-- floor's policy is auto (X1). May supersede the floor's own live beliefs it names (a forecast by an outcome,
-- an earlier version by a revision).
create function kg.act_hold(p_obs uuid[], p_supersedes uuid[] default '{}', p_into uuid default null) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare f text := kg.here(); bid uuid; x uuid;
begin
  perform kg.require(kg.can_stand(kg.me(), f), 'you are not on that floor');
  perform kg.require((select kind from kg.floors where id = f) <> 'personal', 'the personal floor holds by itself');
  perform kg.require((select hold_policy from kg.floors where id = f) = 'auto' or kg.has_role(f, 'settler'), 'holding needs the floor''s settler role');
  foreach x in array p_obs loop
    perform kg.require((select floor from kg.observations where id = x) = f, 'evidence must be on this floor');
    perform kg.require(not (select flagged from kg.observations where id = x), 'a flagged observation is never held on a shared floor');
    perform kg.require(exists (select 1 from kg.faithful_checks where observation = x and verdict = 'faithful'), 'each observation needs a faithful check first');
    perform kg.require(not exists (select 1 from kg.faithful_checks where observation = x and verdict = 'unfaithful'), 'an observation was found unfaithful');
  end loop;
  if p_into is not null then
    -- More evidence for a claim the floor already holds: the same subject, predicate and value. No new belief.
    perform kg.require(exists (select 1 from kg.beliefs b join kg.observations o on o.id = p_obs[1] where b.id = p_into and b.home_floor = f and b.superseded_at is null
      and b.subject = o.subject and b.predicate = o.predicate and b.value is not distinct from o.value and b.object is not distinct from o.object), 'the evidence does not say what that belief says');
    insert into kg.belief_evidence select p_into, unnest(p_obs) on conflict do nothing;
    bid := p_into;
  else
    bid := kg.hold_internal(f, p_obs, kg.me(), p_supersedes);
  end if;
  perform kg.record('hold', f, jsonb_build_object('observations', p_obs, 'supersedes', p_supersedes, 'into', p_into), jsonb_build_object('belief', bid));
  perform kg.emit('kg.belief.held', f, jsonb_build_object('belief', bid));
  return bid;
end $$;

create function kg.act_dispute(p_belief uuid, p_reason text) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare d uuid;
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  perform kg.require(exists (select 1 from kg.belief_reach where belief = p_belief and floor = any(array(select kg.sight(kg.here()))) and withdrawn_at is null), 'that belief is not in sight from this floor');
  insert into kg.disputes (belief, floor, by_person, reason) values (p_belief, kg.here(), kg.me(), p_reason) returning id into d;
  perform kg.record('dispute', kg.here(), jsonb_build_object('belief', p_belief), jsonb_build_object('dispute', d));
  perform kg.emit('kg.belief.disputed', kg.here(), jsonb_build_object('belief', p_belief, 'dispute', d));
  return d;
end $$;
create function kg.act_settle(p_dispute uuid, p_outcome text, p_note text default '') returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare d kg.disputes; b kg.beliefs; x uuid;
begin
  select * into d from kg.disputes where id = p_dispute; select * into b from kg.beliefs where id = d.belief;
  perform kg.require(d.settled_at is null, 'already settled');
  perform kg.require(kg.has_role(b.home_floor, 'settler') or (p_outcome = 'withdrawn' and d.by_person = kg.me()), 'settling needs the belief''s floor''s settler role');
  update kg.disputes set settled_by = kg.me(), settled_at = clock_timestamp(), outcome = p_outcome where id = p_dispute;
  if p_outcome = 'retracted' then
    for x in select e.observation from kg.belief_evidence e where e.belief = d.belief loop perform kg.retract_internal(x, 'dispute settled: retracted'); end loop;
  end if;
  perform kg.record('settle', b.home_floor, jsonb_build_object('dispute', p_dispute, 'outcome', p_outcome, 'note', p_note));
end $$;

-- Raise: extends reach to the floor directly above. Only a held, undisputed belief; only the raiser role (D11, F2).
create function kg.act_raise(p_belief uuid, p_why text, p_cite boolean default false) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare f text := kg.here(); up text;
begin
  perform kg.require((select kind from kg.floors where id = f) <> 'personal', 'a personal floor cannot raise: publish instead');
  select parent into up from kg.floors where id = f;
  perform kg.require(up is not null, 'nothing is above this floor');
  perform kg.require(kg.has_role(f, 'raiser'), 'raising needs the floor''s raiser role');
  perform kg.require(exists (select 1 from kg.belief_reach where belief = p_belief and floor = f and withdrawn_at is null), 'that belief is not held on this floor');
  perform kg.require(exists (select 1 from kg.beliefs b where b.id = p_belief and b.held_by <> 'memory' and b.superseded_at is null and b.ended_at is null), 'only a held, current belief is raised');
  perform kg.require(not exists (select 1 from kg.disputes where belief = p_belief and settled_at is null), 'an open dispute stops a raise');
  insert into kg.belief_reach (belief, floor, raised_by, raised_from, why, cite_sources) values (p_belief, up, kg.me(), f, p_why, p_cite);
  perform kg.record('raise', f, jsonb_build_object('belief', p_belief, 'to', up, 'why', p_why));
  perform kg.emit('kg.belief.raised', up, jsonb_build_object('belief', p_belief));
end $$;

create function kg.retract_internal(p_obs uuid, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  update kg.observations set retracted_at = clock_timestamp(), retracted_by = kg.me(), retracted_why = p_why where id = p_obs and retracted_at is null;
  update kg.observations set retracted_at = clock_timestamp(), retracted_by = kg.me(), retracted_why = 'derived from a retracted observation' where derived_from = p_obs and retracted_at is null;
end $$;
-- Retract: once, everywhere (F2). The beliefs it backed fall from every floor if nothing else stands behind them.
create function kg.act_retract(p_obs uuid, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations; s kg.sources;
begin
  select * into o from kg.observations where id = p_obs; select * into s from kg.sources where id = o.source;
  perform kg.require(kg.can_stand(kg.me(), o.floor), 'you are not on that floor');
  perform kg.require(s.author = kg.me() or kg.has_role(o.floor, 'settler'), 'only the author or the floor''s settler retracts');
  perform kg.retract_internal(p_obs, p_why);
  perform kg.record('retract', o.floor, jsonb_build_object('observation', p_obs, 'why', p_why));
  perform kg.emit('kg.observation.retracted', o.floor, jsonb_build_object('observation', p_obs));
end $$;
-- End: a held belief stopped being so at a time (valid clock); kept, not deleted.
create function kg.act_end(p_belief uuid, p_at timestamptz, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare b kg.beliefs;
begin
  select * into b from kg.beliefs where id = p_belief;
  perform kg.require(kg.has_role(b.home_floor, 'settler') or (b.held_by = 'memory' and (select owner from kg.floors where id = b.home_floor) = kg.me()), 'ending needs the settler role, or the owner on their own floor');
  update kg.beliefs set ended_at = p_at, ended_by = kg.me() where id = p_belief and ended_at is null;
  perform kg.record('end', b.home_floor, jsonb_build_object('belief', p_belief, 'at', p_at, 'why', p_why));
end $$;
-- Merge: junior under senior, on one floor's authority; nothing moves (D1). Split undoes exactly.
create function kg.act_merge(p_senior uuid, p_junior uuid, p_why text) returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare m uuid;
begin
  perform kg.require(kg.has_role(kg.here(), 'settler'), 'merging needs the floor''s settler role');
  perform kg.require((select state from kg.entities where id = p_junior) = 'active', 'the junior is not active');
  insert into kg.merges (floor, senior, junior, by_person, why) values (kg.here(), p_senior, p_junior, kg.me(), p_why) returning id into m;
  update kg.entities set state = 'merged', merged_into = p_senior where id = p_junior;
  perform kg.record('merge', kg.here(), jsonb_build_object('senior', p_senior, 'junior', p_junior, 'why', p_why), jsonb_build_object('merge', m));
  return m;
end $$;
create function kg.act_split(p_merge uuid, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare m kg.merges;
begin
  select * into m from kg.merges where id = p_merge;
  perform kg.require(kg.has_role(m.floor, 'settler'), 'splitting needs the floor''s settler role');
  update kg.merges set split_at = clock_timestamp(), split_by = kg.me(), split_why = p_why where id = p_merge;
  update kg.entities set state = 'active', merged_into = null where id = m.junior;
  perform kg.record('split', m.floor, jsonb_build_object('merge', p_merge, 'why', p_why));
end $$;
create function kg.act_adopt(p_term text, p_kind text, p_iri text, p_label text, p_parent text, p_class_kind text default 'continuant') returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare v integer;
begin
  perform kg.require(current_setting('kg.ontology_admin', true) = 'true', 'adopting a term needs an ontology admin');
  insert into kg.ontology_versions (version, note) select coalesce(max(version), 0) + 1, 'adopt ' || p_term from kg.ontology_versions returning version into v;
  if p_kind = 'class' then
    insert into kg.classes (iri, label, parent, kind, status, since_version) values (p_iri, p_label, p_parent, p_class_kind, 'accepted', v)
      on conflict (iri) do update set status = 'accepted', since_version = v;
  end if;
  update kg.candidates set status = 'adopted' where term = p_term and kind = p_kind;
  perform kg.record('adopt', null, jsonb_build_object('term', p_term, 'kind', p_kind, 'iri', p_iri), jsonb_build_object('ontologyVersion', v));
end $$;
-- Forget: personal-floor erasure. Clears value, quote and anchor; the row stays so nothing dangles; the ledger records the id.
create function kg.act_forget(p_obs uuid) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations;
begin
  select * into o from kg.observations where id = p_obs;
  perform kg.require((select owner from kg.floors where id = o.floor) = kg.me(), 'only the owner forgets, and only on their own floor');
  update kg.observations set forgotten_at = clock_timestamp(), value = null, quote = '', anchor = null where id = p_obs;
  insert into kg.forget_ledger (observation, floor) values (p_obs, o.floor) on conflict do nothing;
  perform kg.record('forget', o.floor, jsonb_build_object('observation', p_obs));
end $$;
-- Reflect: the service writes a floor's summary of an entity from that floor's own beliefs (requirement 14).
create function kg.act_reflect(p_entity uuid, p_text text, p_model text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  insert into kg.summaries (entity, floor, text, beliefs_as_of, model) values (p_entity, kg.here(), p_text, coalesce(kg.last_change(p_entity), clock_timestamp()), p_model)
    on conflict (entity, floor) do update set text = excluded.text, written_at = clock_timestamp(), beliefs_as_of = excluded.beliefs_as_of, model = excluded.model;
  perform kg.record('reflect', kg.here(), jsonb_build_object('entity', p_entity));
end $$;

-- Lookup by identity key: whether it is known and on what kind of floor, never its name unless in sight (RUN-50 pattern).
create function kg.lookup_key(p_scheme text, p_value text) returns table (entity uuid, in_sight boolean, kept_on text, name text)
language sql stable security definer set search_path = kg, pg_temp as $$
  select k.entity, k.floor = any ((select kg.my_sight())::text[]),
         case when k.floor = any ((select kg.my_sight())::text[]) then k.floor else (select kind from kg.floors where id = k.floor) end,
         case when k.floor = any ((select kg.my_sight())::text[]) then (select n.name from kg.entity_names n where n.entity = k.entity and n.floor = k.floor and n.is_label limit 1) end
  from kg.identity_keys k where k.scheme = p_scheme and k.value = p_value
$$;
-- Known entities for an extractor working for a floor: cards on floors in sight only (requirement 4).
create function kg.known_entities(p_limit integer) returns table (entity uuid, class text, label text, aliases text[])
language sql stable security invoker as $$
  select e.id, e.class, (select n.name from kg.entity_names n where n.entity = e.id and n.is_label limit 1),
         array(select n.name from kg.entity_names n where n.entity = e.id and not n.is_label)
  from kg.entities e where e.state = 'active' and exists (select 1 from kg.entity_names n where n.entity = e.id)
  limit p_limit $$;

revoke all on all functions in schema kg from public;
grant execute on all functions in schema kg to kg_app;
revoke execute on function kg.hold_internal(text, uuid[], text, uuid[]) from kg_app;
revoke execute on function kg.retract_internal(uuid, text) from kg_app;
`;
