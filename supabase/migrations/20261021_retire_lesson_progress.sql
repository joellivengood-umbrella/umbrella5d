-- Retire the legacy lesson_progress table
--
-- lesson_progress predates content_progress (20260418_content_progress.sql),
-- which replaced it; only the retired /prototype HTML pages ever read or
-- wrote it. 20261021_reconcile_prod_schema.sql recorded it only so the repo
-- matched production. On 2026-10-21 it held 3 rows for 1 member, all written
-- within 20 seconds on 2026-04-19 (prototype testing), and the owner
-- approved removing it.
--
-- Nothing else references it (no foreign keys, views or functions);
-- dropping the table also drops its 4 policies, 2 indexes and identity
-- sequence. No CASCADE on purpose: if anything unexpected did depend on it,
-- this fails loudly instead of silently dropping that too.
--
-- Sorts after 20261021_reconcile_prod_schema.sql, so a rebuilt database
-- creates then retires it and ends up matching production.
--
-- Idempotent: safe to re-run.

drop table if exists public.lesson_progress;
