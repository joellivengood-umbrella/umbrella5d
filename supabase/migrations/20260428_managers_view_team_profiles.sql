-- Let org managers read the profiles of their team members.
--
-- Without this, the planned /team page (manager roster) couldn't show
-- member names or avatars: the existing profiles RLS only lets a user
-- read their own row ((auth.uid() = id)), so a JOIN through org_members
-- would silently null out every column except the manager's own.
--
-- Read-only by design — managers cannot UPDATE or DELETE other members'
-- profiles. Editing remains owner-only via the existing
-- "Users can update own profile" policy.
--
-- Idempotent: defensive function-create + drop-then-create on the policy.

-- ── 1. Helper function ─────────────────────────────────────────────
-- True when the calling user manages at least one org that the target
-- user is a member of. SECURITY DEFINER so the inner queries against
-- org_members aren't subject to the caller's own RLS — keeps this
-- self-contained and cheap.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_managed_team_member'
  ) then
    execute $f$
      create function public.is_managed_team_member(_user_id uuid)
      returns boolean language sql stable security definer set search_path = public
      as 'select exists (
        select 1
          from public.org_members om_self
          join public.org_members om_target
            on om_target.org_id = om_self.org_id
         where om_self.user_id = auth.uid()
           and om_self.role    = ''manager''
           and om_target.user_id = _user_id
      )'
    $f$;
    execute 'grant execute on function public.is_managed_team_member(uuid) to authenticated';
  end if;
end $$;

-- ── 2. SELECT policy on profiles ───────────────────────────────────
drop policy if exists "managers can view team profiles" on public.profiles;
create policy "managers can view team profiles"
  on public.profiles
  for select
  to authenticated
  using ( public.is_managed_team_member(id) );
