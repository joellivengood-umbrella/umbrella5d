-- Title: Partner usage — how a partner's organizations use the program
--
-- get_partner_usage() feeds the Partner Dashboard. It returns AGGREGATES for
-- the CALLER's own partnership only (the partner they own): never member
-- names, ids, or individual activity. Staff (platform admins) are excluded,
-- like the admin analytics.
--
--   window       the last 30 COMPLETE local days (ending yesterday) and the
--                30 before it, in the caller's time zone
--   kpis         active members (did anything tracked in the window), members
--                total, lessons completed (published in-program items, same
--                scope as get_partner_impact), new members (first joined one
--                of the partner's orgs) — each with the previous window
--   orgs         per organization: members, active, completions, last
--                activity (the page flags orgs quiet for 14+ days)
--   machine      5D Machine progress over published lessons in published
--                Parts: average % complete, finished, not started, and how
--                many members are currently in each Part (their first
--                unfinished lesson's Part)
--   tracking_started  first tracked event anywhere (comparisons need a full
--                previous window of tracking)
--
-- SECURITY DEFINER (members' events/progress aren't readable to a partner
-- directly); refuses anyone who doesn't own a partner. Idempotent.

create or replace function public.get_partner_usage(_tz text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  _partner_id uuid;
  _zone       text;
  _today      date;
  _start_ts   timestamptz;
  _prev_ts    timestamptz;
  _today_ts   timestamptz;
  _result     jsonb;
begin
  select p.id into _partner_id
    from public.partners p
   where p.owner_id = auth.uid()
   order by p.created_at
   limit 1;
  if _partner_id is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  _zone     := public.analytics_resolve_tz(_tz);
  _today    := (now() at time zone _zone)::date;
  _today_ts := _today::timestamp at time zone _zone;
  _start_ts := (_today - 30)::timestamp at time zone _zone;
  _prev_ts  := (_today - 60)::timestamp at time zone _zone;

  with
  my_orgs as (
    select o.id, o.name, o.created_at
      from public.organizations o
     where o.partner_id = _partner_id
  ),
  -- (org, member) pairs, staff excluded; joined_at = membership start.
  memberships as (
    select om.org_id, om.user_id, om.created_at as joined_at
      from public.org_members om
      join my_orgs mo on mo.id = om.org_id
     where not exists (
       select 1 from public.profiles sp
        where sp.id = om.user_id and sp.is_platform_admin)
  ),
  members as (
    select user_id, min(joined_at) as joined_at
      from memberships
     group by user_id
  ),
  program_items as (
    select ci.id
      from public.content_items ci
     where ci.is_published
       and ci.type in (select c.slug from public.courses c
                        where c.in_program and c.is_published)
  ),
  -- Per member: active in each window, last event, completions per window.
  ev as (
    select e.user_id,
           bool_or(e.occurred_at >= _start_ts and e.occurred_at < _today_ts) as cur,
           bool_or(e.occurred_at >= _prev_ts  and e.occurred_at < _start_ts) as prev,
           max(e.occurred_at) as last_at
      from public.analytics_events e
      join members m on m.user_id = e.user_id
     where e.event_name = any (public.analytics_event_names())
       and e.occurred_at <= now()
     group by e.user_id
  ),
  comp as (
    select cp.user_id,
           count(*) filter (where cp.completed_at >= _start_ts and cp.completed_at < _today_ts) as cur_n,
           count(*) filter (where cp.completed_at >= _prev_ts  and cp.completed_at < _start_ts) as prev_n,
           max(cp.completed_at) as last_at
      from public.content_progress cp
      join members m on m.user_id = cp.user_id
     where cp.content_item_id in (select id from program_items)
     group by cp.user_id
  ),
  member_stats as (
    select m.user_id, m.joined_at,
           coalesce(ev.cur, false)  as cur,
           coalesce(ev.prev, false) as prev,
           coalesce(c.cur_n, 0)     as comp_cur,
           coalesce(c.prev_n, 0)    as comp_prev,
           greatest(ev.last_at, c.last_at) as last_at
      from members m
      left join ev on ev.user_id = m.user_id
      left join comp c on c.user_id = m.user_id
  ),
  -- 5D Machine: published lessons in published Parts, in course order.
  parts as (
    select mp.id, mp.title,
           row_number() over (order by mp.sort_index, mp.created_at) as part_no
      from public.machine_parts mp
     where mp.is_published
  ),
  lessons as (
    select ci.id, p.part_no,
           row_number() over (order by p.part_no, ci.part_sort_index, ci.sequence_num) as ord
      from public.content_items ci
      join parts p on p.id = ci.part_id
     where ci.type = 'machine' and ci.is_published
  ),
  machine_member as (
    select m.user_id,
           count(cp.content_item_id) as done,
           -- The first lesson they haven't finished decides their Part.
           (select l.part_no from lessons l
             where not exists (select 1 from public.content_progress p2
                                where p2.user_id = m.user_id and p2.content_item_id = l.id)
             order by l.ord limit 1) as current_part
      from members m
      left join public.content_progress cp
        on cp.user_id = m.user_id and cp.content_item_id in (select id from lessons)
     group by m.user_id
  )
  select jsonb_build_object(
    'tz', _zone,
    'window', jsonb_build_object('start', _today - 30, 'end', _today - 1),
    'tracking_started',
      (select min(e.occurred_at) from public.analytics_events e
        where e.event_name = any (public.analytics_event_names())
          and e.occurred_at <= now()
          and not exists (select 1 from public.profiles sp
                           where sp.id = e.user_id and sp.is_platform_admin)),
    'kpis', (
      select jsonb_build_object(
        'members_total',    count(*),
        'active',           count(*) filter (where cur),
        'active_prev',      count(*) filter (where prev),
        'completions',      coalesce(sum(comp_cur), 0),
        'completions_prev', coalesce(sum(comp_prev), 0),
        'new_members',      count(*) filter (where joined_at >= _start_ts and joined_at < _today_ts),
        'new_members_prev', count(*) filter (where joined_at >= _prev_ts  and joined_at < _start_ts))
      from member_stats),
    'orgs', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb order by r.name)
        from (
          select mo.id, mo.name, mo.created_at as joined,
                 count(ms.user_id)                          as members,
                 count(ms.user_id) filter (where ms.cur)    as active,
                 coalesce(sum(ms.comp_cur), 0)              as completions,
                 max(ms.last_at)                            as last_active
            from my_orgs mo
            left join memberships mb on mb.org_id = mo.id
            left join member_stats ms on ms.user_id = mb.user_id
           group by mo.id, mo.name, mo.created_at
        ) r), '[]'::jsonb),
    'machine', (
      select jsonb_build_object(
        'lessons',     (select count(*) from lessons),
        'members',     count(*),
        'avg_pct',     case when (select count(*) from lessons) = 0 or count(*) = 0 then 0
                            else round(avg(done)::numeric * 100 / (select count(*) from lessons), 1) end,
        'finished',    count(*) filter (where (select count(*) from lessons) > 0 and current_part is null),
        'not_started', count(*) filter (where done = 0 and (select count(*) from lessons) > 0),
        'parts', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'part', p.part_no, 'title', p.title,
                   'members', (select count(*) from machine_member mm2
                                where mm2.current_part = p.part_no and mm2.done > 0))
                 order by p.part_no)
            from parts p
           where exists (select 1 from lessons l where l.part_no = p.part_no)), '[]'::jsonb))
      from machine_member)
  ) into _result;

  return _result;
end;
$$;

revoke execute on function public.get_partner_usage(text) from public, anon;
grant  execute on function public.get_partner_usage(text) to authenticated;
