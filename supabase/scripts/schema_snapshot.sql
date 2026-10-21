-- Schema snapshot: drift check between production and the migrations (read-only)
--
-- Lists every function, RLS policy, table (+ RLS flags and grants), column,
-- constraint, index, trigger, event trigger, type and storage bucket in one
-- row per category. Run it in the Supabase SQL editor (Export -> CSV), run
-- it again on a database built only from supabase/migrations, and diff the
-- two: anything only in production was changed outside a migration.
-- Expected production-only noise: Supabase's event triggers (ensure_rls,
-- issue_*, pgrst_*) and public.rls_auto_enable(), which Supabase manages.
-- First used 2026-10-21 (see migrations/20261021_reconcile_prod_schema.sql).
with
fns as (
  select 'functions' as section,
         p.oid::regprocedure::text || ' :: ' || concat_ws(' | ',
           'returns ' || pg_get_function_result(p.oid),
           'lang ' || l.lanname,
           case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
           case when p.prosecdef then 'definer' else 'invoker' end,
           'config ' || coalesce(array_to_string(p.proconfig, ','), '-'),
           'owner ' || pg_get_userbyid(p.proowner),
           'exec anon=' || has_function_privilege('anon', p.oid, 'execute')
             || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute')
             || ' svc=' || has_function_privilege('service_role', p.oid, 'execute'),
           'body ' || btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g'))) as line
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
pols as (
  select 'policies',
         n.nspname || '.' || c.relname || ' / ' || pol.polname || ' :: ' || concat_ws(' | ',
           case pol.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
                           when 'd' then 'delete' else 'all' end,
           case when pol.polpermissive then 'permissive' else 'restrictive' end,
           'to ' || coalesce((select string_agg(r.rolname, ',' order by r.rolname)
                                from pg_roles r where r.oid = any (pol.polroles)), 'public'),
           'using ' || coalesce(regexp_replace(pg_get_expr(pol.polqual, pol.polrelid), '\s+', ' ', 'g'), '-'),
           'check ' || coalesce(regexp_replace(pg_get_expr(pol.polwithcheck, pol.polrelid), '\s+', ' ', 'g'), '-'))
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'storage')
),
tbls as (
  select 'tables',
         c.relname || ' :: ' || concat_ws(' | ',
           'kind ' || c.relkind::text,
           'rls ' || c.relrowsecurity,
           'force ' || c.relforcerowsecurity,
           'anon ' || concat(
             case when has_table_privilege('anon', c.oid, 'select') then 'S' end,
             case when has_table_privilege('anon', c.oid, 'insert') then 'I' end,
             case when has_table_privilege('anon', c.oid, 'update') then 'U' end,
             case when has_table_privilege('anon', c.oid, 'delete') then 'D' end),
           'auth ' || concat(
             case when has_table_privilege('authenticated', c.oid, 'select') then 'S' end,
             case when has_table_privilege('authenticated', c.oid, 'insert') then 'I' end,
             case when has_table_privilege('authenticated', c.oid, 'update') then 'U' end,
             case when has_table_privilege('authenticated', c.oid, 'delete') then 'D' end))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'v', 'm')
),
cols as (
  select 'columns',
         c.relname || '.' || a.attname || ' :: ' || concat_ws(' | ',
           format_type(a.atttypid, a.atttypmod),
           case when a.attnotnull then 'not null' else 'null' end,
           'default ' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'),
           'auth-ins ' || has_column_privilege('authenticated', c.oid, a.attname, 'insert'),
           'auth-upd ' || has_column_privilege('authenticated', c.oid, a.attname, 'update'))
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and a.attnum > 0
     and not a.attisdropped
),
cons as (
  select 'constraints',
         c.relname || ' / ' || con.conname || ' :: ' || pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and con.contype in ('p', 'u', 'f', 'c', 'x')
),
idx as (
  select 'indexes',
         i.tablename || ' / ' || i.indexname || ' :: ' || i.indexdef
    from pg_indexes i
   where i.schemaname = 'public'
),
trg as (
  select 'triggers',
         tn.nspname || '.' || c.relname || ' / ' || t.tgname || ' :: ' || pg_get_triggerdef(t.oid)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace tn on tn.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where not t.tgisinternal
     and pn.nspname = 'public'
),
evt as (
  select 'event_triggers',
         e.evtname || ' :: ' || e.evtevent || ' -> ' || e.evtfoid::regproc::text || ' | enabled ' || e.evtenabled::text
    from pg_event_trigger e
),
typs as (
  select 'types',
         t.typname || ' :: ' || case t.typtype
           when 'e' then 'enum ' || (select string_agg(e.enumlabel, ',' order by e.enumsortorder)
                                       from pg_enum e where e.enumtypid = t.oid)
           else 'domain ' || format_type(t.typbasetype, t.typtypmod) end
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
     and t.typtype in ('e', 'd')
),
bkts as (
  select 'buckets',
         b.id || ' :: public ' || b.public
    from storage.buckets b
),
srv as (
  select 'server', version()
)
select section,
       count(*) as items,
       string_agg(line, E'\n' order by line) as details
  from (select * from fns
        union all select * from pols
        union all select * from tbls
        union all select * from cols
        union all select * from cons
        union all select * from idx
        union all select * from trg
        union all select * from evt
        union all select * from typs
        union all select * from bkts
        union all select * from srv) s(section, line)
 group by section
 order by section;
