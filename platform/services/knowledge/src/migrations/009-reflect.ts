// Migration 9: reflect as the service (plan PR 7, requirement 14). The knowledge service writes each floor's
// summary of an entity from that floor's own beliefs, on its own schedule (reflect.ts): no person asks, so these
// run as the service, and each reads one floor only. Nothing here is a person's read.
export const sql = String.raw`
-- squawk-ignore-file ban-revoke
-- What wants a summary: each entity with a live belief on a floor, where that floor's summary is missing or
-- older than the entity's beliefs, and the beliefs have been quiet for p_quiet (the debounce). Oldest change first.
create function kg.reflect_wanted(p_quiet interval, p_limit integer) returns table (entity uuid, floor text, changed_at timestamptz, summarised boolean)
language sql stable security definer set search_path = kg, pg_temp as $$
  with held as (
    select distinct x.entity, r.floor
    from kg.beliefs b
    join kg.belief_reach r on r.belief = b.id and r.withdrawn_at is null
    cross join lateral (values (b.subject), (b.object)) as x(entity)
    where x.entity is not null and b.superseded_at is null
  ), changed as (
    select h.entity, h.floor, kg.last_change(h.entity) as changed_at, s.beliefs_as_of
    from held h join kg.entities e on e.id = h.entity and e.state = 'active'
    left join kg.summaries s on s.entity = h.entity and s.floor = h.floor
  )
  select c.entity, c.floor, c.changed_at, c.beliefs_as_of is not null
  from changed c
  where c.changed_at is not null and (c.beliefs_as_of is null or c.beliefs_as_of < c.changed_at)
    and c.changed_at <= clock_timestamp() - p_quiet
  order by c.changed_at, c.entity, c.floor
  limit p_limit $$;
alter function kg.reflect_wanted(interval, integer) owner to kg_owner;

-- What one floor believes of an entity now, for its summary: that floor's reach only, nothing superseded or ended.
create function kg.floor_beliefs(p_entity uuid, p_floor text) returns table (label text, predicate text, value jsonb, object_label text, valid_from timestamptz, valid_to timestamptz, modality text)
language sql stable security definer set search_path = kg, pg_temp as $$
  with named as (
    select n.entity, n.name from kg.entity_names n
    where n.entity in (select p_entity union select b.object from kg.beliefs b where b.subject = p_entity and b.object is not null)
    order by n.entity, (n.floor = p_floor) desc, n.is_label desc, n.name
  ), label as (select distinct on (entity) entity, name from named)
  select (select name from label where entity = p_entity), b.predicate, b.value,
         (select name from label where entity = b.object), lower(b.valid), upper(b.valid), b.modality
  from kg.beliefs b join kg.belief_reach r on r.belief = b.id and r.floor = p_floor and r.withdrawn_at is null
  where b.subject = p_entity and b.superseded_at is null and b.ended_at is null
  order by b.predicate, b.recorded_at
  limit 200 $$;
alter function kg.floor_beliefs(uuid, text) owner to kg_owner;

-- Writes a floor's summary as the service. p_as_of is when the beliefs it was written from last changed, read
-- before the model was asked, so a change while it wrote leaves the summary marked older than its beliefs.
create function kg.reflect_write(p_entity uuid, p_floor text, p_text text, p_model text, p_as_of timestamptz) returns void
language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  insert into kg.summaries (entity, floor, text, beliefs_as_of, model) values (p_entity, p_floor, p_text, p_as_of, p_model)
    on conflict (entity, floor) do update set text = excluded.text, written_at = clock_timestamp(), beliefs_as_of = excluded.beliefs_as_of, model = excluded.model;
  insert into kg.actions (kind, person, floor, input) values ('reflect', 'the knowledge service', p_floor, jsonb_build_object('entity', p_entity, 'model', p_model));
end $$;
alter function kg.reflect_write(uuid, text, text, text, timestamptz) owner to kg_owner;

-- How many summaries the service has written since a moment, per floor: the budgets count from the audit, so a
-- restart doesn't hand out a day's budget twice.
create function kg.reflects_since(p_since timestamptz) returns table (floor text, n integer)
language sql stable security definer set search_path = kg, pg_temp as $$
  select a.floor, count(*)::integer from kg.actions a where a.kind = 'reflect' and a.person = 'the knowledge service' and a.at >= p_since group by a.floor $$;
alter function kg.reflects_since(timestamptz) owner to kg_owner;

revoke execute on function kg.reflect_wanted(interval, integer), kg.floor_beliefs(uuid, text), kg.reflect_write(uuid, text, text, text, timestamptz), kg.reflects_since(timestamptz) from public;
grant execute on function kg.reflect_wanted(interval, integer), kg.floor_beliefs(uuid, text), kg.reflect_write(uuid, text, text, text, timestamptz), kg.reflects_since(timestamptz) to kg_app;
`;
