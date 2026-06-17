import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentItem, ContentType, BssVersion } from './courses'
import { fetchProgramSlugs } from './course-queries'

/**
 * Server-side data helpers for reading content_items + content_progress.
 * Keeps Supabase-query shape out of the page components.
 */

type MaybeClient = SupabaseClient // relaxed typing — our schema isn't codegen'd

const ITEM_COLUMNS =
  'id, type, sequence_num, title, description, media_url, duration_mins, parent_id, metadata, is_published'

/**
 * Fetch all published content_items of a given type, ordered by sequence_num.
 * If `bssVersion` is provided, filters BSS rows by metadata.version.
 */
export async function fetchContentItems(
  supabase: MaybeClient,
  type: string,
  bssVersion?: BssVersion
): Promise<ContentItem[]> {
  let query = supabase
    .from('content_items')
    .select(ITEM_COLUMNS)
    .eq('type', type)
    .eq('is_published', true)
    .order('sequence_num', { ascending: true })

  if (type === 'bss' && bssVersion) {
    // metadata is jsonb; Supabase supports `->>` filters via `.eq`.
    query = query.eq('metadata->>version', bssVersion)
  }

  const { data, error } = await query
  if (error) {
    console.error('fetchContentItems error', error)
    throw new Error(`fetchContentItems failed: ${error.message}`)
  }
  return (data ?? []) as ContentItem[]
}

/**
 * Fetch a single content item by type, sequence_num, and (optionally) bss version.
 * Returns null if not found.
 */
export async function fetchContentItem(
  supabase: MaybeClient,
  type: string,
  sequenceNum: number,
  bssVersion?: BssVersion
): Promise<ContentItem | null> {
  let query = supabase
    .from('content_items')
    .select(ITEM_COLUMNS)
    .eq('type', type)
    .eq('sequence_num', sequenceNum)
    .eq('is_published', true)

  if (type === 'bss' && bssVersion) {
    query = query.eq('metadata->>version', bssVersion)
  }

  // NOT .maybeSingle(): two published items can share a (type,
  // sequence_num) and maybeSingle() throws on >1 row. Take the first.
  const { data, error } = await query
    .order('id', { ascending: true })
    .limit(1)
  if (error) {
    console.error('fetchContentItem error', error)
    throw new Error(`fetchContentItem failed: ${error.message}`)
  }
  const rows = (data ?? []) as ContentItem[]
  return rows[0] ?? null
}

/**
 * Lightweight POTD episode list for the dashboard's Daily Pod widget —
 * only the columns the widget needs. Skips the heavy description /
 * metadata fields, which matter because the pod catalog grows
 * unbounded over time. Ordered by sequence_num ascending so the caller
 * can pick the first unheard episode.
 */
export type PotdEpisodeStub = Pick<
  ContentItem,
  'id' | 'sequence_num' | 'title' | 'media_url' | 'duration_mins'
>

export async function fetchPotdEpisodeStubs(
  supabase: MaybeClient
): Promise<PotdEpisodeStub[]> {
  const { data, error } = await supabase
    .from('content_items')
    .select('id, sequence_num, title, media_url, duration_mins')
    .eq('type', 'potd')
    .eq('is_published', true)
    .order('sequence_num', { ascending: true })

  if (error) {
    console.error('fetchPotdEpisodeStubs error', error)
    throw new Error(`fetchPotdEpisodeStubs failed: ${error.message}`)
  }
  return (data ?? []) as PotdEpisodeStub[]
}

/**
 * Fetch the set of content_item IDs the given user has marked complete.
 * Returns a Set for O(1) membership checks.
 */
export async function fetchCompletedItemIds(
  supabase: MaybeClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('content_progress')
    .select('content_item_id')
    .eq('user_id', userId)

  if (error) {
    console.error('fetchCompletedItemIds error', error)
    throw new Error(`fetchCompletedItemIds failed: ${error.message}`)
  }
  return new Set((data ?? []).map((r: { content_item_id: string }) => r.content_item_id))
}

/**
 * Count totals per course type for the dashboard / index tiles.
 * Returns a map keyed by course slug, e.g. { bss: 72, eos: 9, machine: 28 }.
 *
 * Keyed by `string` (not the legacy 4-slug union) and accumulated for every
 * type encountered — a new course's items must never be silently dropped
 * from a progress denominator. Callers default a missing slug to 0.
 */
export async function fetchTotalsByType(
  supabase: MaybeClient
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('content_items')
    .select('type')
    .eq('is_published', true)

  if (error) {
    console.error('fetchTotalsByType error', error)
    throw new Error(`fetchTotalsByType failed: ${error.message}`)
  }
  const totals: Record<string, number> = {}
  for (const row of data ?? []) {
    const t = (row as { type: string }).type
    totals[t] = (totals[t] ?? 0) + 1
  }
  return totals
}

/**
 * Count completed items per course type for the given user.
 * Returns a map keyed by course slug, e.g. { bss: 3, eos: 1, machine: 5 }.
 *
 * Like fetchTotalsByType, keyed by `string` and accumulated for every type —
 * a new course's completions must never be dropped. Callers default to 0.
 */
export async function fetchCompletedCountsByType(
  supabase: MaybeClient,
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('content_progress')
    .select('content_items!inner(type)')
    .eq('user_id', userId)

  if (error) {
    console.error('fetchCompletedCountsByType error', error)
    throw new Error(`fetchCompletedCountsByType failed: ${error.message}`)
  }
  const counts: Record<string, number> = {}
  // Supabase types the embedded relation as an array even when it's a
  // single parent via FK. Normalize to handle either shape.
  for (const row of data ?? []) {
    const raw = (row as {
      content_items: { type: string } | { type: string }[] | null
    }).content_items
    const item = Array.isArray(raw) ? raw[0] : raw
    if (item) counts[item.type] = (counts[item.type] ?? 0) + 1
  }
  return counts
}

/**
 * Shape of "what should the user do next" — fed to the dashboard's
 * Continue Where You Left Off card. Intentionally raw: href + display
 * strings are derived in the UI layer so this file stays free of routing
 * and copy decisions.
 */
export type ResumeTarget = {
  courseSlug: ContentType
  bssVersion: BssVersion | null
  itemTitle: string | null
  sequenceNum: number
}

/**
 * The next thing the user should do in the Umbrella Program, based on
 * their most recent program completion. POTD episodes are excluded —
 * POTD is bonus content, not part of "where you left off." A user who
 * has only ever completed POTD episodes gets null here (no program
 * thread to resume).
 *
 * Returns null when:
 *   - the user has no program-course completions,
 *   - the most-recent course is finished (no next item exists),
 *   - the most-recent completion was BSS but missing metadata.version
 *     (would produce a broken URL).
 */
export async function fetchResumeTarget(
  supabase: MaybeClient,
  userId: string
): Promise<ResumeTarget | null> {
  // 1. Find the user's most recent program-course completion. Only
  //    in-program courses count as "where you left off" — bonus tracks
  //    (e.g. POTD) are filtered server-side via the embedded-table .in
  //    so we don't have to fetch and discard them. The set of in-program
  //    slugs is data (courses.in_program), not a hardcoded 'potd'.
  const programSlugs = await fetchProgramSlugs(supabase)
  if (programSlugs.length === 0) return null
  const { data: rows, error: lastErr } = await supabase
    .from('content_progress')
    .select(
      'completed_at, content_items!inner(type, sequence_num, metadata)'
    )
    .eq('user_id', userId)
    .in('content_items.type', programSlugs)
    .order('completed_at', { ascending: false })
    .limit(1)

  if (lastErr) {
    // The resume card is non-essential — never let it crash the page.
    console.error('fetchResumeTarget last completion error', lastErr)
    return null
  }
  if (!rows || rows.length === 0) return null

  // Supabase types embedded relations as either an object or an array
  // depending on FK shape. content_progress -> content_items is many-to-one,
  // so it should always be an object here, but normalize defensively.
  const rawItem = (rows[0] as {
    content_items:
      | { type: ContentType; sequence_num: number; metadata: Record<string, unknown> | null }
      | { type: ContentType; sequence_num: number; metadata: Record<string, unknown> | null }[]
      | null
  }).content_items
  const lastItem = Array.isArray(rawItem) ? rawItem[0] : rawItem
  if (!lastItem) return null

  const courseSlug = lastItem.type
  const lastSeq = lastItem.sequence_num
  const lastMeta = lastItem.metadata as { version?: BssVersion } | null
  const bssVersion: BssVersion | null =
    courseSlug === 'bss' ? (lastMeta?.version ?? null) : null

  // BSS items must carry a metadata.version — every BSS route lives at
  // /courses/bss/[version]/[n]. If the row is missing the version we
  // can't build a valid URL, so refuse to suggest it rather than ship
  // a broken link to the user.
  if (courseSlug === 'bss' && !bssVersion) return null

  const nextSeq = lastSeq + 1

  // 2. Find the next published item in the same course (and, for BSS,
  //    the same version).
  let nextQuery = supabase
    .from('content_items')
    .select('type, sequence_num, title, metadata')
    .eq('type', courseSlug)
    .eq('sequence_num', nextSeq)
    .eq('is_published', true)

  if (courseSlug === 'bss' && bssVersion) {
    nextQuery = nextQuery.eq('metadata->>version', bssVersion)
  }

  // NOT .maybeSingle(): published items can share a (type, sequence_num)
  // — e.g. a seeded 5D Machine lesson colliding with other content — and
  // maybeSingle() throws on >1 row, which previously 500'd the whole
  // dashboard. Take the first match; degrade to no-resume on any error.
  const { data: nextRows, error: nextErr } = await nextQuery
    .order('sequence_num', { ascending: true })
    .limit(1)

  if (nextErr) {
    console.error('fetchResumeTarget next item error', nextErr)
    return null
  }
  const nextItem = (nextRows ?? [])[0]
  if (!nextItem) return null

  return {
    courseSlug,
    bssVersion,
    itemTitle: (nextItem.title as string | null) ?? null,
    sequenceNum: nextItem.sequence_num as number,
  }
}

/**
 * Fetch the user's preference flags used by course list pages.
 * Returns safe defaults if the user has no profile row yet (which can
 * happen briefly between auth signup and the profile-creation trigger),
 * but throws on real DB errors so they aren't silently masked.
 */
export async function fetchUserSettings(
  supabase: MaybeClient,
  userId: string
): Promise<{
  showCompleted: boolean
  timezone: string
  orgId: string | null
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('show_completed_items, timezone, org_id')
    .eq('id', userId)
    .maybeSingle()

  // .maybeSingle() returns { data: null, error: null } when the profile
  // row doesn't exist yet. Any non-null error is a real failure — let
  // the Next.js error boundary handle it instead of silently rendering
  // the page with default settings.
  if (error) {
    console.error('fetchUserSettings error', error)
    throw new Error(`fetchUserSettings failed: ${error.message}`)
  }

  return {
    showCompleted:
      (data?.show_completed_items as boolean | undefined) ?? true,
    timezone: (data?.timezone as string | undefined) ?? 'America/Chicago',
    orgId: (data?.org_id as string | null | undefined) ?? null,
  }
}

/**
 * Daily-completion streak for the dashboard. A "day" is a calendar day
 * in the user's timezone on which they completed at least one item.
 * The streak is the run of consecutive such days ending today (or
 * yesterday, so it stays "alive but at risk" before today's first
 * completion). Also returns this week's Mon–Sun activity for the strip.
 */
export type StreakDay = {
  label: string
  state: 'done' | 'today' | 'missed' | 'future'
}
export type StreakData = {
  streak: number
  activeToday: boolean
  weekDays: StreakDay[]
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function emptyWeek(): StreakDay[] {
  return WEEK_LABELS.map((label) => ({ label, state: 'missed' as const }))
}

/**
 * Never throws — a streak widget must not be able to take down the whole
 * dashboard. Any query/Intl failure degrades to a zero streak.
 */
export async function fetchStreak(
  supabase: MaybeClient,
  userId: string,
  timezone: string
): Promise<StreakData> {
  const tz = timezone || 'America/Chicago'

  // Stable integer day-index for the calendar day a timestamp falls on
  // in `tz`. Uses formatToParts (no locale string-format assumptions),
  // falling back to UTC if Intl can't resolve the zone. Pure calendar
  // math, so DST-proof.
  const dayIdx = (date: Date): number => {
    let y = date.getUTCFullYear()
    let m = date.getUTCMonth() + 1
    let d = date.getUTCDate()
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date)
      const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value)
      const py = pick('year')
      const pm = pick('month')
      const pd = pick('day')
      if (Number.isFinite(py) && Number.isFinite(pm) && Number.isFinite(pd)) {
        y = py
        m = pm
        d = pd
      }
    } catch {
      /* keep the UTC fallback */
    }
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  }

  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString()
    const { data, error } = await supabase
      .from('content_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', since)

    if (error) {
      // Degrade rather than break the dashboard.
      console.error('fetchStreak query error (non-fatal)', error)
    }

    const activeIdx = new Set<number>()
    for (const row of data ?? []) {
      const ts = (row as { completed_at: string | null }).completed_at
      if (ts) activeIdx.add(dayIdx(new Date(ts)))
    }

    const todayIdx = dayIdx(new Date())

    let streak = 0
    let cursor = activeIdx.has(todayIdx) ? todayIdx : todayIdx - 1
    while (activeIdx.has(cursor)) {
      streak += 1
      cursor -= 1
    }

    // Day-of-week straight from the day index (1970-01-01 was a Thursday),
    // avoiding any date-string parsing. 0=Sun … 6=Sat.
    const dow = (((todayIdx + 4) % 7) + 7) % 7
    const mondayOffset = (dow + 6) % 7
    const weekStart = todayIdx - mondayOffset
    const weekDays: StreakDay[] = WEEK_LABELS.map((label, i) => {
      const idx = weekStart + i
      let state: StreakDay['state']
      if (idx > todayIdx) state = 'future'
      else if (idx === todayIdx) state = activeIdx.has(idx) ? 'done' : 'today'
      else state = activeIdx.has(idx) ? 'done' : 'missed'
      return { label, state }
    })

    return { streak, activeToday: activeIdx.has(todayIdx), weekDays }
  } catch (e) {
    console.error('fetchStreak failed (non-fatal)', e)
    return { streak: 0, activeToday: false, weekDays: emptyWeek() }
  }
}
