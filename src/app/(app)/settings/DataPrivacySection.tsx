'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRIVACY_PATH, recordUsageAnalyticsChoice } from '@/lib/legal'

type Status = { type: 'success' | 'error'; msg: string } | null

/**
 * The member's usage-analytics switch (on by default, disclosed at signup).
 * Each change appends a row to the consent ledger; while it's off, the
 * database refuses their analytics events.
 */
export function DataPrivacySection({
  userId,
  initialUsageAnalytics,
}: {
  userId: string
  initialUsageAnalytics: boolean
}) {
  const [usageAnalytics, setUsageAnalytics] = useState(initialUsageAnalytics)
  const [saved, setSaved] = useState(initialUsageAnalytics)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (usageAnalytics === saved) return
    setSaving(true)
    setStatus(null)
    const { error } = await recordUsageAnalyticsChoice(createClient(), userId, usageAnalytics)
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error })
    } else {
      setSaved(usageAnalytics)
      setStatus({ type: 'success', msg: 'Saved' })
    }
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Data &amp; privacy</h2>
        <p>
          See our <Link href={PRIVACY_PATH}>Privacy Policy</Link> for details.
        </p>
      </header>

      <form onSubmit={handleSave} className="settings-form">
        <label className="settings-field settings-field--toggle">
          <input
            type="checkbox"
            checked={usageAnalytics}
            onChange={(e) => setUsageAnalytics(e.target.checked)}
          />
          <span>
            <strong>Usage analytics</strong>
            <span className="settings-hint">
              Lets us use your activity in Umbrella to improve the program.
            </span>
          </span>
        </label>

        <div className="settings-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || usageAnalytics === saved}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status && (
            <span className={`settings-status settings-status--${status.type}`}>
              {status.msg}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
