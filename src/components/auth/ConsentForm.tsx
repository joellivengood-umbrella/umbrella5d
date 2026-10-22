'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordAcceptance } from '@/lib/legal'
import { LegalAgreement } from './LegalAgreement'

/** The accept step on /consent: one required checkbox, then into the app. */
export function ConsentForm({
  userId,
  usageAnalytics,
}: {
  userId: string
  /** The member's existing analytics choice, carried forward unchanged. */
  usageAnalytics: boolean
}) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setSaving(true)
    const { error: saveError } = await recordAcceptance(createClient(), userId, usageAnalytics)
    if (saveError) {
      setSaving(false)
      setError('Something went wrong saving that. Please try again.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <LegalAgreement checked={agreed} onChange={setAgreed} />

      {error && (
        <p className="legal-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
        <span>{saving ? 'Saving…' : 'Continue'}</span>
      </button>
    </form>
  )
}
