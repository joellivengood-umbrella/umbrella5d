-- Partner impact metrics — reach across the partner's orgs (co-branding)
--
-- The Partner Dashboard shows the partner how much value their partnership
-- creates: how many organizations joined under them, how many people are
-- learning, and how many lessons those people have completed.
--
-- These span OTHER users' orgs and progress, which the partner owner can't
-- read directly (org_members and content_progress are RLS-scoped to a user's
-- own org / own rows). So aggregate through a definer RPC that only ever
-- returns three counts for the caller's OWN partner — never any row data.
--
-- Idempotent: create-or-replace.

create or replace function public.get_partner_impact()
returns table (org_count integer, member_count integer, completion_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with my_orgs as (
    select o.id
      from public.organizations o
      join public.partners p on p.id = o.partner_id
     where p.owner_id = auth.uid()
  ),
  my_members as (
    select distinct om.user_id
      from public.org_members om
     where om.org_id in (select id from my_orgs)
  )
  select
    (select count(*) from my_orgs)::int                           as org_count,
    (select count(*) from my_members)::int                        as member_count,
    (select count(*) from public.content_progress cp
       where cp.user_id in (select user_id from my_members))::int as completion_count;
$$;

revoke execute on function public.get_partner_impact() from public;
grant  execute on function public.get_partner_impact() to authenticated;
