import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentItem, ContentType, BssVersion } from './courses'

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
  type: ContentType,
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
    return []
  }
  return (data ?? []) as ContentItem[]
}

/**
 * Fetch a single content item by type, sequence_num, and (optionally) bss version.
 * Returns null if not found.
 */
export async function fetchContentItem(
  supabase: MaybeClient,
  type: ContentType,
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

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('fetchContentItem error', error)
    return null
  }
  return (data as ContentItem) ?? null
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
    return new Set()
  }
  return new Set((data ?? []).map((r: { content_item_id: string }) => r.content_item_id))
}

/**
 * Count totals per course type for the dashboard / index tiles.
 * Returns a map like { bss: 72, eos: 9, potd: 125, machine: 28 }.
 */
export async function fetchTotalsByType(
  supabase: MaybeClient
): Promise<Record<ContentType, number>> {
  const { data, error } = await supabase
    .from('content_items')
    .select('type')
    .eq('is_published', true)

  const totals: Record<ContentType, number> = {
    bss: 0,
    eos: 0,
    potd: 0,
    machine: 0,
  }
  if (error) {
    console.error('fetchTotalsByType error', error)
    return totals
  }
  for (const row of data ?? []) {
    const t = (row as { type: ContentType }).type
    if (t in totals) totals[t] += 1
  }
  return totals
}

/**
 * Count completed items per course type for the given user.
 * Returns a map like { bss: 3, eos: 1, potd: 0, machine: 5 }.
 */
export async function fetchCompletedCountsByType(
  supabase: MaybeClient,
  userId: string
): Promise<Record<ContentType, number>> {
  const { data, error } = await supabase
    .from('content_progress')
    .select('content_items!inner(type)')
    .eq('user_id', userId)

  const counts: Record<ContentType, number> = {
    bss: 0,
    eos: 0,
    potd: 0,
    machine: 0,
  }
  if (error) {
    console.error('fetchCompletedCountsByType error', error)
    return counts
  }
  // Supabase types the embedded relation as an array even when it's a
  // single parent via FK. Normalize to handle either shape.
  for (const row of data ?? []) {
    const raw = (row as {
      content_items:
        | { type: ContentType }
        | { type: ContentType }[]
        | null
    }).content_items
    const item = Array.isArray(raw) ? raw[0] : raw
    if (item && item.type in counts) counts[item.type] += 1
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
 * The next thing the user should do, based on their most recent
 * completion. Returns null when:
 *   - the user has no completions yet,
 *   - the most-recent course is finished (no next item exists),
 *   - the next item is a still-locked POTD episode.
 *
 * `unlockedThroughDay` is the user's current POTD unlock window
 * (computed from their org's launch + their timezone). Pass 0 for
 * individuals or orgs that haven't launched.
 */
export async function fetchResumeTarget(
  supabase: MaybeClient,
  userId: string,
  unlockedThroughDay: number
): Promise<ResumeTarget | null> {
  // 1. Find the user's most recent completion. We pull the joined
  //    content_items row in one trip so we know what course/sequence
  //    they were last on.
  const { data: rows, error: lastErr } = await supabase
    .from('content_progress')
    .select(
      'completed_at, content_items!inner(type, sequence_num, metadata)'
    )
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1)

  if (lastErr) {
    console.error('fetchResumeTarget last completion error', lastErr)
    throw new Error(`fetchResumeTarget failed: ${lastErr.message}`)
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

  // POTD gate: don't suggest a locked episode.
  if (courseSlug === 'potd' && nextSeq > unlockedThroughDay) {
    return null
  }

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

  const { data: nextItem, error: nextErr } = await nextQuery.maybeSingle()

  if (nextErr) {
    console.error('fetchResumeTarget next item error', nextErr)
    throw new Error(`fetchResumeTarget failed: ${nextErr.message}`)
  }
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
