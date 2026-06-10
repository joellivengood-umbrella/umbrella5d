'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MachinePart } from '@/lib/courses'

type Status = { type: 'success' | 'error'; msg: string } | null

const ORDINALS = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]
const ordinal = (n: number) => ORDINALS[n - 1] ?? String(n)

function bySort(a: MachinePart, b: MachinePart) {
  return a.sortIndex - b.sortIndex
}

export function MachinePartsManager({
  initialParts,
}: {
  initialParts: MachinePart[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [parts, setParts] = useState<MachinePart[]>(() =>
    [...initialParts].sort(bySort)
  )
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  function fail(msg: string) {
    setBusy(false)
    setStatus({ type: 'error', msg })
  }

  async function create() {
    const title = newTitle.trim()
    if (!title) return
    const nextSort = parts.length
      ? Math.max(...parts.map((p) => p.sortIndex)) + 1
      : 1
    setBusy(true)
    setStatus(null)
    const { data, error } = await supabase
      .from('machine_parts')
      .insert({ sort_index: nextSort, title, is_published: false })
      .select('id, sort_index, title, subtitle, is_published')
      .single()
    if (error || !data) return fail(error?.message ?? 'Could not create Part')
    const r = data as Record<string, unknown>
    setParts((prev) =>
      [
        ...prev,
        {
          id: r.id as string,
          sortIndex: r.sort_index as number,
          title: r.title as string,
          subtitle: (r.subtitle as string | null) ?? null,
          isPublished: r.is_published as boolean,
        },
      ].sort(bySort)
    )
    setNewTitle('')
    setBusy(false)
    setStatus({ type: 'success', msg: 'Part added' })
    router.refresh()
  }

  async function patch(
    id: string,
    local: Partial<MachinePart>,
    db: Record<string, unknown>
  ) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...local } : p)))
    setStatus(null)
    const { error } = await supabase
      .from('machine_parts')
      .update(db)
      .eq('id', id)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      router.refresh()
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...parts].sort(bySort)
    const i = sorted.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return
    const a = sorted[i]
    const b = sorted[j]
    setBusy(true)
    setStatus(null)
    const { error: e1 } = await supabase
      .from('machine_parts')
      .update({ sort_index: b.sortIndex })
      .eq('id', a.id)
    const { error: e2 } = await supabase
      .from('machine_parts')
      .update({ sort_index: a.sortIndex })
      .eq('id', b.id)
    if (e1 || e2) return fail((e1 ?? e2)!.message)
    setParts((prev) =>
      prev
        .map((p) =>
          p.id === a.id
            ? { ...p, sortIndex: b.sortIndex }
            : p.id === b.id
              ? { ...p, sortIndex: a.sortIndex }
              : p
        )
        .sort(bySort)
    )
    setBusy(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (
      !confirm(
        'Delete this Part? Lessons in it become unassigned (they are NOT deleted).'
      )
    )
      return
    setBusy(true)
    setStatus(null)
    const { error } = await supabase.from('machine_parts').delete().eq('id', id)
    if (error) return fail(error.message)
    setParts((prev) => prev.filter((p) => p.id !== id))
    setBusy(false)
    router.refresh()
  }

  const sorted = [...parts].sort(bySort)

  return (
    <div className="mpm">
      {sorted.length === 0 ? (
        <p className="mpm__empty">No Parts yet. Add your first one below.</p>
      ) : (
        <ol className="mpm__list">
          {sorted.map((p, i) => (
            <li key={p.id} className="mpm-row">
              <div className="mpm-row__order">
                <button type="button" className="lbe-iconbtn" aria-label="Move up"
                  disabled={busy || i === 0} onClick={() => move(p.id, -1)}>↑</button>
                <span className="mpm-row__num">Part {ordinal(p.sortIndex)}</span>
                <button type="button" className="lbe-iconbtn" aria-label="Move down"
                  disabled={busy || i === sorted.length - 1} onClick={() => move(p.id, 1)}>↓</button>
              </div>

              <input
                type="text"
                className="lbe-input mpm-row__title"
                defaultValue={p.title}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== p.title) patch(p.id, { title: v }, { title: v })
                }}
                aria-label={`Part ${ordinal(p.sortIndex)} title`}
              />

              <label className="mpm-row__pub">
                <input
                  type="checkbox"
                  checked={p.isPublished}
                  onChange={(e) =>
                    patch(
                      p.id,
                      { isPublished: e.target.checked },
                      { is_published: e.target.checked }
                    )
                  }
                />
                <span>{p.isPublished ? 'Published' : 'Draft'}</span>
              </label>

              <button
                type="button"
                className="lbe-iconbtn lbe-iconbtn--danger"
                aria-label="Delete Part"
                disabled={busy}
                onClick={() => remove(p.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mpm-new">
        <input
          type="text"
          className="lbe-input"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
          }}
          placeholder="New Part title (e.g. The Big Reduction)"
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={create}
          disabled={busy || !newTitle.trim()}
        >
          + Add Part
        </button>
      </div>

      {status ? (
        <p className={`settings-status settings-status--${status.type}`}>
          {status.msg}
        </p>
      ) : null}
    </div>
  )
}
