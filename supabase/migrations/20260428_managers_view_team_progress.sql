-- Let org managers read team members' content_progress rows.
--
-- Without this, the planned Team Progress section on /team can't
-- compute per-member completion: the existing content_progress RLS
-- only allows users to read their own rows
-- ("content_progress_select_own" using auth.uid() = user_id).
--
-- Reuses the public.is_managed_team_member(uuid) helper added in
-- 20260428_managers_view_team_profiles.sql — same shape, just applied
-- to a different table.
--
-- Read-only by design — managers cannot insert or delete their team
-- members' progress rows. Tracking remains owner-only via the
-- existing insert/delete policies.

drop policy if exists "managers can view team progress" on public.content_progress;
create policy "managers can view team progress"
  on public.content_progress
  for select
  to authenticated
  using ( public.is_managed_team_member(user_id) );
