-- BASELINE — profiles + content_items (originally created out-of-band
-- in the Supabase dashboard, never checked into migrations).
--
-- Why this exists: without it a fresh `supabase db reset` from this
-- repo (a) fails the moment a later migration references profiles /
-- content_items, and (b) — most importantly — would enable RLS on
-- content_items with NO select policy checked in, shipping a course
-- catalog that NOBODY can read. Prod works today only because the
-- select policy below exists there uncommitted.
--
-- Sorts first (00000000) so it runs before every dated migration. The
-- later migrations build on this: 20260420 adds the settings columns,
-- 20260424 adds is_platform_admin + the content_items admin write
-- policies, 20260428 adds managers-view-team-profiles, etc.
--
-- Fully idempotent and a no-op on the existing prod DB: guarded enum
-- create, create-table-if-not-exists, drop-then-create policies,
-- create-or-replace function, drop-then-create trigger.

-- ── content_type enum ──────────────────────────────────────────────
-- (CREATE TYPE has no IF NOT EXISTS, so guard it.)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'content_type'
  ) then
    create type public.content_type as enum
      ('bss', 'eos', 'potd', 'machine', 'course');
  end if;
end $$;

-- ── content_items ──────────────────────────────────────────────────
create table if not exists public.content_items (
  id            uuid primary key default gen_random_uuid(),
  type          public.content_type not null,
  sequence_num  integer not null,
  title         text,
  description   text,
  media_url     text,
  duration_mins integer,
  parent_id     uuid references public.content_items(id),
  metadata      jsonb default '{}'::jsonb,
  is_published  boolean default false,
  created_at    timestamptz default now()
);

alter table public.content_items enable row level security;

-- The previously-uncommitted SELECT policy. Without it, RLS-on +
-- no-policy = an unreadable catalog on any fresh environment.
drop policy if exists "Authenticated users can read published content" on public.content_items;
create policy "Authenticated users can read published content"
  on public.content_items
  for select
  to authenticated
  using ( is_published = true );

-- (content_items admin write policies live in 20260424_platform_admin.sql.)

-- ── profiles ───────────────────────────────────────────────────────
-- org_id is a plain column here; its FK to organizations is added in
-- 20260605_profiles_org_fk.sql, because organizations isn't created
-- until 20260417 — after this baseline. The settings columns
-- (show_completed_items, timezone) and is_platform_admin are added by
-- 20260420 / 20260424 respectively.
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  avatar_url        text,
  organization_name text,
  role_title        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  org_id            uuid
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using ( auth.uid() = id );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using ( auth.uid() = id );

-- (managers-view-team-profiles policy lives in
--  20260428_managers_view_team_profiles.sql.)

-- ── Profile auto-creation on signup ────────────────────────────────
-- Trigger on auth.users that inserts a profile row from the new user's
-- metadata. search_path is pinned here (prod's copy omitted it) as a
-- SECURITY DEFINER hardening — behaviour is unchanged since the body
-- already fully-qualifies public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
