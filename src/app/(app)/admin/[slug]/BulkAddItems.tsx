'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { courseLessonFolder, removeMediaIfUnused, uploadLessonMedia } from '@/lib/lesson-media'

/**
 * Admin: add many lessons at once from media files (e.g. a folder of Pod of
 * the Day episodes). Each file's number comes from its name
 * (POTD_EP_011_V1.mp3 → 11); numbers the course already has are skipped.
 * For every new one it uploads the file (filed by course/lesson, like any
 * upload), then creates the lesson titled "<Course title> <n>", published.
 * Files upload one at a time with a status per file.
 */

type Entry = {
  file: File
  number: number | null
  status: 'new' | 'exists' | 'no-number' | 'duplicate' | 'uploading' | 'done' | 'failed'
  progress: number
  error?: string
}

/** The lesson number in a file name: after EP/Episode/Lesson…, else the first number. */
function numberFromName(name: string): number | null {
  const base = name.replace(/\.[^.]+$/, '')
  const tagged = base.match(/(?:ep|episode|lesson|segment|seminar|part)[\s._-]*0*(\d{1,4})/i)
  const any = base.match(/0*(\d{1,4})/)
  const n = Number((tagged ?? any)?.[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Whole minutes (at least 1), read from the file's own metadata. */
function durationMins(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio')
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) ? Math.max(1, Math.round(el.duration / 60)) : null)
    el.onerror = () => done(null)
    el.src = url
  })
}

export function BulkAddItems({
  courseSlug,
  courseTitle,
  mediaKind,
  existingNumbers,
}: {
  courseSlug: string
  courseTitle: string
  mediaKind: 'audio' | 'video'
  existingNumbers: number[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    const taken = new Set(existingNumbers)
    const seen = new Set<number>()
    const list: Entry[] = files
      .map((file) => ({ file, number: numberFromName(file.name) }))
      .sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.file.name.localeCompare(b.file.name))
      .map(({ file, number }) => {
        let status: Entry['status'] = 'new'
        if (number == null) status = 'no-number'
        else if (taken.has(number)) status = 'exists'
        else if (seen.has(number)) status = 'duplicate'
        if (number != null) seen.add(number)
        return { file, number, status, progress: 0 }
      })
    setEntries(list)
    setFinished(false)
  }

  const patch = (i: number, p: Partial<Entry>) =>
    setEntries((list) => list.map((en, j) => (j === i ? { ...en, ...p } : en)))

  async function run() {
    const todo = entries.filter((e) => e.status === 'new').length
    if (!todo || !confirm(`Upload and publish ${todo} new item(s) in ${courseTitle}?`)) return
    setRunning(true)
    const supabase = createClient()
    for (let i = 0; i < entries.length; i++) {
      const en = entries[i]
      if (en.status !== 'new' || en.number == null) continue
      patch(i, { status: 'uploading', progress: 0 })
      let url: string | null = null
      try {
        const job = uploadLessonMedia({
          supabase,
          file: en.file,
          folder: courseLessonFolder({ courseSlug, sequenceNum: en.number }),
          kind: mediaKind,
          onProgress: (pct) => patch(i, { progress: pct }),
        })
        const [uploaded, mins] = await Promise.all([job.promise, durationMins(en.file)])
        url = uploaded.url
        const { error } = await supabase.from('content_items').insert({
          type: courseSlug,
          sequence_num: en.number,
          title: `${courseTitle} ${en.number}`,
          media_url: url,
          duration_mins: mins,
          is_published: true,
          metadata: {},
        })
        if (error) throw new Error(error.message)
        patch(i, { status: 'done', progress: 100 })
      } catch (err) {
        // Don't leave an orphaned file behind a failed lesson.
        if (url) await removeMediaIfUnused(supabase, url)
        patch(i, { status: 'failed', error: err instanceof Error ? err.message : 'Failed' })
      }
    }
    setRunning(false)
    setFinished(true)
    router.refresh()
  }

  const count = (s: Entry['status']) => entries.filter((e) => e.status === s).length
  const label: Record<Entry['status'], string> = {
    new: 'Ready',
    exists: 'Already exists — skipped',
    'no-number': 'No number in name — skipped',
    duplicate: 'Duplicate number — skipped',
    uploading: 'Uploading…',
    done: 'Added ✓',
    failed: 'Failed',
  }

  return (
    <details className="settings-section bulk-add" open={entries.length > 0 || undefined}>
      <summary className="bulk-add__summary">Bulk add from files</summary>
      <p className="settings-hint">
        Select many {mediaKind === 'audio' ? 'audio' : 'video'} files at once. Each file’s number is
        read from its name (e.g. <code>POTD_EP_011_V1.mp3</code> → 11), and numbers this course
        already has are skipped. Each new one is uploaded, titled “{courseTitle} 11”, and
        published.
      </p>

      <div className="settings-actions">
        <label className="btn btn--secondary btn--sm lbe-media__pick">
          Choose files
          <input
            type="file"
            multiple
            accept={mediaKind === 'audio' ? 'audio/*' : 'video/mp4,video/webm,video/quicktime'}
            onChange={pick}
            disabled={running}
            hidden
          />
        </label>
        {entries.length > 0 && !finished && (
          <button type="button" className="btn btn--primary btn--sm" onClick={run} disabled={running || !count('new')}>
            {running ? 'Uploading…' : `Upload & publish ${count('new')} new`}
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <>
          <p className="bulk-add__totals">
            {count('new') + count('uploading')} to add · {count('done')} added · {count('exists')} already exist
            {count('failed') ? ` · ${count('failed')} failed` : ''}
            {count('no-number') + count('duplicate') ? ` · ${count('no-number') + count('duplicate')} skipped` : ''}
          </p>
          <ul className="bulk-add__list">
            {entries.map((en, i) => (
              <li key={`${en.file.name}-${i}`} className={`bulk-add__row bulk-add__row--${en.status}`}>
                <span className="bulk-add__num">{en.number ?? '—'}</span>
                <span className="bulk-add__name">{en.file.name}</span>
                <span className="bulk-add__status">
                  {en.status === 'uploading' ? `Uploading… ${en.progress}%` : label[en.status]}
                  {en.error ? ` — ${en.error}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
