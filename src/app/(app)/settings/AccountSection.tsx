'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = { type: 'success' | 'error'; msg: string } | null

export function AccountSection() {
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)

    if (newPassword.length < 8) {
      setStatus({ type: 'error', msg: 'Password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match' })
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: 'Password changed' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Account</h2>
        <p>Change your password. You stay signed in after updating.</p>
      </header>

      <form onSubmit={handleChange} className="settings-form">
        <label className="settings-field">
          <span>New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>

        <label className="settings-field">
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Updating…' : 'Change password'}
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
