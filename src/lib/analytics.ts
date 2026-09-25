import { createClient } from '@/lib/supabase/client'

/**
 * First-party product analytics.
 *
 * `track()` writes one row to public.analytics_events under the current user's
 * session (RLS: insert-own). It is deliberately fire-and-forget and never
 * throws — analytics must never block, slow, or break a user action. Pass the
 * `userId` the calling component already has (every call site does), so we
 * don't spend a network round-trip re-fetching the user just to log an event.
 *
 * Keep `properties` free of personal data: ids, counts, and slugs only — never
 * names, emails, or the text a user typed. Reports join to profiles for
 * identity; the event stream itself stays pseudonymous and portable.
 */

export type AnalyticsEvent =
  | 'content_completed'
  | 'content_uncompleted'
  | 'potd_played'
  | 'potd_completed'
  | 'machine_block_checked'
  | 'machine_block_unchecked'
  | 'machine_activity_saved'
  | 'course_opened'
  | 'login'

export type AnalyticsProps = Record<string, string | number | boolean | null>

export function track(
  userId: string,
  event: AnalyticsEvent,
  properties: AnalyticsProps = {},
): void {
  // Fire-and-forget: start the insert but never make the caller await it.
  void (async () => {
    try {
      const supabase = createClient()
      await supabase
        .from('analytics_events')
        .insert({ user_id: userId, event_name: event, properties })
    } catch {
      // Swallow — a dropped analytics event must never surface to the user.
    }
  })()
}
