import type { Metadata } from 'next'
import { LegalDocument } from '@/components/marketing/LegalDocument'
import { TERMS_VERSION } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms of Service | Umbrella',
  description: 'The terms for using the Umbrella Program.',
}

// PLACEHOLDER until the final Terms of Service are ready: replace the body
// below with the final text and bump TERMS_VERSION in src/lib/legal.ts.
export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" version={TERMS_VERSION}>
      <p>
        Our full Terms of Service are being finalized and will be published
        here before Umbrella opens to the public.
      </p>
      <p>
        Questions in the meantime can go to{' '}
        <a href="mailto:support@bz5d.com">support@bz5d.com</a>.
      </p>
    </LegalDocument>
  )
}
