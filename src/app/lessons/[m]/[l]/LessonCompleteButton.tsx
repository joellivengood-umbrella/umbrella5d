'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Toggles completion state for a single lesson.
 * Writes to (or deletes from) `lesson_progress` under the current user's
 * session. The dashboard re-fetches progress on window focus, so returning
 * to the dashboard after clicking this will reflect the new state.
 */
export function LessonCompleteButton({
  userId,
  lessonId,
  initialDone,
}: {
  userId: string
  lessonId: string
  initialDone: boolean
}) {
  const [isDone, setIsDone] = useState(initialDone)
  const [pending, startTransition] = useTransition()

  async function toggle() {
    const nextDone = !isDone
    // Optimistic update
    setIsDone(nextDone)

    startTransition(async () => {
      const supabase = createClient()
      if (nextDone) {
        const { error } = await supabase
          .from('lesson_progress')
          .upsert(
            { user_id: userId, lesson_id: lessonId, completed: true },
            { onConflict: 'user_id,lesson_id' }
          )
        if (error) {
          // Roll back on failure
          setIsDone(!nextDone)
        }
      } else {
        const { error } = await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', userId)
          .eq('lesson_id', lessonId)
        if (error) {
          setIsDone(!nextDone)
        }
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
      <span>{isDone ? 'Completed — Click to Undo' : 'Mark Lesson Complete'}</span>
    </button>
  )
}
