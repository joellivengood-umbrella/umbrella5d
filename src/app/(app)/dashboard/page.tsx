import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { DashboardView } from './DashboardView'

export const metadata = {
  title: 'Progress Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Layout guarantees user exists, but narrow the type.
  if (!user) return null

  const [{ data: profile }, { data: progressRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completed', true),
  ])

  const completedIds = (progressRows ?? []).map((r) => r.lesson_id as string)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <>
      <BodyClass className="page-dashboard" />
      <DashboardView
        userId={user.id}
        firstName={firstName}
        initialCompleted={completedIds}
      />
    </>
  )
}
