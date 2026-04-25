'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Status = { type: 'success' | 'error'; msg: string } | null

/**
 * Curated subset of IANA timezones. Covers major US + world zones
 * without drowning the user in 400 options. Extend later if needed.
 */
const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Halifax', label: 'Atlantic — Halifax' },
  { value: 'America/Toronto', label: 'Eastern — Toronto' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'Europe/London', label: 'UK / Ireland — London' },
  { value: 'Europe/Paris', label: 'Central Europe — Paris' },
  { value: 'Europe/Berlin', label: 'Central Europe — Berlin' },
  { value: 'Europe/Athens', label: 'Eastern Europe — Athens' },
  { value: 'Asia/Dubai', label: 'Gulf — Dubai' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Shanghai', label: 'China' },
  { value: 'Asia/Tokyo', label: 'Japan' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
]

export function PreferencesSection({
  userId,
  initialShowCompleted,
  initialTimezone,
}: {
  userId: string
  initialShowCompleted: boolean
  initialTimezone: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const [showCompleted, setShowCompleted] = useState(initialShowCompleted)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        show_completed_items: showCompleted,
        timezone,
      })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: 'Preferences saved' })
      router.refresh()
    }
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Preferences</h2>
        <p>Tweak how the app behaves for you.</p>
      </header>

      <form onSubmit={handleSave} className="settings-form">
        <label className="settings-field settings-field--toggle">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          <span>
            <strong>Show completed items</strong>
            <span className="settings-hint">
              When off, finished segments and episodes are hidden from your
              course lists.
            </span>
          </span>
        </label>

        <label className="settings-field">
          <span>Time zone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save preferences'}
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
