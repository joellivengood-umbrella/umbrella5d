'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AssignmentEntry } from '@/lib/org-queries'

/**
 * Renders a member's current assignments with a Remove button on each
 * row. Empty state when there are none.
 *
 * Client component because the Remove action needs Supabase + router
 * refresh. The empty state could live server-side but it's small and
 * keeping everything in one component is cleaner.
 */
export function AssignmentList({
  assignments,
  memberName,
}: {
  assignments: AssignmentEntry[]
  memberName: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (assignments.length === 0) {
    return (
      <p className="assignment-empty">
        No assignments yet. Use the form below to add the first one.
      </p>
    )
  }

  async function handleRemove(assignmentId: string, label: string) {
    const ok = window.confirm(
      `Remove "${label}" from ${memberName}'s assignments?`
    )
    if (!ok) return

    setRemovingId(assignmentId)
    setError(null)
    const { error: delErr } = await supabase
      .from('content_assignments')
      .delete()
      .eq('id', assignmentId)
    setRemovingId(null)

    if (delErr) {
      console.error('AssignmentList remove error', delErr)
      setError('Could not remove. Please try again.')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <>
      <ul className="assignment-list">
        {assignments.map((a) => {
          const courseLabel = formatCourseLabel(a.type, a.metadataVersion)
          const itemLabel =
            a.title ?? `${courseLabel} ${a.sequenceNum}`
          const fullLabel = `${courseLabel} · ${itemLabel}`
          const busy = removingId === a.id || pending

          return (
            <li key={a.id} className="assignment-row">
              <div className="assignment-row__info">
                <span className={`assignment-row__course course-tag-${a.type}`}>
                  {courseLabel}
                </span>
                <span className="assignment-row__title">
                  #{a.sequenceNum}
                  {a.title ? ` · ${a.title}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="member-actions__btn member-actions__btn--danger"
                onClick={() => handleRemove(a.id, fullLabel)}
                disabled={busy}
              >
                {removingId === a.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="assignment-error">{error}</p>}
    </>
  )
}

function formatCourseLabel(
  type: 'bss' | 'eos' | 'potd' | 'machine',
  version: string | null
): string {
  switch (type) {
    case 'bss':
      return version ? `BSS ${version}` : 'BSS'
    case 'eos':
      return 'EOS'
    case 'potd':
      return 'POTD'
    case 'machine':
      return '5D Machine'
  }
}
