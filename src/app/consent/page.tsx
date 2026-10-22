import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { ConsentForm } from '@/components/auth/ConsentForm'
import { fetchUsageAnalyticsChoice, hasAcceptedCurrentTerms } from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms and privacy' }

/**
 * Where the (app) layout sends a signed-in member who hasn't accepted the
 * current Terms and Privacy Policy — everyone who signed up before consent
 * capture existed, and everyone again whenever a document's version bumps.
 * New members accept on the signup form and never see this page.
 */
export default async function ConsentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (await hasAcceptedCurrentTerms(supabase, user.id)) redirect('/dashboard')

  // Any earlier acceptance means a document changed since they last agreed.
  const [{ count }, usageAnalytics] = await Promise.all([
    supabase
      .from('user_consent')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('document', ['terms', 'privacy']),
    fetchUsageAnalyticsChoice(supabase, user.id),
  ])
  const updated = (count ?? 0) > 0

  return (
    <>
      <header className="site-header" style={{ background: '#06060f' }}>
        <nav className="nav">
          <Link className="nav-brand" href="/">
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
        <div className="wiz">
          <div className="wiz__panel">
            <p className="wiz-eyebrow">One quick thing</p>
            <h1 className="wiz-title">
              {updated ? 'We’ve updated our terms' : 'Before you continue'}
            </h1>
            <p className="wiz-sub">
              {updated
                ? 'Please review and accept the latest Terms of Service and Privacy Policy to keep using Umbrella.'
                : 'Please review and accept our Terms of Service and Privacy Policy.'}
            </p>

            <ConsentForm userId={user.id} usageAnalytics={usageAnalytics} />
          </div>
        </div>
      </main>
    </>
  )
}
