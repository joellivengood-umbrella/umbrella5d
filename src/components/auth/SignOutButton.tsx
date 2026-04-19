'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton({
  className = 'btn btn--primary btn--sm',
  children = 'Sign Out',
}: {
  className?: string
  children?: React.ReactNode
}) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button type="button" className={className} onClick={handleSignOut}>
      {children}
    </button>
  )
}
