-- Courses: the dynamic course library (replaces the hardcoded registry)
--
-- Until now a "course" existed only as (1) a value of the content_type
-- ENUM, (2) an entry in src/lib/courses.ts, and (3) a .course-theme-{slug}
-- CSS block — three places hand-edited in lockstep, and the ENUM could not
-- be extended from the app at all. This migration makes a course a ROW: one
-- public.courses table that becomes the single source of truth for the grid,
-- progress math, assignments, theming, and (soon) an admin "Create Course"
-- flow. NOTHING changes on screen — the four existing courses are seeded to
-- exactly their current behaviour; later PRs point the app at the table.
--
-- Three structural moves:
--   1. Create + seed public.courses, with program/assignable/published flags
--      and theme tokens, so "is this the program?" / "assignable?" / colors
--      become DATA instead of scattered literals.
--   2. Move content_items.type off the locked ENUM onto plain text with a FK
--      to courses(slug) — so a new course is a normal INSERT, not an
--      irreversible ALTER TYPE ... ADD VALUE the app can't even run.
--   3. Replace team_course_assignments' hardcoded slug allowlist CHECK with a
--      FK to courses + an is_assignable gate in the RLS insert policy.
--
-- Idempotent: create-if-not-exists, on-conflict-do-nothing seed, guarded
-- constraint adds, drop-then-create policies. Sorts after 20260617.

-- ── 1. courses table ───────────────────────────────────────────────
create table if not exists public.courses (
  slug             text primary key,
  title            text not null,
  short_title      text not null,
  blurb            text not null default '',
  media_kind       text not null default 'video',
  -- consumption shape: 'flat' (a list of media items), 'versioned' (bss's
  -- 5hr/3hr/… lengths), 'rich' (the 5D Machine's Parts → blocks). New
  -- admin-created courses are 'flat'.
  template         text not null default 'flat',
  has_drip_release boolean not null default false,
  sort_order       integer not null default 0,
  -- the 8 --ct-* theme tokens (see globals.css .course-theme-{slug}); applied
  -- inline by later PRs so a new course is fully themed from data, no CSS edit.
  theme            jsonb not null default '{}'::jsonb,
  is_published     boolean not null default true,
  -- counts toward the headline "program" progress %. New courses default
  -- FALSE: a published course starts as a bonus track and never retroactively
  -- drops everyone's % until it's deliberately promoted to the program.
  in_program       boolean not null default false,
  -- can an org manager require this course of a team.
  is_assignable    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint courses_media_kind_chk  check (media_kind in ('video', 'audio')),
  constraint courses_template_chk    check (template in ('flat', 'versioned', 'rich')),
  -- URL-safe slug: lowercase letters, digits, hyphens; can't start with '-'.
  constraint courses_slug_format_chk check (slug ~ '^[a-z0-9][a-z0-9-]*$')
);

-- Keep updated_at fresh (shared trigger fn from 20260608).
drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
  before update on public.courses
  for each row execute function public.tg_set_updated_at();

-- ── 2. seed the four existing courses (exact current behaviour) ─────
-- Titles/blurbs match src/lib/courses.ts and theme tokens match the four
-- .course-theme-{slug} blocks, so the app looks identical once it reads here.
-- on conflict do nothing: establishes the canonical rows once and never
-- clobbers later admin edits if this migration is re-applied.
insert into public.courses
  (slug, title, short_title, blurb, media_kind, template, has_drip_release,
   sort_order, is_published, in_program, is_assignable, theme)
values
  ('bss', 'Business Success Seminar', 'BSS',
   'The hero seminar for every member of an organization. Available in four lengths so leaders can assign the right depth to the right team.',
   'video', 'versioned', false, 10, true, true, true,
   jsonb_build_object(
     'from', '#5b4fff', 'to', '#7c3aed', 'text', '#5b4fff',
     'tint', 'rgba(91, 79, 255, .1)', 'tintBadge', 'rgba(91, 79, 255, .12)',
     'hoverBg', 'rgba(91, 79, 255, .07)', 'doneText', '#fff', 'borderH', '#c4b8ff')),
  ('eos', 'Employee Opportunity Seminars', 'EOS',
   'Nine five-minute video seminars designed to open doors for every employee in the organization.',
   'video', 'flat', false, 20, true, true, true,
   jsonb_build_object(
     'from', '#FF6E6E', 'to', '#e03535', 'text', '#c93030',
     'tint', 'rgba(255, 110, 110, .12)', 'tintBadge', 'rgba(255, 110, 110, .14)',
     'hoverBg', 'rgba(255, 110, 110, .08)', 'doneText', '#fff', 'borderH', '#ffb8b8')),
  ('potd', 'Pod of the Day', 'POTD',
   'A new short podcast every morning, two to four minutes each. Business stories pulled from a century of wins, disasters, bad names, dumb mergers, and the occasional genius moment. Some episodes hammer a specific principle. Others just tell a great story and let you draw the lesson yourself. The format is built for a habit: listen on the drive in, pick up something useful, come back tomorrow.',
   'audio', 'flat', true, 30, true, false, false,
   jsonb_build_object(
     'from', '#68F268', 'to', '#22a322', 'text', '#1a8a1a',
     'tint', 'rgba(104, 242, 104, .14)', 'tintBadge', 'rgba(104, 242, 104, .18)',
     'hoverBg', 'rgba(104, 242, 104, .09)', 'doneText', '#fff', 'borderH', '#b6f5b6')),
  ('machine', 'The 5D Machine', '5D Machine',
   'Thirty video lessons that walk you through the Umbrella framework one floor at a time. You cut your business down to its strongest core, expand outward with services and alliances, strip the friction out of every customer touchpoint, build real emotional loyalty with the people you serve, and set up a running source of new ideas. Every lesson ends with direct work to do on your own company, so by the end you have actually changed something, not just watched a course.',
   'video', 'rich', false, 40, true, true, true,
   jsonb_build_object(
     'from', '#FFEE6E', 'to', '#d4b800', 'text', '#8a7200',
     'tint', 'rgba(255, 238, 110, .18)', 'tintBadge', 'rgba(255, 238, 110, .22)',
     'hoverBg', 'rgba(255, 238, 110, .12)', 'doneText', '#111', 'borderH', '#fff3a0'))
on conflict (slug) do nothing;

-- ── 3. content_items.type: ENUM → text + FK to courses ─────────────
-- Why: a new course must be a plain INSERT into courses. While type is the
-- content_type ENUM, adding a course needs ALTER TYPE ... ADD VALUE — DDL the
-- browser client can't run, can't run mid-transaction, and can't undo.
-- Converting to text + a FK keeps every existing `.eq('type', slug)` query
-- working unchanged while making the slug set data-driven and self-checking.

-- Convert the column only while it's still the ENUM (guarded so re-runs, where
-- it's already text and bound by the FK below, don't trip the type rebuild).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'content_items'
      and column_name = 'type' and data_type = 'USER-DEFINED'
  ) then
    alter table public.content_items alter column "type" type text using "type"::text;
  end if;
end $$;

-- FK so a content item can only carry a real course slug. on update cascade
-- lets a future slug rename propagate; on delete restrict refuses to orphan
-- content by deleting a course out from under it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_items_type_fkey'
  ) then
    alter table public.content_items
      add constraint content_items_type_fkey
      foreign key (type) references public.courses(slug)
      on update cascade on delete restrict;
  end if;
end $$;

-- The ENUM is now unused (only content_items.type referenced it). Drop it so
-- the course set lives solely in the courses table.
drop type if exists public.content_type;

-- ── 4. team_course_assignments: hardcoded allowlist → FK + flag ─────
-- The CHECK (course_slug in ('bss','eos','machine')) had to be hand-edited per
-- new assignable course. Replace it with a FK to courses + an is_assignable
-- gate in the RLS insert policy, so assignability is data and the data layer
-- stays self-defending against a forged insert.
alter table public.team_course_assignments
  drop constraint if exists team_course_assignments_course_slug_chk;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_course_assignments_course_slug_fkey'
  ) then
    alter table public.team_course_assignments
      add constraint team_course_assignments_course_slug_fkey
      foreign key (course_slug) references public.courses(slug)
      on update cascade on delete cascade;
  end if;
end $$;

-- Re-create the insert policy with the is_assignable gate (replaces the slug
-- allowlist the dropped CHECK used to enforce). A manager may only assign a
-- course the library marks assignable.
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
    -- and the course must be assignable
    and exists (
      select 1
      from public.courses c
      where c.slug = team_course_assignments.course_slug
        and c.is_assignable
    )
  );

-- ── 5. courses RLS ─────────────────────────────────────────────────
alter table public.courses enable row level security;

-- Everyone signed in reads published courses; admins also read drafts.
drop policy if exists "read published courses" on public.courses;
create policy "read published courses"
  on public.courses for select to authenticated
  using ( is_published or public.is_platform_admin() );

-- Platform admins are the only writers (mirrors content_items / machine_parts).
drop policy if exists "admins insert courses" on public.courses;
create policy "admins insert courses"
  on public.courses for insert to authenticated
  with check ( public.is_platform_admin() );

drop policy if exists "admins update courses" on public.courses;
create policy "admins update courses"
  on public.courses for update to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

drop policy if exists "admins delete courses" on public.courses;
create policy "admins delete courses"
  on public.courses for delete to authenticated
  using ( public.is_platform_admin() );
