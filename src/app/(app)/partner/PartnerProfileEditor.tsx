'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Partner } from '@/lib/org-queries'

/**
 * The partner's editable profile: logo, name, and description — this is how
 * organizations see them. The invite code lives in the page header (it's
 * read-only); code and ownership are column-locked in the DB, so only the
 * logo / name / description can be written here.
 */
export function PartnerProfileEditor({
  partner,
  userId,
}: {
  partner: Partner
  userId: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState(partner.name)
  const [description, setDescription] = useState(partner.description ?? '')
  const [logoUrl, setLogoUrl] = useState(partner.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{
    type: 'success' | 'error'
    msg: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', msg: 'Logo must be under 5 MB.' })
      return
    }
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      setStatus({ type: 'error', msg: 'Unsupported file type.' })
      return
    }

    setUploading(true)
    setStatus(null)

    // Path is scoped to the owner's user id to satisfy the avatars-bucket
    // upload policy (first segment must be the uploader's uid).
    const path = `${userId}/partner-logo_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setUploading(false)
      setStatus({ type: 'error', msg: uploadError.message })
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('partners')
      .update({ avatar_url: publicUrl })
      .eq('id', partner.id)

    setUploading(false)
    if (updateError) {
      console.error('partner logo update error', updateError)
      setStatus({ type: 'error', msg: 'Could not save the logo. Try again.' })
      return
    }
    setLogoUrl(publicUrl)
    setStatus({ type: 'success', msg: 'Logo updated.' })
    router.refresh()

    // Reset input so re-uploading the same file re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Partner profile</h2>
        <p>This is how organizations see you, and how they join you.</p>
      </header>

      <div className="partner-logo-row">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt="Partner logo"
            className="partner-logo"
            width={72}
            height={72}
          />
        ) : (
          <div className="partner-logo partner-logo--empty" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase() || 'P'}
          </div>
        )}
        <div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Add logo'}
          </button>
          <p className="settings-hint">PNG, JPG, WebP, or GIF. Max 5 MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleLogoChange}
          style={{ display: 'none' }}
        />
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
