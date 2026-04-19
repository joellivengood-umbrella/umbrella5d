'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Toggles completion state for a single content_item.
 * Writes to (or deletes from) `content_progress` under the current user's
 * session. Optimistic UI with rollback on error.
 *
 * Generalization of the old LessonCompleteButton — same UX, but keyed by
 * content_item UUID instead of "m-l" string IDs.
 */
export function MarkCompleteButton({
  userId,
  contentItemId,
  initialDone,
}: {
  userId: string
  contentItemId: string
  initialDone: boolean
}) {
  const [isDone, setIsDone] = useState(initialDone)
  const [pending, startTransition] = useTransition()

  async function toggle() {
    const nextDone = !isDone
    setIsDone(nextDone)

    startTransition(async () => {
      const supabase = createClient()
      if (nextDone) {
        const { error } = await supabase
          .from('content_progress')
          .upsert(
            {
              user_id: userId,
              content_item_id: contentItemId,
            },
            { onConflict: 'user_id,content_item_id' }
          )
        if (error) setIsDone(!nextDone)
      } else {
        const { error } = await supabase
          .from('content_progress')
          .delete()
          .eq('user_id', userId)
          .eq('content_item_id', contentItemId)
        if (error) setIsDone(!nextDone)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        'btn btn--primary btn--lg lesson-complete-btn' +
        (isDone ? ' lesson-complete-btn--done' : '')
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{isDone ? 'Completed — Click to Undo' : 'Mark Complete'}</span>
    </button>
  )
}
