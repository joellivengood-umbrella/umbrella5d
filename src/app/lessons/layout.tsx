import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app/AppNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/**
 * Layout for lesson pages. Same auth/onboarding guard as the (app) group,
 * but without the sidebar — lesson pages are intentionally distraction-free
 * (just the top nav + centered content).
 */
export default async function LessonsLayout({
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
    .select('organization_name, org_id')
    .eq('id', user.id)
    .single()

  if (profile && !profile.org_id && !profile.organization_name) {
    redirect('/onboarding')
  }

  return (
    <>
      <AppNav />
      {children}
      <MarketingFooter />
    </>
  )
}
