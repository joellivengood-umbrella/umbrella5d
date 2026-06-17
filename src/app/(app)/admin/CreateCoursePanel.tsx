'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { COURSE_THEME_PRESETS, presetById } from '@/lib/course-themes'
import type { Course } from '@/lib/courses'
import { CourseCard } from '@/components/courses/CourseCard'

type Status = { type: 'success' | 'error'; msg: string } | null

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * "Create course" lives inline on the admin home (not its own route) so it
 * can never collide with the /admin/[slug] segment — any static sibling
 * folder could otherwise shadow a real course slug. Inserts a public.courses
 * row (a normal INSERT now that content is off the enum) and jumps to the new
 * course's admin page to add lessons. New courses are flat + bonus (not in
 * the program %) until promoted in the course settings.
 */
export function CreateCoursePanel() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const [title, setTitle] = useState('')
  const [shortTitle, setShortTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [mediaKind, setMediaKind] = useState<'video' | 'audio'>('video')
  const [presetId, setPresetId] = useState(COURSE_THEME_PRESETS[0].id)
  const [blurb, setBlurb] = useState('')
  const [publish, setPublish] = useState(true)

  function onTitleChange(v: string) {
    setTitle(v)
    setStatus(null)
    if (!slugTouched) setSlug(slugify(v))
  }

  const preview: Course = {
    slug: slug || 'preview',
    title: title || 'Course name',
    shortTitle: shortTitle || 'NEW',
    blurb: blurb || 'A short description of the course goes here.',
    mediaKind,
    template: 'flat',
    hasDripRelease: false,
    sortOrder: 0,
    theme: presetById(presetId).theme,
    isPublished: publish,
    inProgram: false,
    isAssignable: false,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    const t = title.trim()
    const st = shortTitle.trim()
    const sl = slug.trim()
    if (!t) return setStatus({ type: 'error', msg: 'Course name is required.' })
    if (!st) return setStatus({ type: 'error', msg: 'Short label is required.' })
    if (!/^[a-z0-9][a-z0-9-]*$/.test(sl)) {
      return setStatus({
        type: 'error',
        msg: 'URL slug must be lowercase letters, numbers, and hyphens.',
      })
    }

    setSaving(true)
    // New courses sort after everything existing.
    const { data: maxRow } = await supabase
      .from('courses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = ((maxRow?.sort_order as number | undefined) ?? 0) + 10

    const { error } = await supabase.from('courses').insert({
      slug: sl,
      title: t,
      short_title: st,
      blurb: blurb.trim() || '',
      media_kind: mediaKind,
      template: 'flat',
      has_drip_release: false,
      sort_order: nextSort,
      theme: presetById(presetId).theme,
      is_published: publish,
      in_program: false,
      is_assignable: false,
    })
    setSaving(false)

    if (error) {
      const msg =
        error.code === '23505'
          ? 'That URL slug is already taken — pick another.'
          : error.message
      setStatus({ type: 'error', msg })
      return
    }
    // Off to the new course's admin page to add its lessons.
    router.push(`/admin/${sl}`)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => setOpen(true)}
      >
        + Create course
      </button>
    )
  }

  return (
    <section className="settings-section admin-create-course">
      <header className="settings-section__header">
        <h2>Create a course</h2>
        <p>
          Add a new course to the library. It starts as a bonus track (it
          won&apos;t affect anyone&apos;s program % until you promote it) — add
          its lessons next.
        </p>
      </header>

      <div className="admin-create-course__grid">
        <form onSubmit={handleSubmit} className="settings-form">
          <label className="settings-field">
            <span>Course name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              maxLength={120}
              placeholder="e.g. Leadership Foundations"
              autoFocus
            />
          </label>

          <div className="admin-form-row">
            <label className="settings-field">
              <span>Short label</span>
              <input
                type="text"
                value={shortTitle}
                onChange={(e) => {
                  setShortTitle(e.target.value)
                  setStatus(null)
                }}
                maxLength={24}
                placeholder="e.g. Leadership"
              />
            </label>
            <label className="settings-field">
              <span>URL slug</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                  setStatus(null)
                }}
                maxLength={40}
                placeholder="leadership-foundations"
              />
              <p className="settings-hint">/courses/{slug || 'your-slug'}</p>
            </label>
          </div>

          <label className="settings-field">
            <span>Media type</span>
            <select
              value={mediaKind}
              onChange={(e) =>
                setMediaKind(e.target.value as 'video' | 'audio')
              }
            >
              <option value="video">Video lessons</option>
              <option value="audio">Audio lessons</option>
            </select>
          </label>

          <label className="settings-field">
            <span>Description</span>
            <textarea
              rows={3}
              value={blurb}
              onChange={(e) => {
                setBlurb(e.target.value)
                setStatus(null)
              }}
              maxLength={500}
              placeholder="A short description shown on the course card (optional)."
            />
          </label>

          <div className="settings-field">
            <span>Theme</span>
            <div className="theme-swatches">
              {COURSE_THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={presetId === p.id}
                  onClick={() => setPresetId(p.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    cursor: 'pointer',
                    background: `linear-gradient(135deg, ${p.theme.from}, ${p.theme.to})`,
                    border: '2px solid #fff',
                    outline:
                      presetId === p.id
                        ? `2px solid ${p.theme.to}`
                        : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <label className="settings-field settings-field--toggle">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            <span>Publish now (show in the catalog)</span>
          </label>

          <div className="settings-actions admin-form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create course'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            {status && (
              <span
                className={`settings-status settings-status--${status.type}`}
                role={status.type === 'error' ? 'alert' : 'status'}
              >
                {status.msg}
              </span>
            )}
          </div>
        </form>

        <div className="admin-create-course__preview">
          <p className="settings-hint">Live preview</p>
          <div className="courses-grid" style={{ pointerEvents: 'none' }}>
            <CourseCard
              course={preview}
              href="#"
              completedCount={0}
              totalCount={0}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
