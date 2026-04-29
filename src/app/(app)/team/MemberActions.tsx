'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OrgRole } from '@/lib/org-queries'

/**
 * Per-row action buttons on the manager's team roster.
 *
 * Surfaces two actions:
 *   - Promote: only shown for member-role rows. Sets role='manager'.
 *   - Remove: deletes the org_members row. The DB trigger
 *     on_org_member_removed cleans up the user's profile so they get
 *     redirected to onboarding next time they log in.
 *
 * Both actions confirm() before firing. Errors are surfaced as a small
 * inline message rather than swallowed.
 */
export function MemberActions({
  orgId,
  memberUserId,
  memberName,
  memberRole,
}: {
  orgId: string
  memberUserId: string
  memberName: string
  memberRole: OrgRole
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<'promote' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePromote() {
    const ok = window.confirm(
      `Promote ${memberName} to manager? They'll be able to invite ` +
        `members, launch POTD, and manage the team.`
    )
    if (!ok) return

    setBusy('promote')
    setError(null)
    const { error: updErr } = await supabase
      .from('org_members')
      .update({ role: 'manager' })
      .eq('org_id', orgId)
      .eq('user_id', memberUserId)
    setBusy(null)

    if (updErr) {
      console.error('MemberActions promote error', updErr)
      setError('Could not promote. Please try again.')
      return
    }
    startTransition(() => router.refresh())
  }

  async function handleRemove() {
    const ok = window.confirm(
      `Remove ${memberName} from the team? They'll lose access ` +
        `immediately and need to be re-invited if you want them back.`
    )
    if (!ok) return

    setBusy('remove')
    setError(null)
    const { error: delErr } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', memberUserId)
    setBusy(null)

    if (delErr) {
      console.error('MemberActions remove error', delErr)
      setError('Could not remove. Please try again.')
      return
    }
    startTransition(() => router.refresh())
  }

  const disabled = busy !== null || pending

  return (
    <div className="member-actions">
      {memberRole === 'member' && (
        <button
          type="button"
          className="member-actions__btn"
          onClick={handlePromote}
          disabled={disabled}
        >
          {busy === 'promote' ? 'Promoting…' : 'Promote'}
        </button>
      )}
      <button
        type="button"
        className="member-actions__btn member-actions__btn--danger"
        onClick={handleRemove}
        disabled={disabled}
      >
        {busy === 'remove' ? 'Removing…' : 'Remove'}
      </button>
      {error && <span className="member-actions__error">{error}</span>}
    </div>
  )
}
