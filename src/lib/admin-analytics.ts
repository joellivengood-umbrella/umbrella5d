import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Platform-admin analytics for /admin/analytics.
 *
 * Every number is aggregated in the database by the admin_analytics_* RPCs
 * (supabase/migrations/20261021_admin_analytics_dashboard.sql), which gate
 * themselves on is_platform_admin(). This module calls them in parallel and
 * parses their JSON defensively, so a missing or malformed field can never
 * crash the page — it just reads as zero.
 */

type MaybeClient = SupabaseClient // relaxed typing — schema isn't codegen'd

export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = 30

/** Which members the dashboard covers: everyone, one partner's, or nobody's. */
export type AnalyticsScope = {
  partnerId: string | null
  unpartnered: boolean
}

/**
 * The partner filter as it appears in the URL: '' = all partners,
 * 'none' = members of no partner, otherwise a partner id.
 */
export type PartnerFilter = string

export const ANALYTICS_PATH = '/admin/analytics'

/**
 * The breakdown section heading's id — a breakdown link moves focus here
 * after it navigates. Lives in this plain module (not the 'use client'
 * shell) because a server component importing a constant from a client
 * module gets a client reference, not the string.
 */
export const BREAKDOWN_HEADING_ID = 'analytics-breakdown-h'

/** The dashboard URL for a range + partner filter (defaults are omitted). */
export function analyticsHref(range: AnalyticsRange, partner: PartnerFilter): string {
  const params = new URLSearchParams()
  if (range !== DEFAULT_ANALYTICS_RANGE) params.set('range', String(range))
  if (partner) params.set('partner', partner)
  const qs = params.toString()
  return qs ? `${ANALYTICS_PATH}?${qs}` : ANALYTICS_PATH
}

/**
 * KPI windows are COMPLETE local days: the N days ending yesterday, compared
 * with the N days before that. Today (still in progress) is reported
 * separately so it never drags a comparison down.
 */
export type AnalyticsKpis = {
  activeUsers: number
  activeUsersPrev: number
  /** Mean daily actives over the days tracking actually covered. */
  avgDailyActive: number
  avgDailyActivePrev: number
  /** How many tracked days each average covers (prev can be 0). */
  avgDailyDays: number
  avgDailyDaysPrev: number
  completions: number
  completionsPrev: number
  membersTotal: number
  /** Partner scope: joined one of that partner's organizations; otherwise: signed up. */
  newMembers: number
  newMembersPrev: number
}

export type DailyActive = { day: string; active: number }

export type CourseEngagement = {
  slug: string
  title: string
  shortTitle: string
  inProgram: boolean
  isPublished: boolean
  /** Distinct (member, day) pairs that opened the course. */
  visits: number
  learners: number
  completions: number
}

export type ActivityCount = { event: string; events: number; users: number }

export type TopContent = {
  id: string
  title: string | null
  sequenceNum: number | null
  version: string | null
  courseSlug: string
  courseTitle: string | null
  completions: number
}

export type AnalyticsOverview = {
  /** start..end = the KPI window (complete days); today = the local date now. */
  range: { days: number; tz: string; start: string; end: string; today: string }
  trackingStarted: string | null
  kpis: AnalyticsKpis
  /** One point per complete day, start..end. */
  daily: DailyActive[]
  /** Today so far — partial, kept out of every KPI. */
  today: DailyActive | null
  courses: CourseEngagement[]
  activity: ActivityCount[]
  topContent: TopContent[]
}

export type BreakdownRow = {
  id: string
  name: string
  /** Org count — partner level only. */
  orgs: number | null
  members: number
  active: number
  completions: number
}

/** The members a breakdown's rows don't cover. */
export type BreakdownRemainder = {
  kind: 'unpartnered' | 'individuals'
  orgs: number | null
  members: number
  active: number
  completions: number
}

export type AnalyticsBreakdown = {
  level: 'partner' | 'organization'
  partnerName: string | null
  totalRows: number
  rows: BreakdownRow[]
  remainder: BreakdownRemainder | null
}

export type RetentionCohort = {
  /** Monday the cohort's first-active week starts on (YYYY-MM-DD). */
  start: string
  size: number
  /** Index k = weeks since the cohort week; `active` members that week. */
  weeks: { k: number; active: number }[]
}

export type AnalyticsRetention = {
  tz: string
  thisWeek: string
  cohorts: RetentionCohort[]
}

/**
 * Why a section couldn't load, so the page can say something true:
 * 'missing' = the analytics functions aren't installed (migration not run),
 * 'timeout' = the range was too heavy to compute in time, 'other' = anything
 * else (see the server log).
 */
export type AnalyticsFailure = 'missing' | 'timeout' | 'other'

export type AnalyticsSection = 'overview' | 'breakdown' | 'retention'

export type AnalyticsDashboard = {
  overview: AnalyticsOverview | null
  breakdown: AnalyticsBreakdown | null
  retention: AnalyticsRetention | null
  /** Why each section didn't load; null where it did. */
  failures: Record<AnalyticsSection, AnalyticsFailure | null>
}

// ── Defensive JSON readers ────────────────────────────────────────

type Json = Record<string, unknown>

function obj(v: unknown): Json {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {}
}

function arr(v: unknown): Json[] {
  return Array.isArray(v) ? v.map(obj) : []
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : num(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function parseOverview(raw: unknown): AnalyticsOverview {
  const o = obj(raw)
  const range = obj(o.range)
  const k = obj(o.kpis)
  return {
    range: {
      days: num(range.days),
      tz: str(range.tz),
      start: str(range.start),
      end: str(range.end),
      today: str(range.today),
    },
    trackingStarted: strOrNull(o.tracking_started),
    kpis: {
      activeUsers: num(k.active_users),
      activeUsersPrev: num(k.active_users_prev),
      avgDailyActive: num(k.avg_daily_active),
      avgDailyActivePrev: num(k.avg_daily_active_prev),
      avgDailyDays: num(k.avg_daily_days),
      avgDailyDaysPrev: num(k.avg_daily_days_prev),
      completions: num(k.completions),
      completionsPrev: num(k.completions_prev),
      membersTotal: num(k.members_total),
      newMembers: num(k.new_members),
      newMembersPrev: num(k.new_members_prev),
    },
    daily: arr(o.daily).map((d) => ({ day: str(d.day), active: num(d.active) })),
    today: o.today ? { day: str(obj(o.today).day), active: num(obj(o.today).active) } : null,
    courses: arr(o.courses).map((c) => ({
      slug: str(c.slug),
      title: str(c.title),
      shortTitle: str(c.short_title),
      inProgram: c.in_program === true,
      isPublished: c.is_published === true,
      visits: num(c.visits),
      learners: num(c.learners),
      completions: num(c.completions),
    })),
    activity: arr(o.activity).map((a) => ({
      event: str(a.event),
      events: num(a.events),
      users: num(a.users),
    })),
    topContent: arr(o.top_content).map((t) => ({
      id: str(t.id),
      title: strOrNull(t.title),
      sequenceNum: numOrNull(t.sequence_num),
      version: strOrNull(t.version),
      courseSlug: str(t.course_slug),
      courseTitle: strOrNull(t.course_title),
      completions: num(t.completions),
    })),
  }
}

function parseBreakdown(raw: unknown): AnalyticsBreakdown {
  const o = obj(raw)
  const rem = o.remainder ? obj(o.remainder) : null
  return {
    level: o.level === 'organization' ? 'organization' : 'partner',
    partnerName: strOrNull(o.partner_name),
    totalRows: num(o.total_rows),
    rows: arr(o.rows).map((r) => ({
      id: str(r.id),
      name: str(r.name),
      orgs: numOrNull(r.orgs),
      members: num(r.members),
      active: num(r.active),
      completions: num(r.completions),
    })),
    remainder: rem
      ? {
          kind: rem.kind === 'individuals' ? 'individuals' : 'unpartnered',
          orgs: numOrNull(rem.orgs),
          members: num(rem.members),
          active: num(rem.active),
          completions: num(rem.completions),
        }
      : null,
  }
}

function parseRetention(raw: unknown): AnalyticsRetention {
  const o = obj(raw)
  return {
    tz: str(o.tz),
    thisWeek: str(o.this_week),
    cohorts: arr(o.cohorts).map((c) => ({
      start: str(c.start),
      size: num(c.size),
      weeks: arr(c.weeks).map((w) => ({ k: num(w.k), active: num(w.active) })),
    })),
  }
}

// ── Fetchers ──────────────────────────────────────────────────────

/**
 * Load the whole dashboard in one parallel round of RPCs. `tz` omitted =
 * the RPCs use the calling admin's own profile time zone.
 */
export async function fetchAnalyticsDashboard(
  supabase: MaybeClient,
  opts: { days: AnalyticsRange; scope: AnalyticsScope; tz?: string | null }
): Promise<AnalyticsDashboard> {
  const scopeArgs = {
    _partner_id: opts.scope.partnerId,
    _unpartnered: opts.scope.unpartnered,
    _tz: opts.tz ?? null,
  }
  const [overviewRes, breakdownRes, retentionRes] = await Promise.all([
    supabase.rpc('admin_analytics_overview', { _days: opts.days, ...scopeArgs }),
    supabase.rpc('admin_analytics_breakdown', { _days: opts.days, ...scopeArgs }),
    supabase.rpc('admin_analytics_retention', scopeArgs),
  ])

  if (overviewRes.error) console.error('admin_analytics_overview error', overviewRes.error)
  if (breakdownRes.error) console.error('admin_analytics_breakdown error', breakdownRes.error)
  if (retentionRes.error) console.error('admin_analytics_retention error', retentionRes.error)

  return {
    overview: overviewRes.error ? null : parseOverview(overviewRes.data),
    breakdown: breakdownRes.error ? null : parseBreakdown(breakdownRes.data),
    retention: retentionRes.error ? null : parseRetention(retentionRes.data),
    failures: {
      overview: classifyFailure(overviewRes.error),
      breakdown: classifyFailure(breakdownRes.error),
      retention: classifyFailure(retentionRes.error),
    },
  }
}

/**
 * 'missing' = nothing will load until the migration runs; 'timeout' = a
 * lighter range (or a quieter moment) may; anything else is unexpected.
 */
function classifyFailure(error: { code?: string } | null): AnalyticsFailure | null {
  if (!error) return null
  // PGRST202: PostgREST can't find the function; 42883: Postgres "function does not exist".
  if (error.code === 'PGRST202' || error.code === '42883') return 'missing'
  // 57014: statement_timeout cancelled the query.
  if (error.code === '57014') return 'timeout'
  return 'other'
}

export type PartnerOption = { id: string; name: string }

/**
 * Every partner, for the dashboard's partner filter (admins can read all).
 * Null when the query failed — not the same as "there are no partners".
 */
export async function fetchPartnerOptions(
  supabase: MaybeClient
): Promise<PartnerOption[] | null> {
  const { data, error } = await supabase
    .from('partners')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) {
    console.error('fetchPartnerOptions error', error)
    return null
  }
  return ((data ?? []) as { id: string; name: string }[]).map((p) => ({
    id: p.id,
    name: p.name,
  }))
}
