import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { OnboardingWizard } from '@/components/auth/OnboardingWizard'

export const metadata: Metadata = { title: 'Set up your account' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <header className="site-header" style={{ background: '#06060f' }}>
        <nav className="nav">
          <Link className="nav-brand" href="/dashboard">
            <Image
              src="/logo/Umbrella_logo.png"
              alt="Umbrella"
              className="nav-logo-img"
              width={200}
              height={52}
              priority
            />
          </Link>
          <div className="nav-actions">
            <SignOutButton />
          </div>
        </nav>
      </header>

      <main className="wiz-bg">
        <OnboardingWizard userId={user.id} />
      </main>
    </>
  )
}
