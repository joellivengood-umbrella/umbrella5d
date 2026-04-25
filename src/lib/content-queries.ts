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
 * Fetch the user's preference flags used by course list pages.
 * Always resolves — falls back to safe defaults on error or missing row.
 */
export async function fetchUserSettings(
  supabase: MaybeClient,
  userId: string
): Promise<{
  showCompleted: boolean
  timezone: string
  orgId: string | null
}> {
  const { data } = await supabase
    .from('profiles')
    .select('show_completed_items, timezone, org_id')
    .eq('id', userId)
    .single()

  return {
    showCompleted:
      (data?.show_completed_items as boolean | undefined) ?? true,
    timezone: (data?.timezone as string | undefined) ?? 'America/Chicago',
    orgId: (data?.org_id as string | null | undefined) ?? null,
  }
}
