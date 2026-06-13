-- Org Teams — named sub-groups inside an organization
--
-- Lets a manager organize their org's members into teams (HR,
-- Executives, Accounting…) and tag people into them. Two new tables:
--   teams         — one named group per row, owned by an organization
--   team_members  — many-to-many people<->teams (a person may be on
--                   several teams at once)
--
-- Security model mirrors content_assignments exactly: every row carries
-- a denormalized org_id, and EVERY write is gated by the existing
-- public.is_org_manager(org_id) SECURITY DEFINER helper, so a manager
-- can only ever touch rows in their OWN org. Reads are manager-only for
-- now (this is a manager-facing feature); a member-facing read policy
-- can be added later without a schema change.
--
-- Idempotent: create-if-not-exists tables/indexes, drop-then-create
-- policies, create-or-replace trigger fn. Sorts AFTER 20260608 (so
-- public.tg_set_updated_at exists) and after the org helpers + the
-- handle_org_member_removed cleanup trigger (20260428/20260531).

-- ── 1. teams ───────────────────────────────────────────────────────
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A blank name is meaningless and would render as an empty chip.
  constraint teams_name_not_blank check (length(btrim(name)) > 0)
);

-- One team name per org, case-insensitive: "HR" can't be created twice
-- (nor "hr" alongside "HR"). A duplicate insert raises 23505, which the
-- client turns into a friendly "already exists" message.
create unique index if not exists teams_org_lower_name_key
  on public.teams (org_id, lower(name));
create index if not exists teams_org_id_idx on public.teams (org_id);

-- Keep updated_at fresh on rename (reuses the shared trigger fn from
-- 20260608_machine_structure.sql).
drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.tg_set_updated_at();

-- A team can be renamed but NEVER reparented to a different org —
-- moving org_id would desync its team_members.org_id (which the
-- team_members INSERT check pins to the team's org). RLS WITH CHECK
-- can't compare against the OLD row, so enforce immutability here.
create or replace function public.tg_teams_org_id_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'teams.org_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_org_id_immutable on public.teams;
create trigger teams_org_id_immutable
  before update on public.teams
  for each row execute function public.tg_teams_org_id_immutable();

alter table public.teams enable row level security;

drop policy if exists "managers read teams"   on public.teams;
drop policy if exists "managers insert teams"  on public.teams;
drop policy if exists "managers update teams"  on public.teams;
drop policy if exists "managers delete teams"  on public.teams;

create policy "managers read teams" on public.teams
  for select to authenticated
  using ( public.is_org_manager(org_id) );

create policy "managers insert teams" on public.teams
  for insert to authenticated
  with check ( public.is_org_manager(org_id) );

create policy "managers update teams" on public.teams
  for update to authenticated
  using ( public.is_org_manager(org_id) )
  with check ( public.is_org_manager(org_id) );

create policy "managers delete teams" on public.teams
  for delete to authenticated
  using ( public.is_org_manager(org_id) );

-- ── 2. team_members (many-to-many) ─────────────────────────────────
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid not null references public.teams(id)         on delete cascade,
  user_id    uuid not null references auth.users(id)           on delete cascade,
  added_by   uuid references auth.users(id)                    on delete set null,
  created_at timestamptz not null default now(),
  -- A person is on a given team at most once.
  constraint team_members_team_user_key unique (team_id, user_id)
);

create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id);
create index if not exists team_members_org_id_idx  on public.team_members (org_id);

alter table public.team_members enable row level security;

drop policy if exists "managers read team members"   on public.team_members;
drop policy if exists "managers insert team members" on public.team_members;
drop policy if exists "managers delete team members" on public.team_members;

create policy "managers read team members" on public.team_members
  for select to authenticated
  using ( public.is_org_manager(org_id) );

-- INSERT: only a manager of this org; added_by can't impersonate
-- someone else; and BOTH the target user and the team must actually
-- belong to this same org. The two existence checks prevent a forged
-- org_id, attaching a non-member, or stitching a team to a user across
-- tenants.
create policy "managers insert team members" on public.team_members
  for insert to authenticated
  with check (
    public.is_org_manager(org_id)
    and (added_by is null or added_by = auth.uid())
    and exists (
      select 1 from public.org_members m
       where m.org_id  = team_members.org_id
         and m.user_id = team_members.user_id
    )
    and exists (
      select 1 from public.teams t
       where t.id     = team_members.team_id
         and t.org_id = team_members.org_id
    )
  );

create policy "managers delete team members" on public.team_members
  for delete to authenticated
  using ( public.is_org_manager(org_id) );

-- (No UPDATE policy — membership is toggled by insert/delete; there's
--  nothing to mutate in place.)

-- ── 3. Clean team memberships when a member leaves the org ─────────
-- Extends handle_org_member_removed (which already resets the profile
-- and clears content_assignments) so a removed user's team_members rows
-- in that org also go. Without this, re-joining the same org would
-- silently resurface stale team tags. The on_org_member_removed trigger
-- already points at this function — only the body changes.
create or replace function public.handle_org_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reset the user's profile to a "no org" state if the removed org was
  -- their primary one.
  update public.profiles
     set org_id            = null,
         organization_name = null,
         role_title        = null
   where id     = old.user_id
     and org_id = old.org_id;

  -- Drop any content assignments this user had in this org.
  delete from public.content_assignments
   where org_id  = old.org_id
     and user_id = old.user_id;

  -- Drop any team memberships this user had in this org.
  delete from public.team_members
   where org_id  = old.org_id
     and user_id = old.user_id;

  return old;
end;
$$;
