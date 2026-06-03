import Link from 'next/link'
import type { ContentItem } from '@/lib/courses'
import { PotdPlayButton } from '@/components/potd/PotdPlayButton'

/**
 * "Today's Pod" widget on the dashboard.
 *
 * POTD (Pod of the Day) is bonus content — it sits separately from
 * the Umbrella Program courses. This widget highlights today's
 * specific unlocked episode so users have a one-click path into the
 * daily content without navigating into the POTD index.
 *
 * Three render states, in order of likelihood:
 *
 *   1. Org member + POTD launched + today's episode exists:
 *      Full widget with episode info and a Listen CTA. If the user
 *      has already completed today's episode, the CTA shifts to a
 *      "heard today" indicator with a Replay link.
 *
 *   2. Org member + POTD NOT launched yet:
 *      Soft prompt with a link to /courses/potd (where the manager
 *      sees the Launch button and a member sees a "ask your manager"
 *      explainer).
 *
 *   3. Individual user (no org_id):
 *      Widget hidden entirely. POTD is org-scoped — surfacing it for
 *      a user who can't access it would just be noise.
 *
 * No interactivity needed beyond the link, so this stays a server
 * component.
 */
export function TodayPodWidget({
  orgId,
  isLaunched,
  todayItem,
  todayItemDone,
}: {
  orgId: string | null
  isLaunched: boolean
  todayItem: ContentItem | null
  todayItemDone: boolean
}) {
  // State 3: individuals see nothing.
  if (!orgId) return null

  // State 2: org member, POTD not launched yet.
  if (!isLaunched || !todayItem) {
    return (
      <section className="today-pod today-pod--pending">
        <div className="today-pod__body">
          <div className="today-pod__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="today-pod__copy">
            <p className="today-pod__eyebrow">Daily Pod · Bonus</p>
            <p className="today-pod__title">
              Daily episodes unlock once your team launches POTD.
            </p>
          </div>
        </div>
        <Link href="/courses/potd" className="today-pod__cta">
          <span>Learn more</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </section>
    )
  }

  // State 1: org member, POTD launched, today's episode exists.
  const itemTitle = todayItem.title ?? `Episode ${todayItem.sequence_num}`
  const durationLabel =
    todayItem.duration_mins != null
      ? `${todayItem.duration_mins} min · Bonus`
      : 'Bonus'

  return (
    <section
      className={`today-pod${todayItemDone ? ' today-pod--done' : ''}`}
    >
      <div className="today-pod__body">
        <div className="today-pod__icon" aria-hidden="true">
          {todayItemDone ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </div>
        <div className="today-pod__copy">
          <p className="today-pod__eyebrow">
            {todayItemDone ? "Today's Pod · Heard" : "Today's Pod · Bonus"}
          </p>
          <p className="today-pod__title">
            Episode {todayItem.sequence_num} — {itemTitle}
          </p>
          <p className="today-pod__meta">{durationLabel}</p>
        </div>
      </div>
      <PotdPlayButton
        itemId={todayItem.id}
        episodeNum={todayItem.sequence_num}
        title={itemTitle}
        mediaUrl={todayItem.media_url}
        className="today-pod__cta"
        idleLabel={todayItemDone ? 'Replay' : 'Listen'}
      />
    </section>
  )
}
