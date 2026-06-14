-- Org membership hardening — three fixes from the org-system security audit.
--
-- 1. SECURITY: remove the over-permissive "managers can add members" INSERT
--    policy. Its WITH CHECK was only `is_org_manager(org_id)` — it constrained
--    the org but NOT the role or user_id being written, so a manager could
--    craft a raw insert adding ANY auth.users id into their org at ANY role
--    (including 'manager'), bypassing the deliberate promote path and gaining
--    read access to that user's profile + content_progress via the manager
--    team-view policies. No app code inserts org_members directly — members
--    self-join via the join_organization RPC (security definer) — so this
--    policy is unused. A future "manager adds a member" feature should be a
--    consent-checked SECURITY DEFINER RPC, not an open INSERT policy.
--
-- 2. SCALE: add an index on org_members(user_id). The profiles SELECT policy
--    runs is_managed_team_member() per candidate row — a self-join on
--    org_members filtered by user_id — and only the composite
--    (org_id, user_id) unique index existed, so that lookup was unindexed.
--
-- 3. RELIABILITY: close the last-manager removal race. The guard counted
--    remaining managers with no lock, so under READ COMMITTED two managers
--    removing each other concurrently could both pass the count and leave the
--    org with zero managers (bricked). Serialize removals per org with an
--    advisory lock.
--
-- Idempotent: drop policy if exists; create index if not exists; create or
-- replace function (the existing trigger keeps pointing at it).

-- ── 1. Remove the manager-injects-anyone INSERT policy ─────────────
drop policy if exists "managers can add members" on public.org_members;

-- ── 2. Index the user_id self-join column ──────────────────────────
create index if not exists org_members_user_id_idx
  on public.org_members (user_id);

-- ── 3. Make the last-manager guard race-safe ───────────────────────
create or replace function public.prevent_last_manager_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_managers integer;
begin
  -- Member removal is always fine — the org still has managers.
  if old.role <> 'manager' then
    return old;
  end if;

  -- Serialize concurrent manager removals within the same org so two
  -- managers removing each other can't both pass the count below and zero
  -- out the org's managers. Two-key form namespaces the lock ('org_mgr',
  -- org) so it can't collide with any other advisory-lock use.
  -- Transaction-scoped: released at commit/rollback.
  perform pg_advisory_xact_lock(hashtext('org_mgr'), hashtext(old.org_id::text));

  -- Count managers in the org excluding the row being removed. If removing
  -- this manager would leave zero, reject.
  select count(*)
    into remaining_managers
    from public.org_members
   where org_id = old.org_id
     and role   = 'manager'
     and id    <> old.id;

  if remaining_managers = 0 then
    raise exception
      'Cannot remove the last manager of an organization. Promote another member first.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;
