import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import {
  fetchUserOrgRole,
  fetchMemberAssignments,
  fetchTeamProgress,
} from '@/lib/org-queries'
import {
  fetchContentItems,
  fetchTotalsByType,
} from '@/lib/content-queries'
import { AssignmentList } from './AssignmentList'
import { AssignmentForm } from './AssignmentForm'

type RouteParams = { memberId: string }

export const metadata = { title: 'Team Member' }

export default async function ManageMemberPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { memberId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Caller must be in an org and a manager of it. Same gating as /team
  // — non-managers and orphans get a 404.
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.org_id) notFound()

  const callerRole = await fetchUserOrgRole(
    supabase,
    user.id,
    callerProfile.org_id
  )
  if (callerRole !== 'manager') notFound()

  // Verify the target user is actually a member of the caller's org —
  // otherwise the URL is bogus or pointing at someone in a different
  // team.
  const { data: targetMembership } = await supabase
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', callerProfile.org_id)
    .eq('user_id', memberId)
    .maybeSingle()

  if (!targetMembership) notFound()

  // Pull everything we need to render in parallel. POTD items are
  // still fetched for the assignment form — managers can assign POTD
  // bonus episodes even though POTD doesn't count toward program
  // progress.
  const [
    { data: targetProfile },
    assignments,
    totals,
    bssItems,
    eosItems,
    potdItems,
    machineItems,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', memberId)
      .single(),
    fetchMemberAssignments(supabase, memberId),
    fetchTotalsByType(supabase),
    fetchContentItems(supabase, 'bss'),
    fetchContentItems(supabase, 'eos'),
    fetchContentItems(supabase, 'potd'),
    fetchContentItems(supabase, 'machine'),
  ])

  // Program-only progress denominator (POTD intentionally excluded —
  // bonus content doesn't count toward program completion).
  const programTotal =
    (totals.bss ?? 0) + (totals.eos ?? 0) + (totals.machine ?? 0)

  // Single-member program-completed lookup. Reuses the team-progress
  // helper — it accepts an array of user IDs, we just pass one.
  const [progress] = await fetchTeamProgress(supabase, [memberId])
  const completed = Math.min(progress?.completed ?? 0, programTotal)
  const pct =
    programTotal > 0 ? Math.round((completed / programTotal) * 100) : 0

  const memberName = targetProfile?.full_name ?? '—'
  const memberAvatar = targetProfile?.avatar_url ?? '/default_avatar.png'
  const isManager = targetMembership.role === 'manager'
  const joinedAt = targetMembership.created_at as string
  const joinedLabel = formatDate(joinedAt)

  // Items already assigned to this member, used to filter the
  // assignment-form dropdown so we don't suggest duplicates.
  const assignedItemIds = new Set(assignments.map((a) => a.contentItemId))

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main settings-main">
        <Link href="/team" className="lesson-back-btn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="15"
            height="15"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to team
        </Link>

        <div className="member-detail__header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={memberAvatar}
            alt=""
            className="member-detail__avatar"
          />
          <div className="member-detail__heading">
            <p className="section-eyebrow">
              {isManager ? 'Manager' : 'Member'} · Joined {joinedLabel}
            </p>
            <h1>{memberName}</h1>
          </div>
        </div>

        <section className="settings-section">
          <header className="settings-section__header">
            <h2>Progress</h2>
            <p>How {memberName.split(' ')[0] || 'this member'} is doing across all available content.</p>
          </header>
          <div className="member-detail__progress">
            <div className="team-progress__track">
              <div
                className="team-progress__fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="team-progress__count">
              {pct}%
              <span className="team-progress__count-detail">
                {' '}
                ({completed} / {programTotal})
              </span>
            </span>
          </div>
        </section>

        <section className="settings-section">
          <header className="settings-section__header">
            <h2>Assignments</h2>
            <p>
              Items you&rsquo;ve called out for {memberName.split(' ')[0] || 'this member'} to work on.
            </p>
          </header>

          <AssignmentList
            assignments={assignments}
            memberName={memberName}
          />

          <AssignmentForm
            orgId={callerProfile.org_id}
            memberUserId={memberId}
            currentUserId={user.id}
            allItems={{
              bss: bssItems,
              eos: eosItems,
              potd: potdItems,
              machine: machineItems,
            }}
            alreadyAssignedIds={assignedItemIds}
          />
        </section>
      </main>
    </>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
