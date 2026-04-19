'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Status = { type: 'success' | 'error'; msg: string } | null

export function ProfileSection({
  userId,
  initialFullName,
  initialRoleTitle,
  initialAvatarUrl,
}: {
  userId: string
  initialFullName: string | null
  initialRoleTitle: string | null
  initialAvatarUrl: string | null
}) {
  const supabase = createClient()
  const router = useRouter()

  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [roleTitle, setRoleTitle] = useState(initialRoleTitle ?? '')
  const [avatarUrl, setAvatarUrl] = useState(
    initialAvatarUrl ?? '/default_avatar.png'
  )
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        role_title: roleTitle.trim() || null,
      })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: 'Profile saved' })
      router.refresh()
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', msg: 'Image must be under 5 MB' })
      return
    }
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      setStatus({ type: 'error', msg: 'Unsupported file type' })
      return
    }

    setSaving(true)
    setStatus(null)

    const path = `${userId}/avatar_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setSaving(false)
      setStatus({ type: 'error', msg: uploadError.message })
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    setSaving(false)
    if (updateError) {
      setStatus({ type: 'error', msg: updateError.message })
    } else {
      setAvatarUrl(publicUrl)
      setStatus({ type: 'success', msg: 'Profile picture updated' })
      router.refresh()
    }

    // Reset input so re-uploading the same file re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Profile</h2>
        <p>How your account appears across the platform.</p>
      </header>

      <div className="settings-avatar-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt="Your profile picture"
          className="settings-avatar"
          width={88}
          height={88}
        />
        <div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            Change picture
          </button>
          <p className="settings-hint">PNG, JPG, WebP, or GIF. Max 5 MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleAvatarChange}
          style={{ display: 'none' }}
        />
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <label className="settings-field">
          <span>Display name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
          />
        </label>

        <label className="settings-field">
          <span>Job title / role</span>
          <input
            type="text"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. Sales Manager"
            maxLength={80}
          />
        </label>

        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
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
