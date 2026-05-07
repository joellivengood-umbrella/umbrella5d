'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BSS_VERSIONS, type BssVersion, type ContentItem } from '@/lib/courses'

type AllItems = {
  bss: ContentItem[]
  eos: ContentItem[]
  potd: ContentItem[]
  machine: ContentItem[]
}

type Course = 'bss' | 'eos' | 'potd' | 'machine'

/**
 * Inline form for assigning a single content_item to a member.
 *
 * Three-step shape: pick a course, then (for BSS only) pick a version,
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

  const [course, setCourse] = useState<Course>('bss')
  const [bssVersion, setBssVersion] = useState<BssVersion>('5hr')
  const [contentItemId, setContentItemId] = useState<string>('')

  // Eligible items for the currently selected course (and BSS version),
  // minus anything already assigned to this member.
  const eligibleItems = useMemo<ContentItem[]>(() => {
    let items: ContentItem[]
    if (course === 'bss') {
      items = allItems.bss.filter(
        (it) =>
          (it.metadata as { version?: BssVersion } | null)?.version ===
          bssVersion
      )
    } else {
      items = allItems[course]
    }
    return items.filter((it) => !alreadyAssignedIds.has(it.id))
  }, [course, bssVersion, allItems, alreadyAssignedIds])

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
      // 23505 = unique_violation. If it slipped past our filter (race
      // with another manager assigning the same item), refresh and
      // pretend it succeeded.
      if (insErr.code === '23505') {
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
            <option value="bss">BSS</option>
            <option value="eos">EOS</option>
            <option value="potd">POTD</option>
            <option value="machine">5D Machine</option>
          </select>
        </label>

        {course === 'bss' && (
          <label className="settings-field">
            <span>Version</span>
            <select
              value={bssVersion}
              onChange={(e) => {
                setBssVersion(e.target.value as BssVersion)
                setContentItemId('')
              }}
            >
              {BSS_VERSIONS.map((v) => (
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
