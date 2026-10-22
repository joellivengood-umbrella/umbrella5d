import type { Metadata } from 'next'
import { LegalDocument } from '@/components/marketing/LegalDocument'
import { PRIVACY_VERSION } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy | Umbrella',
  description: 'How Umbrella collects, uses and protects your information.',
}

// PLACEHOLDER until the final Privacy Policy is ready: replace the body
// below with the final text and bump PRIVACY_VERSION in src/lib/legal.ts.
export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" version={PRIVACY_VERSION}>
      <p>
        Our full Privacy Policy is being finalized and will be published here
        before Umbrella opens to the public.
      </p>
      <p>
        In the meantime, questions about your information can go to{' '}
        <a href="mailto:support@bz5d.com">support@bz5d.com</a>.
      </p>
    </LegalDocument>
  )
}
