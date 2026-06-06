-- Add the profiles.org_id -> organizations(id) foreign key.
--
-- This lives in its own migration rather than the 00000000 baseline
-- because organizations isn't created until 20260417 — after the
-- baseline. By the time this dated migration runs, organizations
-- exists. Guarded so it's a no-op on prod (the FK already exists from
-- the original out-of-band setup) and skips cleanly on any DB that
-- somehow lacks the organizations table.

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'organizations'
  )
  and not exists (
    select 1 from pg_constraint
     where conname = 'profiles_org_id_fkey'
       and conrelid = 'public.profiles'::regclass
  )
  then
    alter table public.profiles
      add constraint profiles_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete set null;
  end if;
end $$;
