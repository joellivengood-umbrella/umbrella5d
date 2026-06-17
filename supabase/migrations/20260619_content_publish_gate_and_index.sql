-- Audit fixes: gate content visibility on the parent course + index the FK
--
-- Two issues from the dynamic-courses audit:
--
--   1. SECURITY — content_items' public read policy only checked the item's
--      own is_published, never the parent course's. A course staged as a
--      DRAFT (courses.is_published = false) whose individual lessons were
--      published was fully readable by any authenticated user who knew the
--      slug — titles, descriptions, and media_url — via a direct PostgREST
--      query. The page routes 404 (the courses row is RLS-hidden), but RLS,
--      not the page, is the security boundary. Tighten the public read so a
--      lesson is visible only when ITS COURSE is also published. Platform
--      admins keep full read via content_items_admin_select (20260608), which
--      is OR'd alongside this policy, so the admin panel still sees drafts.
--
--   2. PERFORMANCE — when content_items.type moved off the enum to text + a
--      FK to courses(slug) (20260618), no index was added. Every per-course
--      query (.eq('type', slug)) is a sequential scan and the FK's ON UPDATE
--      CASCADE check is unindexed. Add a covering composite index.
--
-- Idempotent: drop-then-create policy; create index if not exists.

-- ── 1. course-aware public read ────────────────────────────────────
-- A non-admin sees a content_item only when the item is published AND its
-- course is published. The courses sub-select also runs under courses' RLS
-- ("read published courses"), so a draft course is doubly hidden from
-- non-admins; the explicit c.is_published keeps the intent clear.
drop policy if exists "Authenticated users can read published content" on public.content_items;
create policy "Authenticated users can read published content"
  on public.content_items
  for select
  to authenticated
  using (
    is_published = true
    and exists (
      select 1
      from public.courses c
      where c.slug = content_items.type
        and c.is_published
    )
  );

-- ── 2. index content_items.type (the FK + every per-course query) ──
-- Covers the hot path .eq('type', slug).eq('is_published', true)
-- .order('sequence_num'); its leading column also indexes the FK column so
-- cascades and per-course lookups stop seq-scanning.
create index if not exists content_items_type_pub_seq_idx
  on public.content_items (type, is_published, sequence_num);
