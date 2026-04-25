-- Disambiguate platform-level admin from org-level "admin" by renaming
-- the latter to "manager". After this migration:
--
--   * profiles.is_platform_admin still means site-wide super-admin
--     (Joel + dev team only).
--
--   * org_members.role values are now 'manager' and 'member'.
--     The 'admin' value is renamed to 'manager' across existing rows.
--
--   * public.is_org_admin(uuid) is replaced by public.is_org_manager(uuid)
--     with the same shape but a check against role = 'manager'.
--
--   * Five RLS policies (3 on org_members, 2 on org_potd_launches) are
--     dropped and recreated against the new function with manager-flavored
--     names.
--
-- This migration is idempotent: drops are guarded with IF EXISTS, the data
-- update is a no-op after first run, and the policy/function creates use
-- create-or-replace / drop-then-create.

-- 1. Drop old policies (those referencing is_org_admin)
drop policy if exists "admins can add members"          on public.org_members;
drop policy if exists "admins can remove members"       on public.org_members;
drop policy if exists "admins can view all org members" on public.org_members;
drop policy if exists "potd_launches_admin_delete"      on public.org_potd_launches;
drop policy if exists "potd_launches_admin_insert"      on public.org_potd_launches;

-- Also drop the new policy names so this is safe to re-run.
drop policy if exists "managers can add members"          on public.org_members;
drop policy if exists "managers can remove members"       on public.org_members;
drop policy if exists "managers can view all org members" on public.org_members;
drop policy if exists "potd_launches_manager_delete"      on public.org_potd_launches;
drop policy if exists "potd_launches_manager_insert"      on public.org_potd_launches;

-- 2. Drop the old function — now safe because no policy depends on it.
drop function if exists public.is_org_admin(uuid);

-- 3. Update existing role data.
update public.org_members set role = 'manager' where role = 'admin';

-- 4. Create the new function.
create or replace function public.is_org_manager(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.org_members
     where org_id  = _org_id
       and user_id = auth.uid()
       and role    = 'manager'
  );
$$;

grant execute on function public.is_org_manager(uuid) to authenticated;

-- 5. Recreate the policies with new names + new function reference.

-- org_members
create policy "managers can view all org members"
  on public.org_members
  for select
  to authenticated
  using ( public.is_org_manager(org_id) );

create policy "managers can add members"
  on public.org_members
  for insert
  to authenticated
  with check ( public.is_org_manager(org_id) );

create policy "managers can remove members"
  on public.org_members
  for delete
  to authenticated
  using ( public.is_org_manager(org_id) );

-- org_potd_launches
create policy "potd_launches_manager_insert"
  on public.org_potd_launches
  for insert
  to authenticated
  with check (
    public.is_org_manager(org_id)
    and ( launched_by is null or launched_by = auth.uid() )
  );

create policy "potd_launches_manager_delete"
  on public.org_potd_launches
  for delete
  to authenticated
  using ( public.is_org_manager(org_id) );
