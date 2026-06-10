'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Drops an unassigned machine lesson into a Part, placing it at the end
 * of that Part's order. Used on the admin structure view's "Unassigned"
 * rows so floating lessons are one selection away from showing up.
 */
export function AssignLessonToPart({
  lessonId,
  parts,
}: {
  lessonId: string
  parts: { id: string; sortIndex: number; title: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onSelect(e: ChangeEvent<HTMLSelectElement>) {
    const partId = e.target.value
    if (!partId) return
    setBusy(true)
    const supabase = createClient()

    // Next order within the chosen Part.
    const { data: maxRow } = await supabase
      .from('content_items')
      .select('part_sort_index')
      .eq('part_id', partId)
      .order('part_sort_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = ((maxRow?.part_sort_index as number | undefined) ?? 0) + 1

    const { error } = await supabase
      .from('content_items')
      .update({ part_id: partId, part_sort_index: nextOrder })
      .eq('id', lessonId)

    setBusy(false)
    if (!error) router.refresh()
  }

  return (
    <select
      className="mas-assign"
      defaultValue=""
      disabled={busy}
      onChange={onSelect}
      aria-label="Assign lesson to a Part"
    >
      <option value="">{busy ? 'Assigning…' : 'Assign to Part…'}</option>
      {parts.map((p) => (
        <option key={p.id} value={p.id}>
          Part {p.sortIndex}: {p.title}
        </option>
      ))}
    </select>
  )
}
