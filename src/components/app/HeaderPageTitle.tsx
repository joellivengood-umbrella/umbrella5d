'use client'

import { usePathname } from 'next/navigation'

/**
 * Contextual section label shown in the app header, right of the logo.
 * Anchors the left side of the header and tells the user where they are.
 *
 * Order matters: more specific prefixes (e.g. /courses/potd) are checked
 * before broader ones (/courses).
 */
const ROUTE_LABELS: ReadonlyArray<{ match: (p: string) => boolean; label: string }> = [
  { match: (p) => p === '/dashboard', label: 'Dashboard' },
  { match: (p) => p.startsWith('/courses/potd'), label: 'Daily Pod' },
  { match: (p) => p.startsWith('/courses'), label: 'Courses' },
  { match: (p) => p.startsWith('/team'), label: 'Team' },
  { match: (p) => p.startsWith('/feed'), label: 'Feed' },
  { match: (p) => p.startsWith('/settings'), label: 'Settings' },
  { match: (p) => p.startsWith('/admin'), label: 'Admin' },
]

export function HeaderPageTitle() {
  const pathname = usePathname()
  const entry = ROUTE_LABELS.find((r) => r.match(pathname))
  if (!entry) return null

  return (
    <>
      <span className="nav-divider" aria-hidden="true" />
      <span className="header-page-title">{entry.label}</span>
    </>
  )
}
