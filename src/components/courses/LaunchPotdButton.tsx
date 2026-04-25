'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Inserts a row into org_potd_launches for the current org. RLS enforces
 * that only the org admin can do this; if a non-admin somehow lands on
 * this button, the insert fails with a row-policy violation we surface.
 */
export function LaunchPotdButton({
  orgId,
  userId,
}: {
  orgId: string
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLaunch() {
    const ok = window.confirm(
      'Launch POTD for your team? Episode 1 unlocks today, and a new episode unlocks each day after. This action cannot be undone from the app.'
    )
    if (!ok) return

    setSubmitting(true)
    setError(null)
    const { error: insertErr } = await supabase
      .from('org_potd_launches')
      .insert({ org_id: orgId, launched_by: userId })

    setSubmitting(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="potd-launch-cta">
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleLaunch}
        disabled={submitting || pending}
      >
        {submitting ? 'Launching…' : 'Launch POTD for my team'}
      </button>
      {error && <p className="potd-launch-error">Could not launch: {error}</p>}
    </div>
  )
}
