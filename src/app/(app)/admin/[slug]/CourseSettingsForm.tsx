'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  COURSE_THEME_PRESETS,
  presetById,
  presetIdForTheme,
} from '@/lib/course-themes'
import type { Course } from '@/lib/courses'

type Status = { type: 'success' | 'error'; msg: string } | null

/**
 * Edit a course's display + lifecycle flags. The slug is fixed (it's the
 * URL and what content rows reference). "Counts toward program %" is the
 * promote-from-bonus switch; "assignable" lets managers require it of teams.
 *
 * Sits under the course title as a "Course settings" button that opens the
 * panel in place (closed by default), so settings are one click away however
 * long the lesson list below gets.
 */
export function CourseSettingsForm({ course }: { course: Course }) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const [title, setTitle] = useState(course.title)
  const [shortTitle, setShortTitle] = useState(course.shortTitle)
  const [blurb, setBlurb] = useState(course.blurb)
  const [mediaKind, setMediaKind] = useState<'video' | 'audio'>(
    course.mediaKind
  )
  const [presetId, setPresetId] = useState(presetIdForTheme(course.theme))
  const [isPublished, setIsPublished] = useState(course.isPublished)
  const [inProgram, setInProgram] = useState(course.inProgram)
  const [isAssignable, setIsAssignable] = useState(course.isAssignable)

  function clearStatus() {
    setStatus(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const st = shortTitle.trim()
    if (!t) return setStatus({ type: 'error', msg: 'Course name is required.' })
    if (!st) return setStatus({ type: 'error', msg: 'Short label is required.' })

    setSaving(true)
    const { error } = await supabase
      .from('courses')
      .update({
        title: t,
        short_title: st,
        blurb: blurb.trim() || '',
        media_kind: mediaKind,
        theme: presetById(presetId).theme,
        is_published: isPublished,
        in_program: inProgram,
        is_assignable: isAssignable,
      })
      .eq('slug', course.slug)
    setSaving(false)

    if (error) {
      setStatus({ type: 'error', msg: error.message })
      return
    }
    setStatus({ type: 'success', msg: 'Saved.' })
    router.refresh()
  }

  return (
    <div className="course-settings">
      <button
        type="button"
        className="btn btn--secondary btn--sm course-settings__toggle"
        aria-expanded={open}
        aria-controls="course-settings-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Course settings
        <svg className="course-settings__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <section
        id="course-settings-panel"
        className="settings-section course-settings__panel"
        aria-label="Course settings"
        hidden={!open}
      >
      <header className="settings-section__header">
        <p>
          Display, theme, and how this course behaves across the program. Slug
          (<code>{course.slug}</code>) is fixed.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="admin-form-row">
          <label className="settings-field">
            <span>Course name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                clearStatus()
              }}
              maxLength={120}
            />
          </label>
          <label className="settings-field">
            <span>Short label</span>
            <input
              type="text"
              value={shortTitle}
              onChange={(e) => {
                setShortTitle(e.target.value)
                clearStatus()
              }}
              maxLength={24}
            />
          </label>
        </div>

        <label className="settings-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={blurb}
            onChange={(e) => {
              setBlurb(e.target.value)
              clearStatus()
            }}
            maxLength={500}
          />
        </label>

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
                onClick={() => {
                  setPresetId(p.id)
                  clearStatus()
                }}
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
            checked={isPublished}
            onChange={(e) => {
              setIsPublished(e.target.checked)
              clearStatus()
            }}
          />
          <span>Published (visible in the catalog)</span>
        </label>

        <label className="settings-field settings-field--toggle">
          <input
            type="checkbox"
            checked={inProgram}
            onChange={(e) => {
              setInProgram(e.target.checked)
              clearStatus()
            }}
          />
          <span>
            Counts toward program progress % (promote from bonus to core)
          </span>
        </label>

        <label className="settings-field settings-field--toggle">
          <input
            type="checkbox"
            checked={isAssignable}
            onChange={(e) => {
              setIsAssignable(e.target.checked)
              clearStatus()
            }}
          />
          <span>Managers can require this course of their teams</span>
        </label>

        <div className="settings-actions admin-form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
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
      </section>
    </div>
  )
}
