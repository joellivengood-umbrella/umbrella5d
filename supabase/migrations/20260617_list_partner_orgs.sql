-- A partner lists the organizations under them — via a definer RPC, NOT a
-- table SELECT policy.
--
-- A full-row SELECT policy on organizations would hand the partner every
-- column of each owned org, including invite_code (which 20260605
-- deliberately stopped being client-readable so it can't be harvested to
-- self-join), owner_id, and plan_tier. Instead, list_partner_orgs returns
-- ONLY the safe display columns (id, name, created_at) for orgs whose
-- partner is owned by the caller — the same definer-RPC pattern as
-- create_organization / join_organization / lookup_invite_code.
--
-- Idempotent: create-or-replace.

create or replace function public.list_partner_orgs()
returns table (id uuid, name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.created_at
    from public.organizations o
    join public.partners p on p.id = o.partner_id
   where p.owner_id = auth.uid()
   order by o.name asc;
$$;

revoke execute on function public.list_partner_orgs() from public;
grant  execute on function public.list_partner_orgs() to authenticated;
