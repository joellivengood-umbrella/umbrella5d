'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MEDIA_BUCKET,
  courseLessonFolder,
  machineLessonFolder,
  mediaPathFromUrl,
  partnerFolder,
  type MediaKind,
} from '@/lib/lesson-media'

/**
 * Admin tool: tidy the lesson-media bucket.
 *
 * Scan → shows (1) files used by lessons, 5D Machine blocks or partner
 * bumpers that aren't in their course/lesson folder yet, and where each
 * would move; (2) files nothing uses any more. Organize → moves the first
 * set (updating every link to them) and deletes the second. Nothing changes
 * until the admin confirms. Safe to run again any time.
 */

type Ref =
  | { kind: 'item'; id: string; url: string }
  | { kind: 'block'; id: string; url: string; data: Record<string, unknown> }
  | { kind: 'bumper'; id: string; url: string }

type Move = { from: string; to: string; refs: Ref[] }
type Plan = { moves: Move[]; unused: string[]; organized: number }
type Phase = 'idle' | 'scanning' | 'ready' | 'working' | 'done'

/** Every object path in the bucket (Storage lists one folder at a time). */
async function listAll(supabase: ReturnType<typeof createClient>, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(error.message)
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id == null) out.push(...(await listAll(supabase, path))) // a folder
      else if (entry.name !== '.emptyFolderPlaceholder') out.push(path)
    }
    if ((data ?? []).length < 1000) break
  }
  return out
}

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

function kindFromExt(path: string): MediaKind {
  if (/\.(mp3|wav|m4a|ogg|aac)$/i.test(path)) return 'audio'
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path)) return 'image'
  return 'video'
}

export function MediaOrganizer() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function scan() {
    setPhase('scanning')
    setError(null)
    setLog([])
    const supabase = createClient()
    try {
      const [items, blocks, partners, parts, courses, objects] = await Promise.all([
        supabase.from('content_items').select('id, type, sequence_num, metadata, part_id, part_sort_index, media_url'),
        supabase.from('lesson_blocks').select('id, lesson_id, block_type, data'),
        supabase.from('partners').select('id, name, bumper_url'),
        supabase.from('machine_parts').select('id, sort_index'),
        supabase.from('courses').select('slug, media_kind'),
        listAll(supabase),
      ])
      for (const r of [items, blocks, partners, parts, courses]) {
        if (r.error) throw new Error(r.error.message)
      }

      const partNo = new Map((parts.data ?? []).map((p) => [p.id as string, p.sort_index as number]))
      const mediaKind = new Map((courses.data ?? []).map((c) => [c.slug as string, c.media_kind as string]))
      type Item = { id: string; type: string; sequence_num: number | null; metadata: Record<string, unknown> | null; part_id: string | null; part_sort_index: number | null; media_url: string | null }
      const itemRows = (items.data ?? []) as Item[]
      const itemById = new Map(itemRows.map((i) => [i.id, i]))

      const folderForItem = (i: Item) =>
        i.type === 'machine'
          ? machineLessonFolder({
              partNumber: i.part_id ? partNo.get(i.part_id) ?? null : null,
              lessonNumber: i.part_sort_index,
              sequenceNum: i.sequence_num,
            })
          : courseLessonFolder({
              courseSlug: i.type,
              sequenceNum: i.sequence_num,
              mbaVersion: i.type === 'mba' ? (i.metadata?.version as string | undefined) ?? null : null,
            })

      // Where each in-use file belongs, grouped by its current path.
      const wanted = new Map<string, { to: string; refs: Ref[] }>()
      const want = (url: string | null | undefined, to: (path: string) => string, ref: Ref) => {
        const path = mediaPathFromUrl(url)
        if (!path) return
        const entry = wanted.get(path) ?? { to: to(path), refs: [] }
        entry.refs.push(ref)
        wanted.set(path, entry)
      }
      for (const i of itemRows) {
        if (!i.media_url) continue
        want(i.media_url, (p) => {
          // An image keeps "image"; otherwise the course's media type decides.
          const k: MediaKind =
            kindFromExt(p) === 'image' ? 'image' : mediaKind.get(i.type) === 'audio' ? 'audio' : 'video'
          return `${folderForItem(i)}/${k}/${fileName(p)}`
        }, { kind: 'item', id: i.id, url: i.media_url })
      }
      for (const b of (blocks.data ?? []) as { id: string; lesson_id: string; block_type: string; data: Record<string, unknown> | null }[]) {
        const url = b.data?.url as string | undefined
        const lesson = itemById.get(b.lesson_id)
        if (!url || !lesson) continue
        const k = (['audio', 'video', 'image'].includes(b.block_type) ? b.block_type : 'video') as MediaKind
        want(url, (p) => `${folderForItem(lesson)}/${k}/${fileName(p)}`, { kind: 'block', id: b.id, url, data: b.data ?? {} })
      }
      for (const p of (partners.data ?? []) as { id: string; name: string; bumper_url: string | null }[]) {
        if (!p.bumper_url) continue
        want(p.bumper_url, (path) => `${partnerFolder(p.name)}/audio/${fileName(path)}`, { kind: 'bumper', id: p.id, url: p.bumper_url })
      }

      const existing = new Set(objects)
      const moves: Move[] = []
      let organized = 0
      for (const [from, { to, refs }] of wanted) {
        if (!existing.has(from)) continue // a dangling link; nothing to move
        if (from === to) organized += 1
        else moves.push({ from, to, refs })
      }
      const unused = objects.filter((o) => !wanted.has(o))
      setPlan({ moves, unused, organized })
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.')
      setPhase('idle')
    }
  }

  async function organize() {
    if (!plan) return
    if (!confirm(`Move ${plan.moves.length} file(s) into their folders and permanently delete ${plan.unused.length} unused file(s)?`)) return
    setPhase('working')
    const supabase = createClient()
    const lines: string[] = []
    const note = (s: string) => {
      lines.push(s)
      setLog([...lines])
    }

    for (const m of plan.moves) {
      const { error: mvErr } = await supabase.storage.from(MEDIA_BUCKET).move(m.from, m.to)
      if (mvErr) {
        note(`✗ Couldn’t move ${m.from}: ${mvErr.message}`)
        continue
      }
      const newUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(m.to).data.publicUrl
      let ok = true
      for (const r of m.refs) {
        const res =
          r.kind === 'item'
            ? await supabase.from('content_items').update({ media_url: newUrl }).eq('id', r.id)
            : r.kind === 'block'
              ? await supabase.from('lesson_blocks').update({ data: { ...r.data, url: newUrl } }).eq('id', r.id)
              : await supabase.rpc('set_partner_bumper', { _partner_id: r.id, _url: newUrl })
        if (res.error) {
          ok = false
          note(`✗ Moved ${m.from} but couldn’t update a link to it: ${res.error.message}`)
        }
      }
      if (ok) note(`✓ ${m.from} → ${m.to}`)
    }

    for (const path of plan.unused) {
      // Re-check right before deleting, in case something started using it.
      const { data: inUse, error: chkErr } = await supabase.rpc('lesson_media_in_use', { _path: path })
      if (chkErr || inUse !== false) {
        note(`• Kept ${path} (${chkErr ? chkErr.message : 'in use'})`)
        continue
      }
      const { error: rmErr } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
      note(rmErr ? `✗ Couldn’t delete ${path}: ${rmErr.message}` : `🗑 Deleted ${path}`)
    }
    setPhase('done')
  }

  return (
    <div className="media-org">
      <div className="settings-actions">
        <button type="button" className="btn btn--secondary" onClick={scan} disabled={phase === 'scanning' || phase === 'working'}>
          {phase === 'scanning' ? 'Scanning…' : plan ? 'Scan again' : 'Scan media files'}
        </button>
        {plan && phase === 'ready' && (plan.moves.length > 0 || plan.unused.length > 0) && (
          <button type="button" className="btn btn--primary" onClick={organize}>
            Organize now
          </button>
        )}
      </div>
      {error && <p className="lbe-media__error">{error}</p>}

      {plan && phase !== 'done' && (
        <div className="media-org__plan">
          <p>
            <strong>{plan.organized}</strong> file(s) already organized ·{' '}
            <strong>{plan.moves.length}</strong> to move ·{' '}
            <strong>{plan.unused.length}</strong> unused (will be deleted)
          </p>
          {plan.moves.length > 0 && (
            <>
              <h3>Will move</h3>
              <ul>
                {plan.moves.map((m) => (
                  <li key={m.from}>
                    <code>{m.from}</code> → <code>{m.to}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan.unused.length > 0 && (
            <>
              <h3>Not used anywhere — will be deleted</h3>
              <ul>
                {plan.unused.map((u) => (
                  <li key={u}>
                    <code>{u}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan.moves.length === 0 && plan.unused.length === 0 && <p>Everything is already in order.</p>}
        </div>
      )}

      {log.length > 0 && (
        <div className="media-org__plan" role="log" aria-live="polite">
          <h3>{phase === 'done' ? 'Done' : 'Working…'}</h3>
          <ul>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
