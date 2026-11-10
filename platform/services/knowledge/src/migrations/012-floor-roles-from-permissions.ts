// Migration 12: floor roles from the permissions service (plan PR 6c-2; ADR 0085, ADR 0095). Who settles and
// who raises on a floor is set in Admin and kept in OpenFGA; the service asks it on each request and writes the
// answer here for that person, so the store's checks (kg.has_role) read what OpenFGA says now. When the
// permissions service can't answer, the person holds neither role anywhere: the answer written is none.
export const sql = String.raw`
-- squawk-ignore-file ban-revoke
-- Replaces the person's settler and raiser rows with p_roles ([{floor, role}]), on floors the store knows.
create function kg.sync_roles(p_person text, p_roles jsonb) returns void language plpgsql security definer set search_path = kg, pg_temp as $$
begin
  perform kg.require(p_person is not null and p_person <> '', 'no person is named');
  -- This runs on each call, not at migration, and drops only the roles the permissions service no longer gives.
  -- squawk-ignore augur-delete-rows
  delete from kg.floor_roles r where r.person = p_person
    and not exists (select 1 from jsonb_to_recordset(coalesce(p_roles, '[]')) as x(floor text, role text) where x.floor = r.floor and x.role = r.role);
  insert into kg.floor_roles (floor, person, role)
    select x.floor, p_person, x.role from jsonb_to_recordset(coalesce(p_roles, '[]')) as x(floor text, role text)
    where x.role in ('settler', 'raiser') and exists (select 1 from kg.floors f where f.id = x.floor)
    on conflict do nothing;
end $$;
alter function kg.sync_roles(text, jsonb) owner to kg_owner;
revoke execute on function kg.sync_roles(text, jsonb) from public;
grant execute on function kg.sync_roles(text, jsonb) to kg_app;
`;
