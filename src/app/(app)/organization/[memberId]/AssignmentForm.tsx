'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MBA_VERSIONS, type MbaVersion, type ContentItem } from '@/lib/courses'

type AllItems = {
  mba: ContentItem[]
  eos: ContentItem[]
  potd: ContentItem[]
  machine: ContentItem[]
}

type Course = 'mba' | 'eos' | 'potd' | 'machine'

/**
 * Inline form for assigning a single content_item to a member.
 *
 * Three-step shape: pick a course, then (for MBA only) pick a version,
 * then pick the specific item. Items already assigned to this member
 * are filtered out of the dropdown so we don't suggest duplicates —
 * the underlying UNIQUE (user_id, content_item_id) would reject the
 * insert anyway, but the UX is cleaner if we never let them pick a dup
 * in the first place.
 */
export function AssignmentForm({
  orgId,
  memberUserId,
  currentUserId,
  allItems,
  alreadyAssignedIds,
}: {
  orgId: string
  memberUserId: string
  currentUserId: string
  allItems: AllItems
  alreadyAssignedIds: Set<string>
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [course, setCourse] = useState<Course>('mba')
  const [mbaVersion, setMbaVersion] = useState<MbaVersion>('5hr')
  const [contentItemId, setContentItemId] = useState<string>('')

  // Eligible items for the currently selected course (and MBA version),
  // minus anything already assigned to this member.
  const eligibleItems = useMemo<ContentItem[]>(() => {
    let items: ContentItem[]
    if (course === 'mba') {
      items = allItems.mba.filter(
        (it) =>
          (it.metadata as { version?: MbaVersion } | null)?.version ===
          mbaVersion
      )
    } else {
      items = allItems[course]
    }
    return items.filter((it) => !alreadyAssignedIds.has(it.id))
  }, [course, mbaVersion, allItems, alreadyAssignedIds])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contentItemId) {
      setError('Please pick an item to assign.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { error: insErr } = await supabase
      .from('content_assignments')
      .insert({
        org_id: orgId,
        user_id: memberUserId,
        content_item_id: contentItemId,
        assigned_by: currentUserId,
      })
    setSubmitting(false)

    if (insErr) {
      // 23505 = unique_violation. Reached when another manager (or
      // a stale tab) assigned the same item between us last loading
      // the page and clicking Add. Tell the manager the truth — the
      // earlier behavior was to silently refresh, which made the
      // collision invisible. Still refresh so the dropdown re-filters
      // out the now-assigned item.
      if (insErr.code === '23505') {
        setError(
          'This item is already assigned to this member. The list has been refreshed.'
        )
        // Clear the selection — the item is about to disappear from
        // the dropdown after refresh, leaving the select in a stale
        // state otherwise.
        setContentItemId('')
        startTransition(() => router.refresh())
        return
      }
      console.error('AssignmentForm insert error', insErr)
      setError(
        'Could not save the assignment. Please try again.'
      )
      return
    }

    setContentItemId('')
    startTransition(() => router.refresh())
  }

  return (
    <form className="assignment-form settings-form" onSubmit={handleSubmit}>
      <div className="assignment-form__row">
        <label className="settings-field">
          <span>Course</span>
          <select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value as Course)
              setContentItemId('')
            }}
          >
            <option value="mba">MBA</option>
            <option value="eos">EOS</option>
            <option value="potd">POTD</option>
            <option value="machine">5D Machine</option>
          </select>
        </label>

        {course === 'mba' && (
          <label className="settings-field">
            <span>Version</span>
            <select
              value={mbaVersion}
              onChange={(e) => {
                setMbaVersion(e.target.value as MbaVersion)
                setContentItemId('')
              }}
            >
              {MBA_VERSIONS.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="settings-field assignment-form__item">
          <span>Item</span>
          <select
            value={contentItemId}
            onChange={(e) => setContentItemId(e.target.value)}
          >
            <option value="">— Pick an item —</option>
            {eligibleItems.map((it) => (
              <option key={it.id} value={it.id}>
                #{it.sequence_num}
                {it.title ? ` — ${it.title}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="settings-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || pending || !contentItemId}
        >
          {submitting ? 'Adding…' : 'Add assignment'}
        </button>
        {error && (
          <span className="settings-status settings-status--error">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}
