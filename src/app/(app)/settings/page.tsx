import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { fetchUserOrgRole } from '@/lib/org-queries'
import { ProfileSection } from './ProfileSection'
import { PreferencesSection } from './PreferencesSection'
import { OrganizationSection } from './OrganizationSection'
import { AccountSection } from './AccountSection'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, role_title, avatar_url, show_completed_items, timezone, org_id'
    )
    .eq('id', user.id)
    .single()

  // Manager-only: surface the org name + invite code so they can hand
  // the code to new members. Members and individuals don't see this
  // section at all.
  let managerOrg: { name: string; inviteCode: string } | null = null
  if (profile?.org_id) {
    const role = await fetchUserOrgRole(supabase, user.id, profile.org_id)
    if (role === 'manager') {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, invite_code')
        .eq('id', profile.org_id)
        .maybeSingle()
      if (org?.invite_code) {
        managerOrg = {
          name: (org.name as string) ?? 'Your organization',
          inviteCode: org.invite_code as string,
        }
      }
    }
  }

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main settings-main">
        <div className="courses-header">
          <p className="section-eyebrow">Settings</p>
          <h1>Your preferences</h1>
          <p className="courses-header__blurb">
            Manage your profile, viewing preferences, and account security.
          </p>
        </div>

        <ProfileSection
          userId={user.id}
          initialFullName={profile?.full_name ?? null}
          initialRoleTitle={profile?.role_title ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />

        {managerOrg && (
          <OrganizationSection
            organizationName={managerOrg.name}
            inviteCode={managerOrg.inviteCode}
          />
        )}

        <PreferencesSection
          userId={user.id}
          initialShowCompleted={profile?.show_completed_items ?? true}
          initialTimezone={profile?.timezone ?? 'America/Chicago'}
        />

        <AccountSection />
      </main>
    </>
  )
}
