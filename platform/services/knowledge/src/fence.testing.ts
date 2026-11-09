import type pg from 'pg';

/** Tables kg_app reads in full because they hold nothing of any floor: the ontology. */
export const GLOBAL_TABLES = ['classes', 'predicates'];

/** The functions kg_app may call: the actions, its own sight, and the reads the views and the seam need. */
export const APP_FUNCTIONS = /^(act_.+|me|here|app|my_sight|lookup_key|known_entities|accepted_class|stands|sources_behind|evidence_unseen|last_change|is_disputed)$/;

/**
 * What the database catalog says is wrong with the fence, as sentences; empty when it holds. Asked as the
 * migrating login. Each check is one way a row could leave its floor that no read test would notice.
 */
export const fenceFindings = async (admin: pg.Pool): Promise<string[]> => {
  const found: string[] = [];
  const q = async <T,>(sql: string) => (await admin.query(sql)).rows as T[];

  for (const r of await q<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>(
    `select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname in ('kg_app', 'kg_owner')`,
  )) {
    if (r.rolsuper) found.push(`${r.rolname} is a superuser, which skips row security.`);
    if (r.rolbypassrls) found.push(`${r.rolname} has BYPASSRLS.`);
    if (r.rolname === 'kg_owner' && r.rolcanlogin) found.push('kg_owner can sign in: only kg_app should.');
  }
  for (const r of await q<{ role: string }>(`select b.rolname as role from pg_auth_members m join pg_roles a on a.oid = m.member join pg_roles b on b.oid = m.roleid where a.rolname = 'kg_app'`))
    found.push(`kg_app is a member of ${r.role}, and has its rights.`);

  for (const r of await q<{ name: string; owner: string; kind: string; rls: boolean; invoker: boolean; reads: boolean; writes: boolean; policies: number }>(`
    select c.relname as name, pg_get_userbyid(c.relowner) as owner, c.relkind as kind, c.relrowsecurity as rls,
           coalesce(c.reloptions @> array['security_invoker=true'], false) as invoker,
           has_table_privilege('kg_app', c.oid, 'select') as reads,
           has_table_privilege('kg_app', c.oid, 'insert') or has_table_privilege('kg_app', c.oid, 'update')
             or has_table_privilege('kg_app', c.oid, 'delete') or has_table_privilege('kg_app', c.oid, 'truncate') as writes,
           (select count(*)::int from pg_policy p where p.polrelid = c.oid and p.polcmd in ('r', '*') and 'kg_app'::regrole::oid = any(p.polroles)) as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'kg' and c.relkind in ('r', 'v', 'p') and c.relname <> 'migrations'`)) {
    if (r.owner !== 'kg_owner') found.push(`kg.${r.name} is owned by ${r.owner}, not kg_owner.`);
    if (r.writes) found.push(`kg_app can write kg.${r.name} directly, not only through an action.`);
    if (r.kind === 'v' && !r.invoker) found.push(`The view kg.${r.name} runs as its owner, so row security doesn't apply to its readers.`);
    if (r.kind !== 'v' && r.reads && !GLOBAL_TABLES.includes(r.name) && !(r.rls && r.policies > 0))
      found.push(`kg_app reads kg.${r.name} with no row security policy for it.`);
  }

  for (const r of await q<{ fn: string; definer: boolean; config: string[] | null; owner: string; app: boolean; name: string }>(`
    select p.oid::regprocedure::text as fn, p.proname as name, p.prosecdef as definer, p.proconfig as config, pg_get_userbyid(p.proowner) as owner,
           has_function_privilege('kg_app', p.oid, 'execute') as app
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'kg'`)) {
    if (r.owner !== 'kg_owner') found.push(`${r.fn} is owned by ${r.owner}, not kg_owner.`);
    if (r.definer && !(r.config ?? []).some((c) => /^search_path=kg, pg_temp$/.test(c)))
      found.push(`${r.fn} runs as its owner without search_path fixed to "kg, pg_temp".`);
    if (r.app && !APP_FUNCTIONS.test(r.name)) found.push(`kg_app can call ${r.fn}, which isn't an action or a fenced read.`);
  }
  return found;
};
