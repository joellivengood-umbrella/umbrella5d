-- Team → course assignments
--
-- An org manager assigns whole COURSES (by slug — bss / eos / machine;
-- POTD is intentionally excluded, it stays available to everyone) to a
-- TEAM. Members of that team then see those courses as required to
-- complete (member-facing view ships separately).
--
-- A course is identified by its slug (matches content_items.type and the
-- src/lib/courses.ts registry), stored as text — so adding a course later
-- needs no change to this table. Mirrors content_assignments' security
-- model, swapping the assignee user_id for a team_id.
--
-- Idempotent: create-if-not-exists tables/indexes; drop-then-create
-- policies. Sorts after 20260613_org_teams.sql (needs teams + the
-- is_org_manager / org membership helpers).

-- ── Table ──────────────────────────────────────────────────────────
create table if not exists public.team_course_assignments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  course_slug  text not null,
  assigned_by  uuid references auth.users(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  -- DB-level allowlist so the data layer is self-defending: all writes go
  -- straight through the browser client, and although the manager UI only
  -- ever offers these slugs, a hand-crafted insert must not persist a bogus
  -- or deliberately-excluded slug (e.g. 'potd'). Update this list when a new
  -- assignable course is added — the same kind of one-line change as adding
  -- the course's content_type. (Mirrors org_members_role_chk.)
  constraint team_course_assignments_course_slug_chk
    check (course_slug in ('bss', 'eos', 'machine'))
);

-- One assignment per (team, course); re-assign is a no-op (the UI relies
-- on the 23505 to treat a duplicate insert as success).
create unique index if not exists team_course_assignments_team_course_key
  on public.team_course_assignments (team_id, course_slug);
create index if not exists team_course_assignments_team_idx
  on public.team_course_assignments (team_id);
create index if not exists team_course_assignments_org_idx
  on public.team_course_assignments (org_id);

alter table public.team_course_assignments enable row level security;

-- ── RLS ────────────────────────────────────────────────────────────
-- Managers manage everything in their org; members may READ the
-- assignments of teams they belong to. (No UPDATE policy — an assignment
-- is toggled by insert/delete.)

drop policy if exists "managers read team course assignments" on public.team_course_assignments;
create policy "managers read team course assignments"
  on public.team_course_assignments for select to authenticated
  using ( public.is_org_manager(org_id) );

drop policy if exists "members read own team course assignments" on public.team_course_assignments;
create policy "members read own team course assignments"
  on public.team_course_assignments for select to authenticated
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = team_course_assignments.team_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "managers insert team course assignments" on public.team_course_assignments;
create policy "managers insert team course assignments"
  on public.team_course_assignments for insert to authenticated
  with check (
    public.is_org_manager(org_id)
    and (assigned_by is null or assigned_by = auth.uid())
    -- the target team must belong to the same org (no cross-tenant stitching)
    and exists (
      select 1
      from public.teams t
      where t.id = team_course_assignments.team_id
        and t.org_id = team_course_assignments.org_id
    )
  );

drop policy if exists "managers delete team course assignments" on public.team_course_assignments;
create policy "managers delete team course assignments"
  on public.team_course_assignments for delete to authenticated
  using ( public.is_org_manager(org_id) );

-- ── team_members: let a member read their OWN memberships ──────────
-- Until now team_members was manager-read-only. The member-facing read
-- policy above resolves "is this one of MY teams?" via team_members, and
-- the upcoming dashboard view needs to know which teams the member is on,
-- so grant members read of their own membership rows. (Anticipated by the
-- 20260613 migration's notes.)
drop policy if exists "members read own team memberships" on public.team_members;
create policy "members read own team memberships"
  on public.team_members for select to authenticated
  using ( user_id = auth.uid() );
