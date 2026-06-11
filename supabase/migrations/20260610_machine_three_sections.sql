-- 5D Machine — three fixed lesson sections
--
-- Every machine lesson now has three sections, in this order:
--   prerequisites  ("Essential Prerequisites" — read-and-watch)
--   objectives     ("Objectives"              — read-and-watch)
--   instructions   ("Instructions"            — the interactive to-do
--                                               questions with answer boxes)
--
-- Existing data is remapped per the agreed default: content →
-- prerequisites, activity → instructions, objectives starts empty.
-- Section display titles default to the canonical names above and are
-- editable per lesson via content_items.section_titles (jsonb holding
-- only the overridden names, e.g. {"objectives":"Goals"}).
--
-- Idempotent: drop-then-create constraints; the remap updates are
-- no-ops on re-run; add column if not exists; delete by fixed id.

-- ── 1. Remap legacy sections, then tighten the section rule ────────
alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_section_chk;

update public.lesson_blocks set section = 'prerequisites' where section = 'content';
update public.lesson_blocks set section = 'instructions'  where section = 'activity';

alter table public.lesson_blocks
  alter column section set default 'prerequisites';

alter table public.lesson_blocks
  add constraint lesson_blocks_section_chk
  check (section in ('prerequisites', 'objectives', 'instructions'));

-- ── 2. Questions (answer boxes) live only in Instructions ──────────
alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_question_section_chk;

-- Defensive: any stray question outside instructions moves there.
update public.lesson_blocks
   set section = 'instructions'
 where block_type = 'question' and section <> 'instructions';

alter table public.lesson_blocks
  add constraint lesson_blocks_question_section_chk
  check (block_type <> 'question' or section = 'instructions');

-- ── 3. Checkpoints: questions, or headings in the read sections ────
-- A checkpoint heading inside instructions would inflate the lesson's
-- completion total with no checkbox to tick (the learner view renders
-- instructions headings as plain titles), so forbid it.
alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_checkpoint_chk;

update public.lesson_blocks
   set is_checkpoint = false
 where is_checkpoint
   and block_type = 'heading'
   and section = 'instructions';

alter table public.lesson_blocks
  add constraint lesson_blocks_checkpoint_chk
  check (
    is_checkpoint = false
    or block_type = 'question'
    or (block_type = 'heading' and section in ('prerequisites', 'objectives'))
  );

-- Tidy any ghost checkmarks left on blocks that are no longer
-- checkpoints (checks are only ever created on checkpoints, so this is
-- belt-and-suspenders; harmless and idempotent).
delete from public.lesson_block_checks c
 using public.lesson_blocks b
 where c.block_id = b.id
   and not b.is_checkpoint;

-- ── 4. Per-lesson editable section titles ──────────────────────────
alter table public.content_items
  add column if not exists section_titles jsonb;

-- Sanity: the column holds a json object (or null), never an array or
-- scalar, so readers can safely index it by section name.
alter table public.content_items
  drop constraint if exists content_items_section_titles_chk;
alter table public.content_items
  add constraint content_items_section_titles_chk
  check (section_titles is null or jsonb_typeof(section_titles) = 'object');

-- ── 5. Drop the seed's "5D-One Instructions" title heading ─────────
-- The Instructions section now renders its own title, so the seeded
-- heading block is redundant. No-op if already gone.
delete from public.lesson_blocks
 where id = 'ddddffff-0000-0000-0000-000000000301';
