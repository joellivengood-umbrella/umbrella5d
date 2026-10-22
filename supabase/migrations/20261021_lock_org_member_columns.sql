-- Security: managers may only change a member's ROLE (column grants)
--
-- The "managers can promote members" policy lets an organization's manager
-- UPDATE a member row in an org they manage (USING role = 'member', WITH
-- CHECK role = 'manager'), but it doesn't limit which columns change — and
-- Supabase's default table-level grant let authenticated write every column
-- (id, org_id, user_id, role, created_at). So a manager could rewrite a
-- member row's user_id to ANY account id, pulling that person into their
-- organization as a manager (and then see their profile and progress), move
-- the row to another org they manage, or back-/forward-date created_at (which
-- the admin analytics treat as the "joined the partner" moment).
--
-- The app writes this table directly in one place only:
--   role   src/app/(app)/organization/MemberActions.tsx (promote)
-- Removing a member is a DELETE (grant unchanged); joining and creating
-- organizations go through SECURITY DEFINER functions (unaffected).
-- Same pattern as 20261021_lock_privileged_columns.sql: a column-level REVOKE
-- does nothing under a table grant, so grant the allowed column instead.
--
-- Idempotent: safe to re-run.

revoke insert, update on public.org_members from anon, authenticated;
grant update (role) on public.org_members to authenticated;
