'use client'

import { useEffect, useRef } from 'react'
import { track, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics'

/**
 * Fires a single analytics event when it mounts, then renders nothing.
 *
 * Drop it into a server component (like a course landing page) to record a
 * page view — e.g.
 *   <TrackView userId={user.id} event="course_opened" props={{ slug: course.slug }} />
 *
 * The ref guard keeps it to one event per mount even if React re-runs the
 * effect (dev StrictMode's double-invoke, or a new `props` object identity).
 * A fresh route mount is a fresh instance, so navigating into a course fires
 * exactly once per visit.
 */
export function TrackView({
  userId,
  event,
  props,
}: {
  userId: string
  event: AnalyticsEvent
  props?: AnalyticsProps
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track(userId, event, props ?? {})
  }, [userId, event, props])
  return null
}
