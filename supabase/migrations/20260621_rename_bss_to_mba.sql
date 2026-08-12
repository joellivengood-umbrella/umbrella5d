-- Title: Rename the "BSS" course to "MBA Seminars" (slug bss -> mba)
--
-- Business Success Seminars -> MBA Seminars, and the course code/slug bss -> mba.
--
-- The slug is the courses table primary key. content_items.type and
-- team_course_assignments.course_slug both FK it with ON UPDATE CASCADE
-- (20260618_courses_foundation), and that same migration dropped the old
-- CHECK allowlist and the content_type ENUM — so a single slug update
-- propagates to every content item and assignment with no orphans and no
-- blocking constraint. The slug-format CHECK (^[a-z0-9][a-z0-9-]*$) accepts
-- 'mba'. Nothing else stores the slug (content_progress is keyed by
-- content_item id, and no function hardcodes 'bss').
--
-- Deploy order: run this, then ship the code that expects slug 'mba'
-- (routes move from /courses/bss/... to /courses/mba/...).
--
-- Idempotent: no-op once the row is already 'mba'.

update public.courses
   set slug        = 'mba',
       title       = 'MBA Seminars',
       short_title = 'MBA'
 where slug = 'bss';
