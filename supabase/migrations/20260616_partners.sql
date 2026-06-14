-- Partner accounts (foundation)
--
-- Adds the PARTNER level that sits above organizations: Umbrella → Partners
-- → Organizations → Members. A partner "owns" organizations. Partners are
-- created manually by an admin (no client signup); a partner hands its
-- invite_code to org reps, who redeem it to create an Org Manager account
-- whose new org is owned by the partner. Orgs without a partner work exactly
-- as before (partner_id is nullable).
--
-- This migration: the partners table + org link + RLS + the invite-linking
-- RPCs. The partner UI ships separately.
--
-- Idempotent: create-if-not-exists, drop-then-create policies, drop+recreate
-- the create_organization function (its signature changes), create-or-replace
-- the rest.

-- ── 1. partners table ──────────────────────────────────────────────
create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users(id) on delete set null,
  -- 128-bit code (full UUID hex, no '-'). Stronger than org codes on
  -- purpose: redeeming a partner code mints an Org Manager, so it must not
  -- be guessable. No pgcrypto dependency.
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  avatar_url  text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint partners_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists partners_owner_id_idx on public.partners (owner_id);

-- Keep updated_at fresh (shared trigger fn from 20260608).
drop trigger if exists set_partners_updated_at on public.partners;
create trigger set_partners_updated_at
  before update on public.partners
  for each row execute function public.tg_set_updated_at();

alter table public.partners enable row level security;

-- RLS: the owner reads + edits their own partner; a platform admin reads
-- all (for the future admin UI). No client INSERT/DELETE — partners are
-- created by an admin via the promote script (service role). A future
-- "manager adds a member"-style flow should be a definer RPC.
drop policy if exists "owner reads own partner" on public.partners;
create policy "owner reads own partner"
  on public.partners for select to authenticated
  using ( owner_id = auth.uid() or public.is_platform_admin() );

drop policy if exists "owner updates own partner" on public.partners;
create policy "owner updates own partner"
  on public.partners for update to authenticated
  using ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

-- The owner may edit name/avatar/description, but NOT the code or ownership
-- (admin-controlled) — column-level lock, same pattern as profiles.is_platform_admin.
revoke update (invite_code, owner_id) on public.partners from authenticated;

-- ── 2. organizations.partner_id ("owned by") ───────────────────────
alter table public.organizations
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists organizations_partner_id_idx
  on public.organizations (partner_id);

-- Harden org creation to the RPC only. The old "authenticated users can
-- create orgs" INSERT policy (with check owner_id = auth.uid()) is unused —
-- the app creates orgs solely via create_organization (definer) — and with
-- the new partner_id column it would let a client insert an org claiming ANY
-- partner. Drop it; orgs are now created only through the RPC.
drop policy if exists "authenticated users can create orgs" on public.organizations;

-- Belt-and-braces: partner_id is set only by create_organization (definer),
-- so a manager can't re-point their org to a partner they don't belong to.
revoke update (partner_id) on public.organizations from authenticated;

-- ── 3. lookup_invite_code — classify a typed code for onboarding ────
-- Tells the client whether a code is an org code, a partner code, or
-- invalid (without exposing the codes themselves). Definer so it can read
-- both code columns. The org/partner NAME is intentionally returned to any
-- holder of a valid code — the code IS the secret, same trust model as
-- join_organization.
create or replace function public.lookup_invite_code(_code text)
returns table (kind text, label text)
language sql
stable
security definer
set search_path = public
as $$
  select 'org'::text as kind, o.name as label
    from public.organizations o
   where o.invite_code = nullif(btrim(coalesce(_code, '')), '')
  union all
  select 'partner'::text, p.name
    from public.partners p
   where p.invite_code = nullif(btrim(coalesce(_code, '')), '')
  limit 1;
$$;

revoke execute on function public.lookup_invite_code(text) from public;
grant  execute on function public.lookup_invite_code(text) to authenticated;

-- ── 4. create_organization — accept an optional partner code ───────
-- Signature changes (adds _partner_code), so drop the old 1-arg version
-- first to avoid an ambiguous overload. The onboarding call with just
-- { _name } resolves to this (the partner code defaults to null).
drop function if exists public.create_organization(text);

create or replace function public.create_organization(
  _name text,
  _partner_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid        uuid := auth.uid();
  _clean      text := trim(coalesce(_name, ''));
  _pcode      text := nullif(btrim(coalesce(_partner_code, '')), '');
  _partner_id uuid;
  _org_id     uuid;
begin
  if _uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(_clean) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;

  -- If a partner code was supplied it must resolve to a real partner; the
  -- new org is then owned by that partner.
  if _pcode is not null then
    select id into _partner_id from public.partners where invite_code = _pcode;
    if _partner_id is null then
      raise exception 'INVALID_PARTNER_CODE';
    end if;
  end if;

  insert into public.organizations (name, owner_id, plan_tier, partner_id)
       values (_clean, _uid, 'organization', _partner_id)
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

revoke execute on function public.create_organization(text, text) from public;
grant  execute on function public.create_organization(text, text) to authenticated;
