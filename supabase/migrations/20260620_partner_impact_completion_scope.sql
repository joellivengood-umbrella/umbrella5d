-- Title: Scope partner-impact "lessons completed" to in-program, published items
--
-- get_partner_impact().completion_count counted EVERY content_progress row for
-- a partner's members — including Daily Pod / bonus plays and progress on
-- unpublished items. Every other progress surface in the app (sidebar,
-- dashboard, team progress) counts only PUBLISHED content_items whose course
-- is in_program, so the Partner Dashboard's number was inflated and didn't
-- reconcile with what members see on their own dashboards. Re-scope it to the
-- same set: published content_items whose course is in_program + published.
--
-- org_count and member_count are unchanged. member_count intentionally
-- includes org managers — they're people learning under the partner too.
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
    (select count(*) from my_orgs)::int    as org_count,
    (select count(*) from my_members)::int as member_count,
    (select count(*)
       from public.content_progress cp
       join public.content_items ci on ci.id = cp.content_item_id
      where cp.user_id in (select user_id from my_members)
        and ci.is_published
        and ci.type in (
          select c.slug from public.courses c
           where c.in_program and c.is_published
        ))::int as completion_count;
$$;

revoke execute on function public.get_partner_impact() from public;
grant  execute on function public.get_partner_impact() to authenticated;
