-- Admin analytics dashboard: aggregate RPCs over analytics_events
--
-- Three platform-admin RPCs feed /admin/analytics, all computed in the
-- database so the page fetches a few small JSON payloads instead of
-- streaming raw event rows to the server:
--   admin_analytics_overview  — KPIs (with previous-period deltas), the daily
--                               active-members series plus today so far,
--                               per-course engagement, the activity mix, and
--                               the top completed content
--   admin_analytics_breakdown — engagement per partner, or per organization
--                               once a partner (or "no partner") is selected
--   admin_analytics_retention — weekly cohorts by first-active week (last 8)
--
-- Every RPC is SECURITY DEFINER (the joins span profiles, org_members and
-- content_progress, whose RLS is own-row only) and therefore gates itself on
-- is_platform_admin() — the /admin layout check does not re-run when only the
-- query string changes, and the anon key could otherwise call these directly.
--
-- Scoping rules shared by all three:
--   * platform admins (staff) are excluded from every metric;
--   * partner membership comes from org_members -> organizations.partner_id
--     (profiles.org_id is user-writable, so it is never the authority); a
--     member of orgs under two partners counts under both;
--   * only the known event names count, and events can't be future-dated;
--   * days and weeks are bucketed in one reporting time zone: the _tz
--     argument if valid, else the calling admin's profile time zone, else
--     America/Chicago (the app default). Window bounds are local dates
--     converted with ::timestamp at time zone, so they stay DST-correct.
--
-- Windows (overview and breakdown): the N COMPLETE local days ending
-- yesterday, compared with the N days before that. Today is still in
-- progress, so it is reported on its own ("today") and never mixed into a
-- KPI or a delta. Days before tracking began are not averaged in as zeros:
-- the daily averages divide by the tracked days of each window.
--
-- Tracking start = the first counted event by a non-staff member, so staff
-- testing before launch doesn't stretch the tracked-days divisors.
--
-- Cost: each RPC reads its window of events in one or two narrow passes,
-- counts distinct values by grouping first, and buckets days/weeks by binary
-- search over precomputed local midnights (about 1.9s for a 90-day overview
-- over 2.3M events in testing, down from ~15s). Each runs with
-- work_mem = 32MB, plan_cache_mode = force_custom_plan (on a pooled
-- connection Postgres would otherwise switch to a generic plan after five
-- calls, which measurably slowed these queries in testing) and jit = off
-- (JIT compilation adds latency to queries this size without paying off).
--
-- Also hardens analytics_events:
--   * inserts: clients may supply only user_id, event_name and properties, so
--     id and occurred_at always take their server defaults and nobody can
--     back- or future-date events to skew the numbers. track()
--     (src/lib/analytics.ts) already inserts exactly those three columns;
--   * properties are capped at 2 KB (added NOT VALID, so existing rows are
--     not re-checked; run VALIDATE CONSTRAINT later if wanted);
--   * the per-user index becomes (user_id, occurred_at), which bounds the
--     per-member probes these RPCs make by time and still serves user_id-only
--     lookups (the ON DELETE CASCADE from auth.users).
--
-- Idempotent: create-or-replace, if-[not-]exists guards; the grants are
-- re-runnable.

-- ── Insert hardening ──────────────────────────────────────────────
revoke insert on public.analytics_events from anon, authenticated;
grant  insert (user_id, event_name, properties)
  on public.analytics_events to authenticated;

-- ── Size guard and indexes ────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.analytics_events'::regclass
       and conname  = 'analytics_events_properties_size'
  ) then
    alter table public.analytics_events
      add constraint analytics_events_properties_size
      check (pg_column_size(properties) <= 2048) not valid;
  end if;
end $$;

create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at);
drop index if exists public.analytics_events_user_id_idx;

-- ── Internal helpers (not callable by clients) ────────────────────

-- The event names the dashboard counts. Clients can insert any 1–64 char
-- name for themselves; anything not listed here is ignored.
create or replace function public.analytics_event_names()
returns text[]
language sql
immutable
parallel safe
set search_path = public
as $$
  select array[
    'login',
    'course_opened',
    'content_completed',
    'content_uncompleted',
    'potd_played',
    'potd_completed',
    'machine_block_checked',
    'machine_block_unchecked',
    'machine_activity_saved'
  ]::text[];
$$;

-- An earlier draft of this migration parsed content ids with a regex helper;
-- the RPCs now compare ids as text (see admin_analytics_overview).
drop function if exists public.analytics_try_uuid(text);

-- The reporting time zone: _tz if it is a zone Postgres recognises, else the
-- caller's profile time zone, else the app default. Validates by attempting
-- the conversion (cheaper than scanning pg_timezone_names).
create or replace function public.analytics_resolve_tz(_tz text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  _candidate text;
begin
  foreach _candidate in array array[
    _tz,
    (select p.timezone from public.profiles p where p.id = auth.uid()),
    'America/Chicago'
  ] loop
    if _candidate is not null and btrim(_candidate) <> '' then
      begin
        perform now() at time zone _candidate;
        return _candidate;
      exception when others then
        null; -- not a recognised zone; try the next candidate
      end;
    end if;
  end loop;
  return 'UTC';
end;
$$;

-- The members a dashboard filter selects (staff always excluded):
--   _partner_id set  -> members of any org owned by that partner
--   _unpartnered     -> members of no partner-owned org (incl. individuals)
--   neither          -> everyone
-- admin_analytics_overview and admin_analytics_retention inline this same
-- predicate (their joins span millions of events, and the planner can only
-- estimate an inlined subquery); keep the three in sync.
create or replace function public.analytics_scope_users(
  _partner_id  uuid,
  _unpartnered boolean
)
returns table (user_id uuid)
language sql
stable
parallel safe
set search_path = public
as $$
  select p.id
    from public.profiles p
   where not p.is_platform_admin
     and case
           when _partner_id is not null then exists (
             select 1
               from public.org_members om
               join public.organizations o on o.id = om.org_id
              where om.user_id = p.id
                and o.partner_id = _partner_id)
           when coalesce(_unpartnered, false) then not exists (
             select 1
               from public.org_members om
               join public.organizations o on o.id = om.org_id
              where om.user_id = p.id
                and o.partner_id is not null)
           else true
         end;
$$;

-- ── admin_analytics_overview ──────────────────────────────────────
-- range:  {days, tz, start, end, today}; start..end = the N complete days
--         ending yesterday.
-- kpis:   current vs previous window; avg_daily_active(_prev) divide by the
--         tracked days of their window, returned as avg_daily_days(_prev).
--         Unrounded (the page rounds for display), so the stickiness ratio
--         and the deltas built from them stay exact for small scopes.
--         new_members counts join moments: with a partner selected, the
--         member's first org_members row under that partner (signup if
--         unknown); otherwise the signup.
-- daily:  exactly N zero-filled points, start..end; today: today so far.
-- courses.visits: distinct (member, local day) pairs with a course_opened.
create or replace function public.admin_analytics_overview(
  _days        integer,
  _tz          text    default null,
  _partner_id  uuid    default null,
  _unpartnered boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set work_mem = '32MB'
set plan_cache_mode = 'force_custom_plan'
set jit = off
as $$
declare
  _zone       text;
  _today      date;         -- local today: in progress, reported apart
  _end        date;         -- last complete day (yesterday)
  _start      date;
  _prev_start date;
  _today_ts   timestamptz;  -- local midnight today = end of the KPI window
  _start_ts   timestamptz;
  _prev_ts    timestamptz;
  _track_ts   timestamptz;  -- first counted event: when tracking began
  _track_day  date;
  _cur_days   integer;      -- tracked days in the current window
  _prev_days  integer;      -- tracked days in the previous window (may be 0)
  _bounds     timestamptz[];-- local midnights, _prev_start .. _today + 1
  _item_course jsonb;       -- content item id (as text) -> its course slug
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  _days       := case when _days in (7, 30, 90) then _days else 30 end;
  _zone       := public.analytics_resolve_tz(_tz);
  _today      := (now() at time zone _zone)::date;
  _end        := _today - 1;
  _start      := _today - _days;
  _prev_start := _start - _days;
  _today_ts   := _today::timestamp      at time zone _zone;
  _start_ts   := _start::timestamp      at time zone _zone;
  _prev_ts    := _prev_start::timestamp at time zone _zone;

  _track_ts   := (select min(e.occurred_at)
                    from public.analytics_events e
                   where e.event_name = any (public.analytics_event_names())
                     and e.occurred_at <= now()
                     and not exists (select 1 from public.profiles sp
                                      where sp.id = e.user_id
                                        and sp.is_platform_admin));
  _track_day  := (_track_ts at time zone _zone)::date;
  _cur_days   := case when _track_day is null then _days
                      else greatest(1, _end - greatest(_start, _track_day) + 1) end;
  _prev_days  := case when _track_day is null then _days
                      else greatest(0, _start - greatest(_prev_start, _track_day)) end;
  -- Day bucketing by binary search over the exact local midnights: same
  -- result as (occurred_at at time zone _zone)::date, DST included, but much
  -- cheaper per event row.
  _bounds     := array(select (_prev_start + g)::timestamp at time zone _zone
                         from generate_series(0, 2 * _days + 1) as g
                        order by g);
  _item_course := (select coalesce(jsonb_object_agg(ci.id::text, ci.type), '{}'::jsonb)
                     from public.content_items ci);

  return (
    -- analytics_scope_users() inlined (kept in sync with it): a function scan
    -- has no statistics, so the planner would hash millions of events rather
    -- than the members. Not materialized, so every use sees real estimates.
    with scope as not materialized (
      select p.id as user_id
        from public.profiles p
       where not p.is_platform_admin
         and (_partner_id is null
              or p.id in (select om.user_id
                            from public.org_members om
                            join public.organizations o on o.id = om.org_id
                           where o.partner_id = _partner_id))
         and (_partner_id is not null
              or not coalesce(_unpartnered, false)
              or p.id not in (select om.user_id
                                from public.org_members om
                                join public.organizations o on o.id = om.org_id
                               where o.partner_id is not null))
    ),
    -- One row per in-scope member per local day with a counted event, over
    -- the previous window, the current window and today so far. Every
    -- active-member figure is a count over these rows.
    user_days as materialized (
      select e.user_id,
             _prev_start + (width_bucket(e.occurred_at, _bounds) - 1) as day
        from public.analytics_events e
        join scope s on s.user_id = e.user_id
       where e.occurred_at >= _prev_ts
         and e.occurred_at <= now()
         and e.event_name = any (public.analytics_event_names())
       group by 1, 2
    ),
    -- Current window, one narrow row per (member, event, course[, local day
    -- for opens]) with its event count. Opens carry the slug, machine events
    -- are always the machine, the rest resolve through their content item.
    -- Ids are client-supplied JSON: looking them up as text (any case) in the
    -- id -> course map means a malformed one simply matches nothing and can
    -- never raise mid-aggregate.
    cur as materialized (
      select x.user_id, x.event_name, x.course_slug, x.open_day, count(*)::int as n
        from (select e.user_id,
                     e.event_name,
                     case
                       when e.event_name = 'course_opened'
                         then e.properties ->> 'slug'
                       when e.event_name in ('machine_block_checked',
                                             'machine_block_unchecked',
                                             'machine_activity_saved')
                         then 'machine'
                       else _item_course ->> lower(coalesce(e.properties ->> 'contentItemId',
                                                            e.properties ->> 'itemId'))
                     end as course_slug,
                     case when e.event_name = 'course_opened'
                          then width_bucket(e.occurred_at, _bounds)
                     end as open_day
                from public.analytics_events e
                join scope s on s.user_id = e.user_id
               where e.occurred_at >= _start_ts
                 and e.occurred_at <  _today_ts
                 and e.event_name = any (public.analytics_event_names())) x
       group by 1, 2, 3, 4
    ),
    -- Per member, their active days in each window; summed, these give the
    -- distinct-member counts and the sums of daily actives in one pass.
    member_days as (
      select count(*) filter (where m.cur_n   > 0) as active,
             count(*) filter (where m.prev_n  > 0) as active_prev,
             count(*) filter (where m.today_n > 0) as active_today,
             coalesce(sum(m.cur_n), 0)             as cur_total,
             coalesce(sum(m.prev_n), 0)            as prev_total
        from (select ud.user_id,
                     count(*) filter (where ud.day between _start and _end) as cur_n,
                     count(*) filter (where ud.day < _start)                as prev_n,
                     count(*) filter (where ud.day = _today)                as today_n
                from user_days ud
               group by ud.user_id) m
    ),
    daily_counts as (
      select ud.day, count(*) as active
        from user_days ud
       where ud.day between _start and _end
       group by ud.day
    ),
    -- Completions come from content_progress (the source of truth: one row
    -- per member per item, removed when un-completed), published items only;
    -- counted per item for both windows.
    comp_items as materialized (
      select cp.content_item_id,
             ci.type                                              as course_slug,
             count(*) filter (where cp.completed_at >= _start_ts) as cur_n,
             count(*) filter (where cp.completed_at <  _start_ts) as prev_n
        from public.content_progress cp
        join scope s on s.user_id = cp.user_id
        join public.content_items ci on ci.id = cp.content_item_id
       where cp.completed_at >= _prev_ts
         and cp.completed_at <  _today_ts
         and coalesce(ci.is_published, false)
       group by cp.content_item_id, ci.type
    ),
    -- When a member joined the selected partner: their first org_members row
    -- under it (no rows unless a partner is selected).
    partner_join as (
      select om.user_id, min(om.created_at) as joined_at
        from public.org_members om
        join public.organizations o on o.id = om.org_id
       where o.partner_id = _partner_id
       group by om.user_id
    ),
    members as materialized (
      select coalesce(pj.joined_at, p.created_at, u.created_at) as joined_at
        from scope s
        join public.profiles p on p.id = s.user_id
        left join auth.users u on u.id = s.user_id
        left join partner_join pj on pj.user_id = s.user_id
    ),
    kpis as (
      select jsonb_build_object(
        'active_users',          md.active,
        'active_users_prev',     md.active_prev,
        'avg_daily_active',      md.cur_total::numeric / _cur_days,
        'avg_daily_active_prev', case when _prev_days > 0
                                      then md.prev_total::numeric / _prev_days
                                      else 0.0 end,
        'avg_daily_days',        _cur_days,
        'avg_daily_days_prev',   _prev_days,
        'completions',           (select coalesce(sum(ct.cur_n), 0)::bigint  from comp_items ct),
        'completions_prev',      (select coalesce(sum(ct.prev_n), 0)::bigint from comp_items ct),
        'members_total',         (select count(*) from members),
        'new_members',           (select count(*) from members m
                                   where m.joined_at >= _start_ts and m.joined_at < _today_ts),
        'new_members_prev',      (select count(*) from members m
                                   where m.joined_at >= _prev_ts and m.joined_at < _start_ts)
      ) as obj
        from member_days md
    ),
    daily as (
      select coalesce(jsonb_agg(jsonb_build_object('day',    d.day,
                                                   'active', coalesce(dc.active, 0))
                                order by d.day), '[]'::jsonb) as arr
        from (select _start + g as day from generate_series(0, _days - 1) as g) d
        left join daily_counts dc on dc.day = d.day
    ),
    course_visits as (
      select c.course_slug, count(*) as visits
        from cur c
       where c.event_name = 'course_opened'
         and c.course_slug is not null
       group by c.course_slug
    ),
    course_learners as (
      select x.course_slug, count(*) as learners
        from (select distinct c.course_slug, c.user_id
                from cur c
               where c.course_slug is not null) x
       group by x.course_slug
    ),
    course_comp as (
      select ct.course_slug, sum(ct.cur_n)::bigint as completions
        from comp_items ct
       group by ct.course_slug
      having sum(ct.cur_n) > 0
    ),
    courses_json as (
      select coalesce(jsonb_agg(jsonb_build_object(
               'slug',         c.slug,
               'title',        c.title,
               'short_title',  c.short_title,
               'in_program',   c.in_program,
               'is_published', c.is_published,
               'visits',       coalesce(cv.visits, 0),
               'learners',     coalesce(cl.learners, 0),
               'completions',  coalesce(cc.completions, 0))
             order by c.sort_order, c.slug), '[]'::jsonb) as arr
        from public.courses c
        left join course_visits   cv on cv.course_slug = c.slug
        left join course_learners cl on cl.course_slug = c.slug
        left join course_comp     cc on cc.course_slug = c.slug
       where c.is_published
          or cl.course_slug is not null
          or cc.course_slug is not null
    ),
    activity_json as (
      select coalesce(jsonb_agg(jsonb_build_object('event',  a.event_name,
                                                   'events', a.events,
                                                   'users',  a.users)
                                order by a.event_name), '[]'::jsonb) as arr
        from (select y.event_name, sum(y.n)::bigint as events, count(*) as users
                from (select c.event_name, c.user_id, sum(c.n) as n
                        from cur c
                       group by c.event_name, c.user_id) y
               group by y.event_name) a
    ),
    top_json as (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',           t.content_item_id,
               'title',        ci.title,
               'sequence_num', ci.sequence_num,
               'version',      ci.metadata ->> 'version',
               'course_slug',  ci.type,
               'course_title', c.title,
               'completions',  t.completions)
             order by t.completions desc, ci.type, ci.sequence_num), '[]'::jsonb) as arr
        from (select ct.content_item_id, ct.cur_n as completions
                from comp_items ct
               where ct.cur_n > 0
               order by ct.cur_n desc, ct.content_item_id
               limit 10) t
        join public.content_items ci on ci.id = t.content_item_id
        left join public.courses   c on c.slug = ci.type
    )
    select jsonb_build_object(
      'range',            jsonb_build_object('days',  _days,
                                             'tz',    _zone,
                                             'start', _start,
                                             'end',   _end,
                                             'today', _today),
      'tracking_started', _track_ts,
      'kpis',             (select k.obj from kpis k),
      'daily',            (select d.arr from daily d),
      'today',            jsonb_build_object('day',    _today,
                                             'active', (select md.active_today from member_days md)),
      'courses',          (select cj.arr from courses_json cj),
      'activity',         (select aj.arr from activity_json aj),
      'top_content',      (select tj.arr from top_json tj)
    )
  );
end;
$$;

-- ── admin_analytics_breakdown ─────────────────────────────────────
-- Unfiltered: one row per partner plus a "no partner" remainder.
-- A partner selected: one row per organization that partner owns.
-- "No partner" selected: one row per partner-less organization plus an
-- "individuals" remainder (members of no organization at all).
-- Rows are capped at 50 (most active first); total_rows reports the full
-- count so the page can say what was left out. Same window as the overview
-- KPIs: the N complete local days ending yesterday.
create or replace function public.admin_analytics_breakdown(
  _days        integer,
  _tz          text    default null,
  _partner_id  uuid    default null,
  _unpartnered boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set work_mem = '32MB'
set plan_cache_mode = 'force_custom_plan'
set jit = off
as $$
declare
  _zone     text;
  _today    date;
  _start_ts timestamptz;
  _today_ts timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  _days     := case when _days in (7, 30, 90) then _days else 30 end;
  _zone     := public.analytics_resolve_tz(_tz);
  _today    := (now() at time zone _zone)::date;
  _start_ts := (_today - _days)::timestamp at time zone _zone;
  _today_ts := _today::timestamp          at time zone _zone;

  if _partner_id is null and not coalesce(_unpartnered, false) then
    return (
      with active_users as (
        select distinct e.user_id
          from public.analytics_events e
         where e.occurred_at >= _start_ts
           and e.occurred_at <  _today_ts
           and e.event_name = any (public.analytics_event_names())
      ),
      user_completions as (
        select cp.user_id, count(*) as n
          from public.content_progress cp
          join public.content_items ci on ci.id = cp.content_item_id
         where cp.completed_at >= _start_ts
           and cp.completed_at <  _today_ts
           and coalesce(ci.is_published, false)
         group by cp.user_id
      ),
      member_partner as (
        select distinct om.user_id, o.partner_id
          from public.org_members om
          join public.organizations o on o.id = om.org_id
          join public.profiles p      on p.id = om.user_id
         where o.partner_id is not null
           and not p.is_platform_admin
      ),
      partner_rows as (
        select pa.id,
               pa.name,
               (select count(*) from public.organizations o
                 where o.partner_id = pa.id) as orgs,
               count(mp.user_id)             as members,
               count(au.user_id)             as active,
               coalesce(sum(uc.n), 0)        as completions
          from public.partners pa
          left join member_partner   mp on mp.partner_id = pa.id
          left join active_users     au on au.user_id = mp.user_id
          left join user_completions uc on uc.user_id = mp.user_id
         group by pa.id, pa.name
      ),
      unpartnered as (
        select s.user_id from public.analytics_scope_users(null, true) s
      ),
      remainder as (
        select (select count(*) from public.organizations o
                 where o.partner_id is null) as orgs,
               count(u.user_id)              as members,
               count(au.user_id)             as active,
               coalesce(sum(uc.n), 0)        as completions
          from unpartnered u
          left join active_users     au on au.user_id = u.user_id
          left join user_completions uc on uc.user_id = u.user_id
      )
      select jsonb_build_object(
        'level',        'partner',
        'partner_name', null,
        'total_rows',   (select count(*) from partner_rows),
        'rows',         (select coalesce(jsonb_agg(jsonb_build_object(
                                  'id',          r.id,
                                  'name',        r.name,
                                  'orgs',        r.orgs,
                                  'members',     r.members,
                                  'active',      r.active,
                                  'completions', r.completions)
                                order by r.active desc, r.members desc, r.name), '[]'::jsonb)
                           from (select * from partner_rows
                                  order by active desc, members desc, name
                                  limit 50) r),
        'remainder',    (select jsonb_build_object(
                                  'kind',        'unpartnered',
                                  'orgs',        rm.orgs,
                                  'members',     rm.members,
                                  'active',      rm.active,
                                  'completions', rm.completions)
                           from remainder rm)
      )
    );
  end if;

  return (
    with scope as (
      select s.user_id
        from public.analytics_scope_users(_partner_id, _unpartnered) s
    ),
    active_users as (
      select distinct e.user_id
        from public.analytics_events e
       where e.occurred_at >= _start_ts
         and e.occurred_at <  _today_ts
         and e.event_name = any (public.analytics_event_names())
    ),
    user_completions as (
      select cp.user_id, count(*) as n
        from public.content_progress cp
        join public.content_items ci on ci.id = cp.content_item_id
       where cp.completed_at >= _start_ts
         and cp.completed_at <  _today_ts
         and coalesce(ci.is_published, false)
       group by cp.user_id
    ),
    orgs as (
      select o.id, o.name
        from public.organizations o
       where (_partner_id is not null and o.partner_id = _partner_id)
          or (_partner_id is null     and o.partner_id is null)
    ),
    org_users as (
      select distinct om.org_id, om.user_id
        from public.org_members om
        join orgs  o on o.id = om.org_id
        join scope s on s.user_id = om.user_id
    ),
    org_rows as (
      select o.id,
             o.name,
             count(ou.user_id)      as members,
             count(au.user_id)      as active,
             coalesce(sum(uc.n), 0) as completions
        from orgs o
        left join org_users        ou on ou.org_id = o.id
        left join active_users     au on au.user_id = ou.user_id
        left join user_completions uc on uc.user_id = ou.user_id
       group by o.id, o.name
    ),
    individuals as (
      select s.user_id
        from scope s
       where not exists (select 1 from public.org_members om
                          where om.user_id = s.user_id)
    ),
    remainder as (
      select count(i.user_id)       as members,
             count(au.user_id)      as active,
             coalesce(sum(uc.n), 0) as completions
        from individuals i
        left join active_users     au on au.user_id = i.user_id
        left join user_completions uc on uc.user_id = i.user_id
    )
    select jsonb_build_object(
      'level',        'organization',
      'partner_name', (select pa.name from public.partners pa where pa.id = _partner_id),
      'total_rows',   (select count(*) from org_rows),
      'rows',         (select coalesce(jsonb_agg(jsonb_build_object(
                                'id',          r.id,
                                'name',        r.name,
                                'orgs',        null,
                                'members',     r.members,
                                'active',      r.active,
                                'completions', r.completions)
                              order by r.active desc, r.members desc, r.name), '[]'::jsonb)
                         from (select * from org_rows
                                order by active desc, members desc, name
                                limit 50) r),
      'remainder',    case when _partner_id is null then
                        (select jsonb_build_object(
                                  'kind',        'individuals',
                                  'orgs',        null,
                                  'members',     rm.members,
                                  'active',      rm.active,
                                  'completions', rm.completions)
                           from remainder rm)
                      end
    )
  );
end;
$$;

-- ── admin_analytics_retention ─────────────────────────────────────
-- Cohort = the week (Monday start, reporting zone) of a member's first
-- counted event. For each of the last 8 cohorts: its size and how many of
-- those members were active in each week since (the current week included,
-- in progress). Not tied to the 7/30/90 day range; the partner filter still
-- applies. Reads only the 8-week window: a member's first event falls in it
-- exactly when they have a counted event there and none before it (one
-- (user_id, occurred_at) index probe per member active in the window).
create or replace function public.admin_analytics_retention(
  _tz          text    default null,
  _partner_id  uuid    default null,
  _unpartnered boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set work_mem = '32MB'
set plan_cache_mode = 'force_custom_plan'
set jit = off
as $$
declare
  _zone       text;
  _this_week  date;
  _first_week date;
  _window_ts  timestamptz;
  _bounds     timestamptz[];  -- local Monday midnights, _first_week .. next week
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  _zone       := public.analytics_resolve_tz(_tz);
  _this_week  := date_trunc('week', now() at time zone _zone)::date;
  _first_week := _this_week - 49;   -- this week and the 7 before it
  _window_ts  := _first_week::timestamp at time zone _zone;
  -- Week bucketing by binary search over the exact local week starts: same
  -- result as date_trunc('week', occurred_at at time zone _zone), cheaper.
  _bounds     := array(select (_first_week + 7 * g)::timestamp at time zone _zone
                         from generate_series(0, 8) as g
                        order by g);

  return (
    -- analytics_scope_users() inlined, as in admin_analytics_overview.
    with scope as not materialized (
      select p.id as user_id
        from public.profiles p
       where not p.is_platform_admin
         and (_partner_id is null
              or p.id in (select om.user_id
                            from public.org_members om
                            join public.organizations o on o.id = om.org_id
                           where o.partner_id = _partner_id))
         and (_partner_id is not null
              or not coalesce(_unpartnered, false)
              or p.id not in (select om.user_id
                                from public.org_members om
                                join public.organizations o on o.id = om.org_id
                               where o.partner_id is not null))
    ),
    -- Every in-scope member's active weeks inside the window (one scan).
    user_weeks as materialized (
      select e.user_id,
             _first_week + 7 * (width_bucket(e.occurred_at, _bounds) - 1) as wk
        from public.analytics_events e
        join scope s on s.user_id = e.user_id
       where e.event_name = any (public.analytics_event_names())
         and e.occurred_at >= _window_ts
         and e.occurred_at <= now()
       group by 1, 2
    ),
    window_first as (
      select uw.user_id, min(uw.wk) as cohort
        from user_weeks uw
       group by uw.user_id
    ),
    recent as materialized (
      select w.user_id, w.cohort
        from window_first w
       where not exists (
               select 1
                 from public.analytics_events p
                where p.user_id = w.user_id
                  and p.occurred_at < _window_ts
                  and p.event_name = any (public.analytics_event_names()))
    ),
    cells as materialized (
      select r.cohort,
             (uw.wk - r.cohort) / 7 as k,
             count(*)               as active
        from recent r
        join user_weeks uw on uw.user_id = r.user_id
       group by r.cohort, (uw.wk - r.cohort) / 7
    ),
    cohorts as (
      select r.cohort, count(*) as size
        from recent r
       group by r.cohort
    )
    select jsonb_build_object(
      'tz',        _zone,
      'this_week', _this_week,
      'cohorts',   coalesce((
        select jsonb_agg(jsonb_build_object(
                 'start', c.cohort,
                 'size',  c.size,
                 'weeks', (select jsonb_agg(jsonb_build_object(
                                    'k',      g.k,
                                    'active', coalesce(ce.active, 0))
                                  order by g.k)
                             from generate_series(0, (_this_week - c.cohort) / 7) as g(k)
                             left join cells ce
                               on ce.cohort = c.cohort and ce.k = g.k))
               order by c.cohort desc)
          from cohorts c), '[]'::jsonb)
    )
  );
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────
-- Helpers run only inside the definer RPCs above (as the function owner).
revoke execute on function public.analytics_event_names()              from public, anon, authenticated;
revoke execute on function public.analytics_resolve_tz(text)           from public, anon, authenticated;
revoke execute on function public.analytics_scope_users(uuid, boolean) from public, anon, authenticated;

-- The RPCs themselves: signed-in callers only; each one re-checks for a
-- platform admin before reading anything.
revoke execute on function public.admin_analytics_overview(integer, text, uuid, boolean)  from public, anon;
grant  execute on function public.admin_analytics_overview(integer, text, uuid, boolean)  to authenticated;
revoke execute on function public.admin_analytics_breakdown(integer, text, uuid, boolean) from public, anon;
grant  execute on function public.admin_analytics_breakdown(integer, text, uuid, boolean) to authenticated;
revoke execute on function public.admin_analytics_retention(text, uuid, boolean)          from public, anon;
grant  execute on function public.admin_analytics_retention(text, uuid, boolean)          to authenticated;
