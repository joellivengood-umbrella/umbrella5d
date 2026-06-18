-- Audit fix (scale): per-course content counts in the DB, not in JS
--
-- fetchTotalsByType streamed every published content_item row to the server
-- and counted them in a JS loop, and the admin home did the same over ALL
-- content_items (published + draft) — both grow without bound as the catalog
-- (especially POTD) grows, on hot pages. This RPC returns one row per course
-- with the published + draft counts, so callers fetch O(courses) numbers
-- instead of O(items) rows.
--
-- SECURITY DEFINER so the counts are consistent for everyone (and so the
-- aggregate isn't reshaped by the per-row content RLS); it returns only
-- aggregate counts — never any content row. published_count is shown to all
-- (it's published content); draft_count is gated to platform admins so a
-- normal user can't learn how many unreleased items a course has.
-- Idempotent: create-or-replace.

create or replace function public.content_counts_by_course()
returns table (
  course_slug     text,
  published_count int,
  draft_count     int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ci.type as course_slug,
    (count(*) filter (where ci.is_published))::int as published_count,
    case
      when public.is_platform_admin()
        then (count(*) filter (where not ci.is_published))::int
      else 0
    end as draft_count
  from public.content_items ci
  group by ci.type;
$$;

revoke execute on function public.content_counts_by_course() from public;
grant  execute on function public.content_counts_by_course() to authenticated;
