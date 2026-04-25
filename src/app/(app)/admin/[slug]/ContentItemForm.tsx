'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BSS_VERSIONS, type CourseSlug, type BssVersion } from '@/lib/courses'

type Status = { type: 'success' | 'error'; msg: string } | null

type FormValues = {
  sequence_num: string
  title: string
  description: string
  media_url: string
  duration_mins: string
  is_published: boolean
  bss_version: BssVersion | ''
}

export type ContentItemDraft = {
  id: string | null
  type: CourseSlug
  sequence_num: number | null
  title: string | null
  description: string | null
  media_url: string | null
  duration_mins: number | null
  is_published: boolean
  metadata: Record<string, unknown> | null
}

export function ContentItemForm({
  courseSlug,
  initial,
}: {
  courseSlug: CourseSlug
  initial: ContentItemDraft
}) {
  const supabase = createClient()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const initialVersion: BssVersion | '' =
    courseSlug === 'bss' &&
    initial.metadata &&
    typeof initial.metadata === 'object'
      ? ((initial.metadata as Record<string, unknown>).version as BssVersion) ??
        ''
      : ''

  const [values, setValues] = useState<FormValues>({
    sequence_num: initial.sequence_num?.toString() ?? '',
    title: initial.title ?? '',
    description: initial.description ?? '',
    media_url: initial.media_url ?? '',
    duration_mins: initial.duration_mins?.toString() ?? '',
    is_published: initial.is_published,
    bss_version: initialVersion,
  })

  function update<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)

    const seq = parseInt(values.sequence_num, 10)
    if (Number.isNaN(seq) || seq < 1) {
      setStatus({ type: 'error', msg: 'Sequence # must be a positive integer' })
      return
    }
    if (courseSlug === 'bss' && !values.bss_version) {
      setStatus({ type: 'error', msg: 'BSS items require a version' })
      return
    }

    const dur = values.duration_mins.trim()
      ? parseInt(values.duration_mins, 10)
      : null
    if (dur !== null && (Number.isNaN(dur) || dur < 0)) {
      setStatus({ type: 'error', msg: 'Duration must be a non-negative integer' })
      return
    }

    const metadata: Record<string, unknown> | null =
      courseSlug === 'bss'
        ? { ...(initial.metadata ?? {}), version: values.bss_version }
        : initial.metadata

    const payload = {
      type: courseSlug,
      sequence_num: seq,
      title: values.title.trim() || null,
      description: values.description.trim() || null,
      media_url: values.media_url.trim() || null,
      duration_mins: dur,
      is_published: values.is_published,
      metadata,
    }

    setSaving(true)
    let resultId = initial.id
    if (initial.id) {
      const { error } = await supabase
        .from('content_items')
        .update(payload)
        .eq('id', initial.id)
      if (error) {
        setSaving(false)
        setStatus({ type: 'error', msg: error.message })
        return
      }
    } else {
      const { data, error } = await supabase
        .from('content_items')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        setSaving(false)
        setStatus({ type: 'error', msg: error.message })
        return
      }
      resultId = data?.id ?? null
    }

    setSaving(false)
    setStatus({ type: 'success', msg: 'Saved' })
    startTransition(() => {
      if (!initial.id && resultId) {
        router.push(`/admin/${courseSlug}/${resultId}`)
      } else {
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    if (!initial.id) return
    if (!confirm('Delete this item permanently? This cannot be undone.')) return
    setSaving(true)
    setStatus(null)
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', initial.id)
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
      return
    }
    router.push(`/admin/${courseSlug}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="settings-form admin-form">
      <div className="admin-form-row">
        <label className="settings-field">
          <span>Sequence #</span>
          <input
            type="number"
            min={1}
            value={values.sequence_num}
            onChange={(e) => update('sequence_num', e.target.value)}
            required
          />
        </label>

        {courseSlug === 'bss' && (
          <label className="settings-field">
            <span>BSS version</span>
            <select
              value={values.bss_version}
              onChange={(e) =>
                update('bss_version', e.target.value as BssVersion | '')
              }
              required
            >
              <option value="">Choose version…</option>
              {BSS_VERSIONS.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="settings-field">
          <span>Duration (minutes)</span>
          <input
            type="number"
            min={0}
            value={values.duration_mins}
            onChange={(e) => update('duration_mins', e.target.value)}
            placeholder="optional"
          />
        </label>
      </div>

      <label className="settings-field">
        <span>Title</span>
        <input
          type="text"
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
          maxLength={200}
        />
      </label>

      <label className="settings-field">
        <span>Description</span>
        <textarea
          rows={3}
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </label>

      <label className="settings-field">
        <span>Media URL</span>
        <input
          type="url"
          value={values.media_url}
          onChange={(e) => update('media_url', e.target.value)}
          placeholder="https://vimeo.com/123456789"
        />
        <p className="settings-hint">
          Vimeo, YouTube, or a direct mp3/mp4 URL. Leave blank to show a
          &quot;coming soon&quot; placeholder.
        </p>
      </label>

      <label className="settings-field settings-field--toggle">
        <input
          type="checkbox"
          checked={values.is_published}
          onChange={(e) => update('is_published', e.target.checked)}
        />
        <span>Published (visible to users)</span>
      </label>

      <div className="settings-actions admin-form-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={saving || pending}
        >
          {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Create item'}
        </button>
        {initial.id && (
          <button
            type="button"
            className="btn btn--secondary admin-form-delete"
            onClick={handleDelete}
            disabled={saving || pending}
          >
            Delete
          </button>
        )}
        {status && (
          <span className={`settings-status settings-status--${status.type}`}>
            {status.msg}
          </span>
        )}
      </div>
    </form>
  )
}
