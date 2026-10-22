'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRIVACY_PATH, recordUsageAnalyticsChoice } from '@/lib/legal'

type Status = { type: 'success' | 'error'; msg: string } | null

/**
 * The member's usage-analytics switch (on by default, disclosed at signup),
 * tucked in a collapsed "Data & privacy" section at the bottom of Settings.
 * Turning it off asks for confirmation first; turning it back on doesn't.
 * Each change appends a row to the consent ledger, and while it's off the
 * database refuses the member's analytics events.
 */
export function DataPrivacySection({
  userId,
  initialUsageAnalytics,
}: {
  userId: string
  initialUsageAnalytics: boolean
}) {
  const [usageAnalytics, setUsageAnalytics] = useState(initialUsageAnalytics)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const confirmRef = useRef<HTMLDialogElement>(null)

  async function save(allowed: boolean) {
    setSaving(true)
    setStatus(null)
    const { error } = await recordUsageAnalyticsChoice(createClient(), userId, allowed)
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: 'Couldn’t save that. Please try again.' })
    } else {
      setUsageAnalytics(allowed)
      setStatus({ type: 'success', msg: 'Saved' })
    }
  }

  function onToggle(next: boolean) {
    if (next) void save(true)
    else confirmRef.current?.showModal()
  }

  return (
    <details className="settings-section settings-disclosure">
      <summary className="settings-disclosure__summary">
        <span>
          <span className="settings-disclosure__title">Data &amp; privacy</span>
          <span className="settings-disclosure__sub">
            Your data settings. See our <Link href={PRIVACY_PATH}>Privacy Policy</Link>.
          </span>
        </span>
        <svg className="settings-disclosure__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>

      <div className="settings-form settings-disclosure__body">
        <label className="settings-field settings-field--toggle">
          <input
            type="checkbox"
            checked={usageAnalytics}
            disabled={saving}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span>
            <strong>Usage analytics</strong>
            <span className="settings-hint">
              Lets us use your activity in Umbrella to improve the program.
            </span>
          </span>
        </label>
        {status && (
          <span className={`settings-status settings-status--${status.type}`} role="status">
            {status.msg}
          </span>
        )}
      </div>

      <dialog
        ref={confirmRef}
        className="confirm-dialog"
        aria-labelledby="usage-off-title"
        // Clicking the dimmed backdrop (the dialog element itself) cancels.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close()
        }}
      >
        <div className="confirm-dialog__panel">
          <h2 id="usage-off-title">Are you sure?</h2>
          <p>
            Usage analytics is how we learn which lessons click, where people
            get stuck, and what to build next — so Umbrella keeps getting
            better for you and your team.
          </p>
          <p>
            It only covers what you do inside Umbrella, and we never sell your
            personal information.
          </p>
          <div className="confirm-dialog__actions">
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => confirmRef.current?.close()}
            >
              Keep it on
            </button>
            <button
              type="button"
              className="confirm-dialog__secondary"
              onClick={() => {
                confirmRef.current?.close()
                void save(false)
              }}
            >
              Turn off anyway
            </button>
          </div>
        </div>
      </dialog>
    </details>
  )
}
