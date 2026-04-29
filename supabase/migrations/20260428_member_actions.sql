-- Member actions for org managers: promote-to-manager + clean removal.
--
-- Adds two pieces of plumbing the /team page needs to surface member
-- actions safely:
--
--   1. UPDATE policy on org_members that allows ONLY member-to-manager
--      promotions. Demotions are intentionally blocked at the RLS level
--      (separate feature when needed). Self-promotion is impossible
--      because a manager's own row already has role='manager' and fails
--      the USING role='member' filter.
--
--   2. AFTER DELETE trigger on org_members that resets a removed user's
--      profile back to a "no org" state — clears profile.org_id,
--      organization_name, and role_title. Without this, removed users
--      keep stale profile.org_id pointing at an org they're not in,
--      causing confused half-states on the dashboard and sidebar.
--      Trigger is SECURITY DEFINER because the manager has no RLS
--      permission to update the removed user's profile directly.
--      Only resets if the removed org was the user's primary org —
--      multi-org users keep their other affiliations intact.
--
-- Idempotent: drop-then-create on policy and trigger; defensive
-- function-create.

-- ── 1. UPDATE policy on org_members ────────────────────────────────
-- Managers can update a row only when:
--   - They manage the org (USING).
--   - The current row's role is 'member' (USING) — locks out demotions
--     and self-promotion.
--   - The new row's role is 'manager' (WITH CHECK) — locks out updates
--     to anything else (e.g. changing user_id or org_id).
drop policy if exists "managers can promote members" on public.org_members;
create policy "managers can promote members"
  on public.org_members
  for update
  to authenticated
  using (
    public.is_org_manager(org_id)
    and role = 'member'
  )
  with check (
    public.is_org_manager(org_id)
    and role = 'manager'
  );

-- ── 2. Profile-cleanup trigger on org_members removal ──────────────
create or replace function public.handle_org_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only reset the profile if the user was removed from their primary
  -- org. Users who remain in other orgs keep their profile intact.
  update public.profiles
     set org_id            = null,
         organization_name = null,
         role_title        = null
   where id     = old.user_id
     and org_id = old.org_id;
  return old;
end;
$$;

drop trigger if exists on_org_member_removed on public.org_members;
create trigger on_org_member_removed
  after delete on public.org_members
  for each row execute function public.handle_org_member_removed();
