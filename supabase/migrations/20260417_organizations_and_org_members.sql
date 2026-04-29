-- Backfill migration for organizations + org_members.
--
-- These tables and their RLS policies were originally created in the
-- Supabase dashboard before this project adopted file-based migrations.
-- This file recreates them exactly as they exist in production today,
-- so a fresh database built from /supabase/migrations alone reproduces
-- the live schema.
--
-- Idempotency: this migration is safe to re-run on databases where the
-- tables already exist.
--   * `create table if not exists` is a no-op when the table is present.
--   * Helper functions use the defensive do-block pattern from
--     20260424_potd_launches.sql — only created if missing, so we don't
--     trip "cannot change name of input parameter" against installs that
--     set them up out-of-band with different parameter names.
--   * RLS policies are dropped (with `if exists`) before being created.
--
-- Dependency order: this file must sort BEFORE
-- 20260424_potd_launches.sql and 20260424_rename_org_admin_to_manager.sql,
-- which both assume `organizations` and `org_members` already exist.
-- The 20260417 prefix accomplishes that alphabetically.

-- ── 1. Tables ──────────────────────────────────────────────────────

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users(id) on delete set null,
  plan_tier   text not null default 'individual',
  invite_code text unique default substring((gen_random_uuid())::text, 1, 8),
  created_at  timestamptz default now()
);

create table if not exists public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id)            on delete cascade,
  role       text not null default 'member',
  created_at timestamptz default now(),
  constraint org_members_org_id_user_id_key unique (org_id, user_id)
);

-- ── 2. Row Level Security ──────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;

-- ── 3. Helper functions ────────────────────────────────────────────
--
-- These are referenced by the manager-flavored policies below, so they
-- must exist before policy creation. Defensive create — if a function
-- with this name already exists (e.g. from out-of-band setup with a
-- different parameter name), we leave it alone rather than erroring.

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

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_manager'
  ) then
    execute $f$
      create function public.is_org_manager(_org_id uuid)
      returns boolean language sql stable security definer set search_path = public
      as 'select exists (select 1 from public.org_members where org_id = _org_id and user_id = auth.uid() and role = ''manager'')'
    $f$;
    execute 'grant execute on function public.is_org_manager(uuid) to authenticated';
  end if;
end $$;

-- ── 4. organizations policies ──────────────────────────────────────

drop policy if exists "authenticated users can create orgs" on public.organizations;
create policy "authenticated users can create orgs"
  on public.organizations
  for insert
  to authenticated
  with check ( auth.uid() = owner_id );

-- Any signed-in user can SELECT an org by invite_code. The onboarding
-- "Join Organization" flow needs this; it's safe because invite_code is
-- unguessable (8-char random hex) and the row exposes only id + name.
drop policy if exists "anyone can look up org by invite code" on public.organizations;
create policy "anyone can look up org by invite code"
  on public.organizations
  for select
  to authenticated
  using ( auth.uid() is not null );

drop policy if exists "owner can view own org" on public.organizations;
create policy "owner can view own org"
  on public.organizations
  for select
  to authenticated
  using ( owner_id = auth.uid() );

drop policy if exists "members can view their org" on public.organizations;
create policy "members can view their org"
  on public.organizations
  for select
  to authenticated
  using (
    id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

drop policy if exists "owner can update org" on public.organizations;
create policy "owner can update org"
  on public.organizations
  for update
  to authenticated
  using ( owner_id = auth.uid() );

-- ── 5. org_members policies ────────────────────────────────────────

drop policy if exists "users can insert own membership" on public.org_members;
create policy "users can insert own membership"
  on public.org_members
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

drop policy if exists "users can view own membership" on public.org_members;
create policy "users can view own membership"
  on public.org_members
  for select
  to authenticated
  using ( user_id = auth.uid() );

drop policy if exists "managers can add members" on public.org_members;
create policy "managers can add members"
  on public.org_members
  for insert
  to authenticated
  with check ( public.is_org_manager(org_id) );

drop policy if exists "managers can view all org members" on public.org_members;
create policy "managers can view all org members"
  on public.org_members
  for select
  to authenticated
  using ( public.is_org_manager(org_id) );

drop policy if exists "managers can remove members" on public.org_members;
create policy "managers can remove members"
  on public.org_members
  for delete
  to authenticated
  using ( public.is_org_manager(org_id) );
