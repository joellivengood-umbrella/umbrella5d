'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  MODULES,
  TOTAL_LESSONS,
  isModuleComplete,
  moduleLessonIds,
} from '@/lib/curriculum'

const STORAGE_KEY = 'umbrella_modules_open'

function getModuleStates(): Record<number, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}
function setModuleState(n: number, isOpen: boolean) {
  const states = getModuleStates()
  states[n] = isOpen
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
}

export function DashboardView({
  userId,
  firstName,
  initialCompleted,
}: {
  userId: string
  firstName: string
  initialCompleted: string[]
}) {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    initialCompleted.forEach((id) => (map[id] = true))
    return map
  })
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({})
  const supabase = createClient()

  const fetchProgress = useCallback(async () => {
    const { data } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('completed', true)
    const map: Record<string, boolean> = {}
    ;(data ?? []).forEach((row) => {
      map[row.lesson_id as string] = true
    })
    setCompleted(map)
  }, [supabase, userId])

  // Hydrate module open-state from localStorage after mount.
  useEffect(() => {
    setOpenModules(getModuleStates())
  }, [])

  // Refresh progress when returning from a lesson.
  useEffect(() => {
    const onFocus = () => fetchProgress()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchProgress])

  const doneCount = useMemo(() => Object.keys(completed).length, [completed])
  const pct = Math.round((doneCount / TOTAL_LESSONS) * 100)
  const allDone = doneCount === TOTAL_LESSONS

  const modulesDone = useMemo(
    () => MODULES.filter((m) => isModuleComplete(m.n, completed)).length,
    [completed]
  )

  function toggleModule(n: number, locked: boolean) {
    if (locked) return
    const next = !openModules[n]
    setOpenModules((s) => ({ ...s, [n]: next }))
    setModuleState(n, next)
  }

  return (
    <>
      {/* Dark page header */}
      <div className="dash-header">
        <p className="section-eyebrow">Your Learning Journey</p>
        <h1>Hey {firstName}! Welcome to your dashboard.</h1>
        <p className="dash-subtext">
          Track your completion across all five core seminars. Work through
          each lesson to complete the program.
        </p>
      </div>

      {/* Light content area */}
      <div className="dash-content">
        <div className="dash-layout">
          {/* Stat cards */}
          <div className="dash-stats">
            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <p className="stat-card__value">{modulesDone} / 5</p>
              <p className="stat-card__label">Modules Completed</p>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="stat-card__value">
                {doneCount} / {TOTAL_LESSONS}
              </p>
              <p className="stat-card__label">Lessons Completed</p>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="stat-card__value">{pct}%</p>
              <p className="stat-card__label">Overall Progress</p>
            </div>
          </div>

          {/* Progress card */}
          <div className="progress-card" role="region" aria-label="Overall progress">
            <div className="progress-header">
              <h2 className="progress-title">Overall Progress</h2>
              <span
                className={`progress-pct${allDone ? ' is-done' : ''}`}
                aria-live="polite"
              >
                {pct}%
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress-meta">
              {allDone
                ? '🎉 All lessons complete!'
                : `${doneCount} of ${TOTAL_LESSONS} lessons complete`}
            </p>
          </div>

          {/* Module list */}
          <div className="modules-header">
            <h2>Course Modules</h2>
            <p>Expand a module to see its lessons</p>
          </div>

          <div className="modules-list" role="list">
            {MODULES.map((m) => {
              const moduleDone = isModuleComplete(m.n, completed)
              const prevDone =
                m.n === 1 ? true : isModuleComplete(m.n - 1, completed)
              const locked = !prevDone
              const isOpen = !!openModules[m.n] && !locked

              return (
                <div
                  key={m.n}
                  className={`module-item${locked ? ' is-locked' : ''}`}
                  role="listitem"
                >
                  <div
                    className={`module-card module-card--expanded${
                      moduleDone ? ' is-complete' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`seminar-${m.n}`}
                      className="module-checkbox"
                      checked={moduleDone}
                      readOnly
                    />
                    <span className="check-visual" aria-hidden="true">
                      <svg viewBox="0 0 14 14" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2,7 5.5,10.5 12,3.5" />
                      </svg>
                    </span>
                    <div className="module-info">
                      <span className="module-number">
                        Module {String(m.n).padStart(2, '0')}
                      </span>
                      <h3>{m.title}</h3>
                      <p>{m.blurb}</p>
                    </div>
                    <span
                      className={`module-status${moduleDone ? ' module-status--complete' : ''}`}
                    >
                      {moduleDone ? 'Complete' : 'Not started'}
                    </span>
                  </div>

                  <button
                    className="module-reveal-btn"
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`module-content-${m.n}`}
                    onClick={() => toggleModule(m.n, locked)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span>
                      {isOpen
                        ? `Hide Module ${m.n}`
                        : `Start Module ${m.n}`}
                    </span>
                  </button>

                  <div
                    className={`module-content${isOpen ? ' is-open' : ''}`}
                    id={`module-content-${m.n}`}
                    aria-hidden={!isOpen}
                  >
                    <p className="module-content__heading">
                      Module {m.n} &mdash; Lessons
                    </p>
                    <div className="lesson-grid">
                      {moduleLessonIds(m.n).map((id, idx) => {
                        const lessonNum = idx + 1
                        const done = !!completed[id]
                        return (
                          <Link
                            key={id}
                            href={`/lessons/${m.n}/${lessonNum}`}
                            className={`lesson-box${done ? ' is-done' : ''}`}
                            data-lesson={id}
                          >
                            L{lessonNum}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
