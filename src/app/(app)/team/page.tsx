import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import {
  fetchUserOrgRole,
  fetchOrgMembers,
  fetchOrgPotdLaunch,
  fetchTeamProgress,
} from '@/lib/org-queries'
import { fetchTotalsByType } from '@/lib/content-queries'
import { computeUnlockedThroughDay } from '@/lib/potd-unlock'
import { TeamRoster } from './TeamRoster'
import { TeamInviteCode } from './TeamInviteCode'
import { TeamProgress } from './TeamProgress'

export const metadata = { title: 'Team' }

export default async function TeamPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // We need org_id to know which org to load. Anyone without one gets
  // a 404 — they're either an individual or unfinished onboarding.
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, timezone')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) notFound()

  // Manager-only page. Members and individuals get a 404, not a redirect,
  // because the URL is intentionally meant to feel "not a thing for you."
  const role = await fetchUserOrgRole(supabase, user.id, profile.org_id)
  if (role !== 'manager') notFound()

  // Org details + roster + POTD launch + global content totals, all in
  // parallel. We need launch + totals to compute the team's accessible
  // denominator (BSS + EOS + Machine + unlocked POTD).
  const [{ data: org }, members, launch, totals] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, invite_code')
      .eq('id', profile.org_id)
      .maybeSingle(),
    fetchOrgMembers(supabase, profile.org_id),
    fetchOrgPotdLaunch(supabase, profile.org_id),
    fetchTotalsByType(supabase),
  ])

  if (!org) notFound()

  const orgName = (org.name as string) ?? 'Your team'
  const inviteCode = (org.invite_code as string | null) ?? null

  // Same accessible-totals math as the sidebar/dashboard: total POTD
  // is clamped to the unlock window so locked episodes don't pad the
  // denominator. Every team member sees the same denominator (orgs
  // share an unlock window).
  const unlockedThroughDay = computeUnlockedThroughDay({
    launchedAt: launch?.launchedAt ?? null,
    timezone: profile.timezone ?? 'America/Chicago',
  })
  const accessiblePotdTotal = Math.min(totals.potd ?? 0, unlockedThroughDay)
  const accessibleTotal =
    (totals.bss ?? 0) +
    (totals.eos ?? 0) +
    (totals.machine ?? 0) +
    accessiblePotdTotal

  // Per-member completed counts, RLS-gated to manager-only via the
  // "managers can view team progress" policy.
  const memberIds = members.map((m) => m.userId)
  const progress = await fetchTeamProgress(
    supabase,
    memberIds,
    unlockedThroughDay
  )

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main settings-main">
        <div className="courses-header">
          <p className="section-eyebrow">Team</p>
          <h1>{orgName}</h1>
          <p className="courses-header__blurb">
            Invite new members, see who&rsquo;s on your team, and manage
            your organization.
          </p>
        </div>

        {inviteCode && <TeamInviteCode inviteCode={inviteCode} />}

        <TeamRoster
          orgId={profile.org_id}
          members={members}
          currentUserId={user.id}
        />

        <TeamProgress
          members={members}
          progress={progress}
          accessibleTotal={accessibleTotal}
          currentUserId={user.id}
        />
      </main>
    </>
  )
}
