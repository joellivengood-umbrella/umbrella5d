-- Platform admin role
--
-- Adds an is_platform_admin flag to profiles and grants admins write
-- access to content_items. The flag is column-level revoked from the
-- `authenticated` role so users cannot self-promote via the existing
-- "update own profile" RLS policy.
--
-- Rollout:
--   1. Run this migration.
--   2. Manually flip your own row to true:
--        update public.profiles set is_platform_admin = true where id = '<your uuid>';

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

-- Prevent users from updating this column themselves. Even with the
-- existing per-row update policy, the column-level grant gates writes
-- before RLS is even evaluated. Service-role (used in SQL editor and
-- server-side admin tooling) bypasses this and can still set the flag.
revoke update (is_platform_admin) on public.profiles from authenticated;

-- Helper that any RLS policy can call to test the current user.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Make sure RLS is on so our policies actually take effect.
alter table public.content_items enable row level security;

-- Existing read policy (if any) is left alone. We only add write
-- policies for platform admins. Drop-then-create keeps it idempotent.
drop policy if exists "content_items_admin_insert" on public.content_items;
create policy "content_items_admin_insert"
  on public.content_items
  for insert
  with check (public.is_platform_admin());

drop policy if exists "content_items_admin_update" on public.content_items;
create policy "content_items_admin_update"
  on public.content_items
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "content_items_admin_delete" on public.content_items;
create policy "content_items_admin_delete"
  on public.content_items
  for delete
  using (public.is_platform_admin());
