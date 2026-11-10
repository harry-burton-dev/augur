// Migration 10: ontology admin (plan PR 8; draft 4's adopt and dismiss). An ontology admin adopts a term
// extraction asked for, as a class or predicate of its own or as another name for one the ontology has, and
// dismisses one it won't take, saying why. A term adopted as a name for a predicate is filed under it from then
// on: a claim that fell to kg:note asking for that term is kept under the predicate instead. A dismissed term
// stops being counted. Nothing already kept is re-filed: a claim is immutable, and its kg:note stays as it was.
export const sql = String.raw`
-- squawk-ignore-file ban-revoke
alter table kg.predicates add column since_version integer references kg.ontology_versions(version);
alter table kg.candidates add column decided_as text, add column decided_why text, add column decided_by text, add column decided_at timestamptz;

-- The names extraction asks by that an admin adopted as a predicate the ontology has: one predicate per name.
create table kg.predicate_terms (
  term text primary key check (term ~ '^[A-Za-z][A-Za-z0-9]*$'),
  predicate text not null references kg.predicates(iri),
  since_version integer not null references kg.ontology_versions(version)
);
alter table kg.predicate_terms owner to kg_owner;
-- Like the rest of the ontology, the deployment's, not a floor's: anyone signed in may read it.
grant select on kg.predicate_terms to kg_app;

-- A term as extraction names it: "kg:delayCause" and "delayCause" are one term.
create function kg.bare_term(p text) returns text language sql immutable as $$ select regexp_replace(p, '^kg:', '') $$;
alter function kg.bare_term(text) owner to kg_owner;

-- The predicate a claim that fell to kg:note is filed under: the property its asked term names now (adopted
-- since it was asked), or the one the term was adopted as another name for; otherwise kg:note. Only a text
-- property takes a note's value as it is.
create function kg.filed_under(p_predicate text, p_value jsonb) returns text language sql stable security definer set search_path = kg, pg_temp as $$
  select coalesce(
    (select p.iri from kg.predicates p
      where p_predicate = 'kg:note' and p.status in ('base', 'accepted') and p.kind = 'property' and p.datatype = 'text' and p.iri <> 'kg:note'
        and p.iri in ('kg:' || kg.bare_term(p_value ->> 'asked'), (select t.predicate from kg.predicate_terms t where t.term = kg.bare_term(p_value ->> 'asked')))
      order by p.iri = 'kg:' || kg.bare_term(p_value ->> 'asked') desc limit 1),
    p_predicate) $$;
alter function kg.filed_under(text, jsonb) owner to kg_owner;

-- Retain, as migration 3 left it, with a claim that fell to kg:note filed under the predicate its term was adopted as.
-- The release before calls it with the same arguments and gets the same answer, filed where the ontology now says.
-- squawk-ignore ban-replace-view-function
create or replace function kg.act_retain(p_source uuid, p_subject uuid, p_predicate text, p_value jsonb, p_object uuid, p_quote text, p_anchor int4range,
  p_valid tstzrange, p_precision text, p_modality text, p_attributed text, p_extractor text, p_prompt text, p_version integer,
  p_flagged boolean default false, p_flag_reason text default null, p_derived uuid default null)
returns uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare s kg.sources; oid uuid; pr kg.predicates; fk text;
begin
  select * into s from kg.sources where id = p_source;
  perform kg.require(s.id is not null and kg.can_stand(kg.me(), s.floor) and s.floor = kg.here(), 'the source is not on the floor you stand on');
  p_predicate := kg.filed_under(p_predicate, p_value);
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

-- Propose, as before, except that a dismissed term is no longer counted, and a term the ontology has now, by its
-- own name or as another name for one, is not counted again. The release before calls it as it always did.
-- squawk-ignore ban-replace-view-function
create or replace function kg.act_propose(p_term text, p_kind text, p_parent text, p_why text, p_source uuid) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(kg.can_stand(kg.me(), kg.here()), 'you are not on that floor');
  if p_kind = 'predicate' and (exists (select 1 from kg.predicate_terms where term = kg.bare_term(p_term))
      or exists (select 1 from kg.predicates where iri = 'kg:' || kg.bare_term(p_term) and status in ('base', 'accepted'))) then return; end if;
  if p_kind = 'class' and kg.accepted_class('kg:' || kg.bare_term(p_term)) then return; end if;
  insert into kg.candidates (term, kind, suggested_parent, why, asked_by, first_source) values (p_term, p_kind, p_parent, p_why, 1, p_source)
    on conflict (term, kind) do update set asked_by = kg.candidates.asked_by + 1 where kg.candidates.status <> 'dismissed';
end $$;

-- Adopt replaces the draft-4 one, which took only classes. A term becomes a class or predicate of its own (a new
-- ontology version), or, when the IRI is one the ontology already has, another name for it (no new version: the
-- ontology is the same, and extraction files the name under it). Returns the ontology version it stands in.
-- No release before calls the draft-4 adopt: no action took it.
-- squawk-ignore ban-drop-function
drop function kg.act_adopt(text, text, text, text, text, text);
create function kg.act_adopt(p_term text, p_kind text, p_iri text, p_label text, p_parent text default null, p_class_kind text default null,
  p_domain text default null, p_range text default null, p_datatype text default null, p_unit text default null, p_single boolean default null)
returns integer language plpgsql security definer set search_path = kg, pg_temp as $$
declare v integer; added boolean := false; pr kg.predicates; cl kg.classes;
begin
  perform kg.require(current_setting('kg.ontology_admin', true) = 'true', 'adopting a term needs an ontology admin');
  perform kg.require(p_kind in ('class', 'predicate'), 'a term is a class or a predicate');
  perform kg.require(p_iri ~ '^(kg:[A-Za-z][A-Za-z0-9]*|[a-z][a-z0-9+.-]*:[^\s<>"{}|\\^]+)$', 'the IRI is kg: and a name, or an absolute IRI');
  select max(version) into v from kg.ontology_versions;
  if p_kind = 'class' then
    perform kg.require(p_domain is null and p_range is null and p_datatype is null and p_unit is null and p_single is null, 'a class has a parent and a kind, not a domain, range, datatype or unit');
    select * into cl from kg.classes where iri = p_iri;
    if cl.iri is null or cl.status not in ('base', 'accepted') then
      perform kg.require(p_parent is null or kg.accepted_class(p_parent), 'the parent is not a class the ontology has');
      insert into kg.ontology_versions (version, note) values (v + 1, 'adopt ' || p_term || ' as ' || p_iri) returning version into v;
      insert into kg.classes (iri, label, parent, kind, status, since_version) values (p_iri, p_label, coalesce(p_parent, 'kg:Entity'), coalesce(p_class_kind, 'continuant'), 'accepted', v)
        on conflict (iri) do update set label = excluded.label, parent = excluded.parent, kind = excluded.kind, status = 'accepted', since_version = v;
      added := true;
    end if;
  else
    perform kg.require(p_parent is null and p_class_kind is null, 'a predicate has a domain and a range or datatype, not a parent');
    select * into pr from kg.predicates where iri = p_iri;
    if pr.iri is not null and pr.status in ('base', 'accepted') then
      perform kg.require(p_range is null or pr.kind = 'link', 'that predicate is a property, so it has no range');
    else
      perform kg.require(p_domain is null or kg.accepted_class(p_domain), 'the domain is not a class the ontology has');
      perform kg.require(p_range is null or kg.accepted_class(p_range), 'the range is not a class the ontology has');
      perform kg.require(p_range is not null or p_datatype in ('quantity', 'date', 'text', 'boolean'), 'a property says its datatype: quantity, date, text or boolean');
      perform kg.require(p_range is null or p_datatype is null, 'a link has a range and no datatype');
      perform kg.require(p_unit is null or p_datatype = 'quantity', 'only a quantity has a unit');
      insert into kg.ontology_versions (version, note) values (v + 1, 'adopt ' || p_term || ' as ' || p_iri) returning version into v;
      insert into kg.predicates (iri, label, kind, domain, range, datatype, unit, single_valued, status, since_version)
        values (p_iri, p_label, case when p_range is null then 'property' else 'link' end, coalesce(p_domain, 'kg:Entity'), p_range, p_datatype, p_unit, coalesce(p_single, false), 'accepted', v)
        on conflict (iri) do update set label = excluded.label, kind = excluded.kind, domain = excluded.domain, range = excluded.range, datatype = excluded.datatype,
          unit = excluded.unit, single_valued = excluded.single_valued, status = 'accepted', since_version = v;
      added := true;
    end if;
    if kg.bare_term(p_term) <> kg.bare_term(p_iri) and kg.bare_term(p_term) ~ '^[A-Za-z][A-Za-z0-9]*$' then
      insert into kg.predicate_terms (term, predicate, since_version) values (kg.bare_term(p_term), p_iri, v)
        on conflict (term) do update set predicate = excluded.predicate, since_version = excluded.since_version;
    end if;
  end if;
  update kg.candidates set status = 'adopted', decided_as = p_iri, decided_why = null, decided_by = kg.me(), decided_at = clock_timestamp()
   where kg.bare_term(term) = kg.bare_term(p_term) and kind = p_kind;
  perform kg.record('adopt', null, jsonb_build_object('term', p_term, 'kind', p_kind, 'iri', p_iri), jsonb_build_object('ontologyVersion', v, 'added', added));
  -- The ontology is the deployment's, so the event names no floor: it goes out as the organisation's.
  if added then insert into kg.outbox (topic, payload, floor_kind) values ('kg.ontology.changed', jsonb_build_object('version', v), 'org'); end if;
  return v;
end $$;

-- Dismiss: the term isn't taken, for the reason given. Extraction may still ask; it is no longer counted.
create function kg.act_dismiss(p_term text, p_kind text, p_why text) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(current_setting('kg.ontology_admin', true) = 'true', 'dismissing a term needs an ontology admin');
  update kg.candidates set status = 'dismissed', decided_as = null, decided_why = p_why, decided_by = kg.me(), decided_at = clock_timestamp()
   where term = p_term and kind = p_kind and status = 'proposed';
  perform kg.require(found, 'no term waits by that name: only a proposed one can be dismissed');
  perform kg.record('dismiss', null, jsonb_build_object('term', p_term, 'kind', p_kind, 'why', p_why));
end $$;

alter function kg.act_retain(uuid, uuid, text, jsonb, uuid, text, int4range, tstzrange, text, text, text, text, text, integer, boolean, text, uuid) owner to kg_owner;
alter function kg.act_propose(text, text, text, text, uuid) owner to kg_owner;
alter function kg.act_adopt(text, text, text, text, text, text, text, text, text, text, boolean) owner to kg_owner;
alter function kg.act_dismiss(text, text, text) owner to kg_owner;
revoke execute on function kg.bare_term(text), kg.filed_under(text, jsonb), kg.act_adopt(text, text, text, text, text, text, text, text, text, text, boolean), kg.act_dismiss(text, text, text) from public;
grant execute on function kg.act_adopt(text, text, text, text, text, text, text, text, text, text, boolean), kg.act_dismiss(text, text, text) to kg_app;
`;
