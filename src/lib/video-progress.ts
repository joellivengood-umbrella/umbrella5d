import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * How much of each video a member has watched (public.video_progress).
 * A video's source id is its content_items id (single-video lessons) or its
 * lesson_blocks id (a video block in a 5D Machine lesson).
 */

/** A video counts as watched once this share of it has been played. */
export const WATCH_THRESHOLD = 0.9

export type VideoWatch = {
  position: number
  furthest: number
  duration: number
}

export type VideoWatchMap = Record<string, VideoWatch>

export function isWatched(w: VideoWatch | undefined): boolean {
  return Boolean(w && w.duration > 0 && w.furthest >= w.duration * WATCH_THRESHOLD)
}

/** Our player only plays uploaded video files (no Vimeo/YouTube embeds). */
export function isVideoFileUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.(mp4|webm|mov)(\?|$)/i.test(url.trim()))
}

/** The member's saved progress for these videos (missing = not started). */
export async function fetchVideoProgress(
  supabase: SupabaseClient,
  userId: string,
  sourceIds: string[]
): Promise<VideoWatchMap> {
  if (sourceIds.length === 0) return {}
  const { data, error } = await supabase
    .from('video_progress')
    .select('source_id, position_seconds, furthest_seconds, duration_seconds')
    .eq('user_id', userId)
    .in('source_id', sourceIds)
  if (error) {
    console.error('fetchVideoProgress error', error)
    return {}
  }
  const map: VideoWatchMap = {}
  for (const r of (data ?? []) as {
    source_id: string
    position_seconds: number
    furthest_seconds: number
    duration_seconds: number
  }[]) {
    map[r.source_id] = {
      position: Number(r.position_seconds) || 0,
      furthest: Number(r.furthest_seconds) || 0,
      duration: Number(r.duration_seconds) || 0,
    }
  }
  return map
}

/** Save progress (fire-and-forget; the database only ever moves "furthest" forward). */
export async function saveVideoProgress(
  supabase: SupabaseClient,
  sourceId: string,
  position: number,
  duration: number
): Promise<void> {
  if (!(duration > 0) || !Number.isFinite(position)) return
  const { error } = await supabase.rpc('save_video_progress', {
    _source_id: sourceId,
    _position: Math.max(0, position),
    _duration: duration,
  })
  if (error) console.error('save_video_progress error', error)
}
