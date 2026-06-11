-- 5D Machine — interactive course structure
--
-- Adds the data model for the rich, multi-part 5D Machine course. The
-- other courses (BSS, EOS, Daily Pod) are untouched: they keep using
-- content_items.description + media_url. Only "machine" lessons opt into
-- the richer model below.
--
--   machine_parts        the "Parts" that group lessons (Part One, Part Two…)
--   content_items.part_id+ link a machine lesson to its Part and order within it
--     part_sort_index     (so a lesson's address is Part.Lesson, e.g. 1.2)
--   lesson_blocks        the ordered body of a lesson: headings, rich text,
--                        audio/video, and activity question prompts
--   lesson_block_checks  per-user manual checkmarks on checkpoint blocks
--                        (the to-do list — owner-private)
--   activity_answers     per-user free-text answers to activity questions
--
-- Visibility of answers: owner, the learner's manager (reusing the
-- existing is_managed_team_member helper that already governs manager
-- access to team progress), or a platform admin. This whole rule lives
-- in ONE policy ("activity_answers_select") so it can be tightened to
-- owner-only later by editing that single policy.
--
-- Idempotent: create-if-not-exists tables/columns, drop-then-create
-- policies, create-or-replace helpers.

-- ── 1. Helper functions ────────────────────────────────────────────

-- True when the given lesson (a content_items row) is published.
-- SECURITY DEFINER so it can be used inside another table's RLS without
-- being subject to the caller's own content_items RLS. Returns only a
-- boolean publish flag (never row data); the grant to authenticated is
-- required for the function to be callable from a policy USING clause,
-- mirroring is_platform_admin() / is_managed_team_member().
create or replace function public.is_lesson_published(_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_published from public.content_items where id = _lesson_id),
    false
  );
$$;

grant execute on function public.is_lesson_published(uuid) to authenticated;

-- Shared updated_at trigger. search_path is pinned (SECURITY DEFINER
-- hardening, matching baseline's handle_new_user) so now() always
-- resolves to the built-in regardless of the caller's search_path.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 2. machine_parts ───────────────────────────────────────────────

create table if not exists public.machine_parts (
  id           uuid primary key default gen_random_uuid(),
  sort_index   integer not null,
  title        text not null,
  subtitle     text,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists machine_parts_sort_idx
  on public.machine_parts (sort_index);

alter table public.machine_parts enable row level security;

-- Learners see published parts; admins also see drafts (for preview).
drop policy if exists "machine_parts_select" on public.machine_parts;
create policy "machine_parts_select"
  on public.machine_parts
  for select
  to authenticated
  using ( is_published = true or public.is_platform_admin() );

drop policy if exists "machine_parts_admin_insert" on public.machine_parts;
create policy "machine_parts_admin_insert"
  on public.machine_parts
  for insert
  to authenticated
  with check ( public.is_platform_admin() );

drop policy if exists "machine_parts_admin_update" on public.machine_parts;
create policy "machine_parts_admin_update"
  on public.machine_parts
  for update
  to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

drop policy if exists "machine_parts_admin_delete" on public.machine_parts;
create policy "machine_parts_admin_delete"
  on public.machine_parts
  for delete
  to authenticated
  using ( public.is_platform_admin() );

drop trigger if exists machine_parts_set_updated_at on public.machine_parts;
create trigger machine_parts_set_updated_at
  before update on public.machine_parts
  for each row execute function public.tg_set_updated_at();

-- ── 3. content_items: link a machine lesson to its Part ─────────────
--
-- machine_parts + lesson_blocks are GLOBAL program content, shared by
-- every organization (the 5D Machine is the same course for everyone);
-- they are not org-owned. A lesson's address is Part.Lesson, where:
--   * the Part number comes from machine_parts.sort_index,
--   * the Lesson number comes from content_items.part_sort_index.
-- content_items.sequence_num remains the GLOBAL machine order and the
-- existing /courses/machine/[sequence_num] route key. part_sort_index is
-- the Part-local display order; the two are maintained independently.

alter table public.content_items
  add column if not exists part_id uuid references public.machine_parts(id) on delete set null,
  add column if not exists part_sort_index integer;

create index if not exists content_items_part_id_idx
  on public.content_items (part_id);

-- Let platform admins read unpublished content too, so the rich 5D
-- Machine experience can be previewed before it is published. Non-admins
-- are unaffected — the existing published-only read policy still applies
-- to them, and this admin policy is simply OR'd alongside it.
drop policy if exists "content_items_admin_select" on public.content_items;
create policy "content_items_admin_select"
  on public.content_items
  for select
  to authenticated
  using ( public.is_platform_admin() );

-- ── 4. lesson_blocks ───────────────────────────────────────────────
--
-- The ordered body of a lesson. Within a (lesson_id, section), blocks
-- render by sort_index ascending (ties broken by id for determinism).
--
-- Numbering is derived by ORDINAL POSITION, not by sort_index value, so
-- gaps left by deletions are harmless: the Nth checkpoint heading in the
-- content section is section N (e.g. 1.1.N), and the Nth question block
-- in the activity section is 5D 1.1.N.
--
-- A "checkpoint" is a manually-checkable to-do item. Only content-section
-- headings and question items are checkpoints (enforced by the check
-- constraint below); plain headings (like an activity title), rich text,
-- and media are never checkpoints. Checking is purely manual and is NOT
-- gated on whether a question's answer boxes are filled.

create table if not exists public.lesson_blocks (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.content_items(id) on delete cascade,
  section       text not null default 'content',
  sort_index    integer not null,
  block_type    text not null,
  data          jsonb not null default '{}'::jsonb,
  is_checkpoint boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Accepts both the original two section names and the three named
  -- sections introduced later; 20260610_machine_three_sections.sql
  -- remaps legacy rows and tightens this to the three names only.
  constraint lesson_blocks_section_chk
    check (section in ('content', 'activity', 'prerequisites', 'objectives', 'instructions')),
  constraint lesson_blocks_block_type_chk
    check (block_type in ('heading', 'rich_text', 'audio', 'video', 'question')),
  -- Only headings and question items can be checkpoints.
  constraint lesson_blocks_checkpoint_chk
    check (is_checkpoint = false or block_type in ('heading', 'question'))
);

create index if not exists lesson_blocks_lesson_idx
  on public.lesson_blocks (lesson_id, section, sort_index);

-- Speeds "how many checkpoints does this lesson have" (completion math).
create index if not exists lesson_blocks_checkpoint_idx
  on public.lesson_blocks (lesson_id, section)
  where is_checkpoint = true;

alter table public.lesson_blocks enable row level security;

-- Learners read blocks of published lessons; admins read all (preview +
-- authoring). is_lesson_published is SECURITY DEFINER so this does not
-- leak unpublished lessons through the subquery.
drop policy if exists "lesson_blocks_select" on public.lesson_blocks;
create policy "lesson_blocks_select"
  on public.lesson_blocks
  for select
  to authenticated
  using ( public.is_platform_admin() or public.is_lesson_published(lesson_id) );

drop policy if exists "lesson_blocks_admin_insert" on public.lesson_blocks;
create policy "lesson_blocks_admin_insert"
  on public.lesson_blocks
  for insert
  to authenticated
  with check ( public.is_platform_admin() );

drop policy if exists "lesson_blocks_admin_update" on public.lesson_blocks;
create policy "lesson_blocks_admin_update"
  on public.lesson_blocks
  for update
  to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

drop policy if exists "lesson_blocks_admin_delete" on public.lesson_blocks;
create policy "lesson_blocks_admin_delete"
  on public.lesson_blocks
  for delete
  to authenticated
  using ( public.is_platform_admin() );

drop trigger if exists lesson_blocks_set_updated_at on public.lesson_blocks;
create trigger lesson_blocks_set_updated_at
  before update on public.lesson_blocks
  for each row execute function public.tg_set_updated_at();

-- ── 5. lesson_block_checks (the to-do list) ────────────────────────
-- Row exists = the user has checked that block off. Owner-private,
-- mirroring content_progress.

create table if not exists public.lesson_block_checks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id)          on delete cascade,
  block_id   uuid not null references public.lesson_blocks(id) on delete cascade,
  checked_at timestamptz not null default now(),
  constraint lesson_block_checks_user_block_key unique (user_id, block_id)
);

create index if not exists lesson_block_checks_user_idx
  on public.lesson_block_checks (user_id);
create index if not exists lesson_block_checks_block_idx
  on public.lesson_block_checks (block_id);

alter table public.lesson_block_checks enable row level security;

drop policy if exists "lesson_block_checks_select_own" on public.lesson_block_checks;
create policy "lesson_block_checks_select_own"
  on public.lesson_block_checks
  for select
  to authenticated
  using ( auth.uid() = user_id );

drop policy if exists "lesson_block_checks_insert_own" on public.lesson_block_checks;
create policy "lesson_block_checks_insert_own"
  on public.lesson_block_checks
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

drop policy if exists "lesson_block_checks_delete_own" on public.lesson_block_checks;
create policy "lesson_block_checks_delete_own"
  on public.lesson_block_checks
  for delete
  to authenticated
  using ( auth.uid() = user_id );

-- Managers may READ their team members' checkmarks (for the team
-- progress view), mirroring the manager-read policy on content_progress.
-- Writes stay owner-only. There is intentionally NO update policy: a
-- checkmark is toggled by insert/delete, never updated.
drop policy if exists "lesson_block_checks_manager_select" on public.lesson_block_checks;
create policy "lesson_block_checks_manager_select"
  on public.lesson_block_checks
  for select
  to authenticated
  using ( public.is_managed_team_member(user_id) );

-- ── 6. activity_answers ────────────────────────────────────────────
-- One row per (user, question block, prompt index). A question block can
-- hold several prompts (several answer boxes), hence prompt_index.

create table if not exists public.activity_answers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id)          on delete cascade,
  block_id     uuid not null references public.lesson_blocks(id) on delete cascade,
  prompt_index integer not null default 0,
  answer_text  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint activity_answers_user_block_prompt_key unique (user_id, block_id, prompt_index)
);

create index if not exists activity_answers_user_idx
  on public.activity_answers (user_id);
create index if not exists activity_answers_block_idx
  on public.activity_answers (block_id);

alter table public.activity_answers enable row level security;

-- VISIBILITY RULE (single policy). Owner, the learner's manager, or a
-- platform admin may read an answer. is_managed_team_member(user_id)
-- scopes the manager branch to "users this manager actually manages" --
-- the SAME helper and model that already governs manager access to
-- content_progress. Course content is global (not org-owned), so an
-- answer is the learner's, surfaced to whoever manages that learner;
-- there is no cross-org content boundary to enforce here.
-- To make answers owner-only later, reduce this one policy to:
--   using ( auth.uid() = user_id ).
drop policy if exists "activity_answers_select" on public.activity_answers;
create policy "activity_answers_select"
  on public.activity_answers
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_managed_team_member(user_id)
    or public.is_platform_admin()
  );

-- Writes are always owner-only — managers and admins can read answers
-- but never create, edit, or delete them.
drop policy if exists "activity_answers_insert_own" on public.activity_answers;
create policy "activity_answers_insert_own"
  on public.activity_answers
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

drop policy if exists "activity_answers_update_own" on public.activity_answers;
create policy "activity_answers_update_own"
  on public.activity_answers
  for update
  to authenticated
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

drop policy if exists "activity_answers_delete_own" on public.activity_answers;
create policy "activity_answers_delete_own"
  on public.activity_answers
  for delete
  to authenticated
  using ( auth.uid() = user_id );

drop trigger if exists activity_answers_set_updated_at on public.activity_answers;
create trigger activity_answers_set_updated_at
  before update on public.activity_answers
  for each row execute function public.tg_set_updated_at();
