-- Extend handle_org_member_removed to also clean up content_assignments
-- for the removed member in that org.
--
-- The original trigger (20260428_member_actions.sql) only cleared the
-- removed user's profile. content_assignments rows for that
-- (org_id, user_id) pair persisted, so if the user later re-joined the
-- same org via invite code, their old assignments would silently
-- reappear on their dashboard.
--
-- This migration updates the function body to also DELETE from
-- content_assignments scoped to (old.org_id, old.user_id). The trigger
-- itself (on_org_member_removed) doesn't need to be touched — it
-- already points at this function.
--
-- Idempotent: create or replace function always succeeds.

create or replace function public.handle_org_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reset the user's profile to a "no org" state if the removed org
  -- was their primary one. Multi-org users (rare in practice) keep
  -- their other affiliations intact via the org_id match guard.
  update public.profiles
     set org_id            = null,
         organization_name = null,
         role_title        = null
   where id     = old.user_id
     and org_id = old.org_id;

  -- Drop any assignments this user had in this org. content_assignments
  -- rows are scoped per (org_id, user_id), so removing them here is
  -- independent of whether the user remains in any other orgs.
  -- Without this, re-joining the same org would silently re-surface
  -- stale assignments from the previous tenure.
  delete from public.content_assignments
   where org_id  = old.org_id
     and user_id = old.user_id;

  return old;
end;
$$;
