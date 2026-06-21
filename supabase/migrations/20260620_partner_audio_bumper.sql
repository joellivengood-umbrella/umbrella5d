-- Title: Partner audio bumper — column, admin setter RPC, expose to members
--
-- The "Brought to you by [Partner]" imprimatur. A partner can have one short
-- audio bumper that plays as a pre-roll before content audio for every member
-- under that partner (5D Machine is excluded in the app, not here). The bumper
-- file is uploaded to the public 'lesson-media' bucket by an admin; this
-- migration stores the URL and wires up who can write/read it.
--
-- Write path: admins only. The partners UPDATE policy is owner-scoped
-- (20260616), and we deliberately do NOT let a partner owner set their own
-- bumper — it's an admin-controlled mark. So bumper_url is column-locked away
-- from `authenticated` (like invite_code/owner_id) and written solely through
-- the set_partner_bumper definer RPC, gated on is_platform_admin().
--
-- Read path: members can't SELECT partners directly, so the existing
-- get_my_partner_branding definer RPC is extended to return bumper_url too
-- (a public storage URL — not sensitive). Managers get it via the same
-- profiles.org_id -> organizations.partner_id chain.
--
-- Idempotent: add-column-if-not-exists, create-or-replace RPCs (drop the
-- branding fn first since its return shape changes).

-- ── 1. bumper_url column ───────────────────────────────────────────
alter table public.partners
  add column if not exists bumper_url text;

-- Lock the column from direct client writes; the admin RPC (definer) is the
-- only write path. Same pattern as invite_code / owner_id.
revoke update (bumper_url) on public.partners from authenticated;

-- ── 2. set_partner_bumper — admin-only setter (null clears) ─────────
create or replace function public.set_partner_bumper(_partner_id uuid, _url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.partners
     set bumper_url = nullif(btrim(coalesce(_url, '')), '')
   where id = _partner_id;

  if not found then
    raise exception 'PARTNER_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.set_partner_bumper(uuid, text) from public;
grant  execute on function public.set_partner_bumper(uuid, text) to authenticated;

-- ── 3. get_my_partner_branding — now also returns bumper_url ────────
-- Return shape changes (adds a column), so drop before recreate.
drop function if exists public.get_my_partner_branding();

create or replace function public.get_my_partner_branding()
returns table (name text, avatar_url text, description text, bumper_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.name, p.avatar_url, p.description, p.bumper_url
    from public.profiles pr
    join public.organizations o on o.id = pr.org_id
    join public.partners p      on p.id = o.partner_id
   where pr.id = auth.uid()
   limit 1;
$$;

revoke execute on function public.get_my_partner_branding() from public;
grant  execute on function public.get_my_partner_branding() to authenticated;
