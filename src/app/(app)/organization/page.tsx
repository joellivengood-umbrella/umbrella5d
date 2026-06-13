import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import {
  fetchUserOrgRole,
  fetchOrgMembers,
  fetchTeams,
  fetchTeamMemberships,
} from '@/lib/org-queries'
import { OrgTeamsManager } from './OrgTeamsManager'

export const metadata = { title: 'My Organization' }
export const dynamic = 'force-dynamic'

/**
 * "My Organization" — a manager's wide workspace for their org: a Teams
 * list on the left and, on the right, the selected team's roster with a
 * search field to add anyone in the org into it.
 *
 * Manager-gated: the sidebar link only renders for managers, and this
 * page 404s anyone who isn't a manager of an org (matching
 * /organization/[memberId]).
 */
export default async function OrganizationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, organization_name')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) notFound()

  const role = await fetchUserOrgRole(supabase, user.id, profile.org_id)
  if (role !== 'manager') notFound()

  const [members, teams, memberships] = await Promise.all([
    fetchOrgMembers(supabase, profile.org_id),
    fetchTeams(supabase, profile.org_id),
    fetchTeamMemberships(supabase, profile.org_id),
  ])

  const orgName = profile.organization_name ?? 'My Organization'

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="org-main">
        <div className="courses-header">
          <p className="section-eyebrow">My Organization</p>
          <h1>{orgName}</h1>
        </div>

        <OrgTeamsManager
          orgId={profile.org_id}
          currentUserId={user.id}
          members={members}
          initialTeams={teams}
          initialMemberships={memberships}
        />
      </main>
    </>
  )
}
