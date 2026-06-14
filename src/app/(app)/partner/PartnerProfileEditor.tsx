'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Partner } from '@/lib/org-queries'

/**
 * The partner's editable profile: their invite code (read-only, copyable —
 * this is what they hand to organizations) plus name + description. The
 * code and ownership are column-locked in the DB, so only name/description
 * can be written here.
 */
export function PartnerProfileEditor({ partner }: { partner: Partner }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState(partner.name)
  const [description, setDescription] = useState(partner.description ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error'
    msg: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setStatus({ type: 'error', msg: 'Partner name is required.' })
      return
    }
    setSaving(true)
    setStatus(null)
    const { error } = await supabase
      .from('partners')
      .update({ name: trimmed, description: description.trim() || null })
      .eq('id', partner.id)
    setSaving(false)
    if (error) {
      console.error('partner update error', error)
      setStatus({ type: 'error', msg: 'Could not save. Please try again.' })
      return
    }
    setStatus({ type: 'success', msg: 'Saved.' })
    // Re-render the server component so the page heading reflects the new name.
    router.refresh()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(partner.inviteCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setStatus({
        type: 'error',
        msg: 'Could not copy — select the code and copy it manually.',
      })
    }
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Partner profile</h2>
        <p>This is how organizations see you, and how they join you.</p>
      </header>

      <div className="partner-code">
        <span className="partner-code__label">Your partner invite code</span>
        <div className="partner-code__row">
          <code className="partner-code__value">{partner.inviteCode}</code>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={copyCode}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="partner-code__hint">
          Share this with organizations to bring them under your partnership.
          Keep it private — anyone who uses it becomes the manager of a new
          organization owned by you.
        </p>
      </div>

      <form onSubmit={handleSave} className="settings-form partner-form">
        <label className="settings-field">
          <span>Partner name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setStatus(null)
            }}
            maxLength={120}
          />
        </label>
        <label className="settings-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setStatus(null)
            }}
            rows={3}
            maxLength={500}
            placeholder="A short description of your partnership (optional)"
          />
        </label>
        <div className="settings-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {status && (
            <span
              className={`settings-status settings-status--${status.type}`}
              role={status.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {status.msg}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
