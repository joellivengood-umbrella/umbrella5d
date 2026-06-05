-- SECURITY: close two multi-tenant RLS holes in org membership.
--
-- 1. org_members "users can insert own membership" only checked
--    (auth.uid() = user_id) — NOT org_id and NOT role. Because Postgres
--    OR's INSERT policies, any authenticated user could self-insert as a
--    MANAGER of ANY org, unlocking that org's members, profiles,
--    progress, and assignments. Cross-tenant privilege escalation.
--
-- 2. organizations "anyone can look up org by invite code" used
--    ( auth.uid() is not null ) — the invite-code match was only a query
--    filter, not an RLS boundary. Any authenticated user could read
--    EVERY org row including invite_code (enumeration + code disclosure),
--    handing them the org IDs needed for (1).
--
-- Fix: route the two legitimate self-membership flows (create an org,
-- join by invite code) through SECURITY DEFINER functions that validate
-- and write safely, then remove the over-permissive policies so the
-- client can no longer self-insert or enumerate orgs directly.
--
-- Idempotent: create-or-replace functions, drop-if-exists policies,
-- drop-then-add constraint.

-- ── 1. create_organization ─────────────────────────────────────────
-- Atomically create the org, add the caller as its first manager, and
-- point their profile at it. Replaces three unguarded client writes
-- that could leave an orphan org (no members) on partial failure.
create or replace function public.create_organization(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid   uuid := auth.uid();
  _clean text := trim(coalesce(_name, ''));
  _org_id uuid;
begin
  if _uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(_clean) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;

  insert into public.organizations (name, owner_id, plan_tier)
       values (_clean, _uid, 'organization')
    returning id into _org_id;

  insert into public.org_members (org_id, user_id, role)
       values (_org_id, _uid, 'manager');

  update public.profiles
     set org_id            = _org_id,
         organization_name = _clean,
         role_title        = 'Account Manager'
   where id = _uid;

  return _org_id;
end;
$$;

revoke execute on function public.create_organization(text) from public;
grant  execute on function public.create_organization(text) to authenticated;

-- ── 2. join_organization ───────────────────────────────────────────
-- Validate an invite code server-side and add the caller as a MEMBER
-- (idempotent if already a member). The invite-code lookup happens here
-- under definer rights, so the organizations table no longer needs a
-- world-readable SELECT policy.
create or replace function public.join_organization(_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid      uuid := auth.uid();
  _clean    text := trim(coalesce(_invite_code, ''));
  _org_id   uuid;
  _org_name text;
begin
  if _uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select id, name into _org_id, _org_name
    from public.organizations
   where invite_code = _clean;

  if _org_id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  if not exists (
    select 1 from public.org_members
     where org_id = _org_id and user_id = _uid
  ) then
    insert into public.org_members (org_id, user_id, role)
         values (_org_id, _uid, 'member');
  end if;

  update public.profiles
     set org_id            = _org_id,
         organization_name = _org_name,
         role_title        = 'Member'
   where id = _uid;

  return _org_id;
end;
$$;

revoke execute on function public.join_organization(text) from public;
grant  execute on function public.join_organization(text) to authenticated;

-- ── 3. Remove the over-permissive policies ─────────────────────────
-- Clients can no longer self-insert into org_members; the two RPCs
-- above (definer) are the only self-join paths. Managers adding other
-- people still works via "managers can add members".
drop policy if exists "users can insert own membership" on public.org_members;

-- Org rows are no longer world-readable. Members/owners still see their
-- own org via "members can view their org" / "owner can view own org";
-- invite-code lookups go through join_organization (definer).
drop policy if exists "anyone can look up org by invite code" on public.organizations;

-- ── 4. Constrain the role column ───────────────────────────────────
alter table public.org_members drop constraint if exists org_members_role_chk;
alter table public.org_members
  add constraint org_members_role_chk check (role in ('manager', 'member'));
