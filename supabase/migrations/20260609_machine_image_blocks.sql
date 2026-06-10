-- 5D Machine — image blocks + a Storage bucket for lesson media
--
-- Adds 'image' as a lesson block type and provisions a public Storage
-- bucket ('lesson-media') for course images/audio/video, mirroring the
-- existing public 'avatars' bucket. The Phase 3 editor uploads files
-- here (same flow as the Settings avatar upload) and stores the public
-- URL in lesson_blocks.data.url.
--
-- Idempotent: drop-then-recreate the check constraint and policies;
-- on-conflict upsert on the bucket.

-- ── 1. Allow 'image' as a block type ───────────────────────────────
alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_block_type_chk;
alter table public.lesson_blocks
  add constraint lesson_blocks_block_type_chk
  check (block_type in ('heading', 'rich_text', 'audio', 'video', 'image', 'question'));

-- ── 2. Public bucket for lesson media ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('lesson-media', 'lesson-media', true)
on conflict (id) do update set public = true;

-- ── 3. Storage RLS on the lesson-media bucket ──────────────────────
-- Read is public (course media is shown to every learner). Writes are
-- platform-admin only. All policies are scoped by bucket_id so the
-- existing 'avatars' policies are unaffected.
--
-- NOTE: if your project restricts creating policies on storage.objects
-- via SQL, set the same four rules in the Supabase dashboard
-- (Storage → Policies on the lesson-media bucket) instead.

drop policy if exists "lesson media public read" on storage.objects;
create policy "lesson media public read"
  on storage.objects
  for select
  using ( bucket_id = 'lesson-media' );

drop policy if exists "lesson media admin insert" on storage.objects;
create policy "lesson media admin insert"
  on storage.objects
  for insert
  to authenticated
  with check ( bucket_id = 'lesson-media' and public.is_platform_admin() );

drop policy if exists "lesson media admin update" on storage.objects;
create policy "lesson media admin update"
  on storage.objects
  for update
  to authenticated
  using ( bucket_id = 'lesson-media' and public.is_platform_admin() )
  with check ( bucket_id = 'lesson-media' and public.is_platform_admin() );

drop policy if exists "lesson media admin delete" on storage.objects;
create policy "lesson media admin delete"
  on storage.objects
  for delete
  to authenticated
  using ( bucket_id = 'lesson-media' and public.is_platform_admin() );
