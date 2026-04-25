import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Gate every /admin route on profiles.is_platform_admin.
 * Non-admins get a 404, not a 403 — the route is invisible to them.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_platform_admin) notFound()

  return <>{children}</>
}
