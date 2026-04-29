import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app/AppNav'
import { AppSidebar } from '@/components/app/AppSidebar'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, organization_name, role_title, avatar_url, org_id, timezone, is_platform_admin'
    )
    .eq('id', user.id)
    .single()

  // Route to onboarding if this user hasn't set up their org yet.
  if (profile && !profile.org_id && !profile.organization_name) {
    redirect('/onboarding')
  }

  return (
    <>
      <AppNav />
      <div className="app-shell">
        <AppSidebar userId={user.id} profile={profile ?? null} />
        <div className="app-main">
          {children}
          <MarketingFooter />
        </div>
      </div>
    </>
  )
}
