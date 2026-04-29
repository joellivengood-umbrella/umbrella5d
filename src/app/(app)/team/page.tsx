import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { fetchUserOrgRole, fetchOrgMembers } from '@/lib/org-queries'
import { TeamRoster } from './TeamRoster'
import { TeamInviteCode } from './TeamInviteCode'

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
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) notFound()

  // Manager-only page. Members and individuals get a 404, not a redirect,
  // because the URL is intentionally meant to feel "not a thing for you."
  const role = await fetchUserOrgRole(supabase, user.id, profile.org_id)
  if (role !== 'manager') notFound()

  // Org details + roster, in parallel.
  const [{ data: org }, members] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, invite_code')
      .eq('id', profile.org_id)
      .maybeSingle(),
    fetchOrgMembers(supabase, profile.org_id),
  ])

  if (!org) notFound()

  const orgName = (org.name as string) ?? 'Your team'
  const inviteCode = (org.invite_code as string | null) ?? null

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
      </main>
    </>
  )
}
