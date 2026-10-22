import type { ReactNode } from 'react'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'

/**
 * Shell for a public legal page (/terms, /privacy): marketing nav, a short
 * hero, then the document body as plain prose. The body is the page's
 * children, so dropping in the final text is a content-only change — and
 * when it changes, bump that document's version in src/lib/legal.ts so
 * every member is asked to accept it again.
 */
export function LegalDocument({
  title,
  version,
  children,
}: {
  title: string
  version: string
  children: ReactNode
}) {
  return (
    <>
      <MarketingNav />
      <main>
        <section className="mkt-hero mkt-hero--page mkt-hero--short">
          <div className="mkt-hero__glow" aria-hidden="true" />
          <div className="container">
            <h1 className="mkt-hero__title mkt-hero__title--page">{title}</h1>
            <p className="mkt-hero__sub">Version {version}</p>
          </div>
        </section>
        <section className="mkt-section">
          <div className="container legal-doc">{children}</div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
