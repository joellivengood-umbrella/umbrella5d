-- Partner branding, readable by the partner's members (co-branding)
--
-- Members and managers under a partner should see that partner's name + logo
-- ("Provided by …") inside their account. But the partners RLS (20260616)
-- limits SELECT to the partner OWNER (or a platform admin) — a member can't
-- read the row directly. Rather than widen that policy (which would let any
-- member enumerate partner rows), expose ONLY the safe display columns for
-- the caller's OWN org's partner through a definer RPC — the same pattern as
-- list_partner_orgs / lookup_invite_code.
--
-- Chain: profiles.org_id → organizations.partner_id → partners. A user with
-- no org, or whose org has no partner, gets zero rows (→ null in the app).
--
-- Idempotent: create-or-replace.

create or replace function public.get_my_partner_branding()
returns table (name text, avatar_url text, description text)
language sql
stable
security definer
set search_path = public
as $$
  select p.name, p.avatar_url, p.description
    from public.profiles pr
    join public.organizations o on o.id = pr.org_id
    join public.partners p      on p.id = o.partner_id
   where pr.id = auth.uid()
   limit 1;
$$;

revoke execute on function public.get_my_partner_branding() from public;
grant  execute on function public.get_my_partner_branding() to authenticated;
