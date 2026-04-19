import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { ProfileSection } from './ProfileSection'
import { PreferencesSection } from './PreferencesSection'
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
      'full_name, role_title, avatar_url, show_completed_items, timezone'
    )
    .eq('id', user.id)
    .single()

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
