// Migration 8: the forget ledger outside the database (plan PR 6, requirement 15). After a restore, the
// migrate job forgets again what the ledger file names (ledger.ts). Only Postgres's admin login runs these:
// they are kg_owner's, and kg_app is never granted them.
export const sql = String.raw`
-- squawk-ignore-file ban-revoke
-- Forgets again, as kg.act_forget did, each named observation that is here and not forgotten, and says which.
-- An id the database doesn't hold (restored to before it was retained) has nothing to forget.
create function kg.reapply_forgets(p_ids uuid[]) returns setof uuid language plpgsql security definer set search_path = kg, pg_temp as $$
declare o kg.observations;
begin
  for o in select * from kg.observations where id = any (p_ids) and forgotten_at is null order by id loop
    update kg.observations set forgotten_at = clock_timestamp(), value = null, quote = '', anchor = null where id = o.id;
    insert into kg.forget_ledger (observation, floor) values (o.id, o.floor) on conflict do nothing;
    return next o.id;
  end loop;
end $$;
alter function kg.reapply_forgets(uuid[]) owner to kg_owner;

-- What the database's own ledger holds, so the file can catch up.
create function kg.forgotten_ids() returns setof uuid language sql stable security definer set search_path = kg, pg_temp as $$
  select observation from kg.forget_ledger order by observation $$;
alter function kg.forgotten_ids() owner to kg_owner;
-- Made by the admin login, so kg_owner's default (no one may execute) doesn't reach them: said here.
revoke execute on function kg.reapply_forgets(uuid[]), kg.forgotten_ids() from public;
`;
