-- POTD launch tracking + org-role helper functions.
--
-- POTD ("Pod of the Day") drips one episode per local day after a manager
-- "launches" it for their organization. This migration introduces:
--
--   * public.is_org_admin(uuid) / public.is_org_member(uuid)
--     SECURITY DEFINER helpers that any RLS policy can call.
--     If either already exists in the database (e.g. from earlier
--     out-of-band setup), it is left alone — only created if missing.
--
--   * public.org_potd_launches — one row per org capturing the launch.
--     Single launch per org enforced by PK on org_id.
--
-- This migration assumes public.organizations and public.org_members already
-- exist (created out-of-band; see onboarding flow). It does NOT recreate them.

-- ── Helpers ────────────────────────────────────────────────────────

-- Only create is_org_admin if no such function exists. We can't use
-- `create or replace` because it errors on parameter-name changes,
-- and existing installs may have set this up with a different parameter
-- name (e.g. `check_org_id`).
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_admin'
  ) then
    execute $f$
      create function public.is_org_admin(_org_id uuid)
      returns boolean language sql stable security definer set search_path = public
      as 'select exists (select 1 from public.org_members where org_id = _org_id and user_id = auth.uid() and role = ''admin'')'
    $f$;
    execute 'grant execute on function public.is_org_admin(uuid) to authenticated';
  end if;
end $$;

-- Same defensive pattern for is_org_member.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_member'
  ) then
    execute $f$
      create function public.is_org_member(_org_id uuid)
      returns boolean language sql stable security definer set search_path = public
      as 'select exists (select 1 from public.org_members where org_id = _org_id and user_id = auth.uid())'
    $f$;
    execute 'grant execute on function public.is_org_member(uuid) to authenticated';
  end if;
end $$;


-- ── org_potd_launches ──────────────────────────────────────────────

create table if not exists public.org_potd_launches (
  org_id       uuid primary key references public.organizations(id) on delete cascade,
  launched_at  timestamptz not null default now(),
  launched_by  uuid references auth.users(id) on delete set null
);

alter table public.org_potd_launches enable row level security;

-- SELECT — every member of the org can see whether POTD is launched.
drop policy if exists "potd_launches_member_select" on public.org_potd_launches;
create policy "potd_launches_member_select"
  on public.org_potd_launches
  for select
  to authenticated
  using ( public.is_org_member(org_id) );

-- INSERT — only an org admin can launch.
drop policy if exists "potd_launches_admin_insert" on public.org_potd_launches;
create policy "potd_launches_admin_insert"
  on public.org_potd_launches
  for insert
  to authenticated
  with check (
    public.is_org_admin(org_id)
    and ( launched_by is null or launched_by = auth.uid() )
  );

-- DELETE — only an org admin can un-launch (resets the drip schedule).
drop policy if exists "potd_launches_admin_delete" on public.org_potd_launches;
create policy "potd_launches_admin_delete"
  on public.org_potd_launches
  for delete
  to authenticated
  using ( public.is_org_admin(org_id) );

-- (No UPDATE policy by design — re-launching means delete + insert,
--  which makes the audit trail in launched_at honest.)
