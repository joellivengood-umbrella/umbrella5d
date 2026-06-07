'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMobileNav } from './MobileNavProvider'
import type { OrgRole } from '@/lib/org-queries'

type Profile = {
  full_name: string | null
  organization_name: string | null
  role_title: string | null
  avatar_url: string | null
  org_id?: string | null
  timezone?: string | null
  is_platform_admin?: boolean | null
}

export function AppSidebar({
  userId,
  profile,
  orgRole,
}: {
  userId: string
  profile: Profile | null
  orgRole: OrgRole | null
}) {
  const pathname = usePathname()
  const { isOpen, close } = useMobileNav()
  const [pct, setPct] = useState(0)
  const supabase = createClient()

  const fetchProgress = useCallback(async () => {
    // Progress denominator is the Umbrella Program: every published
    // non-POTD item. POTD is bonus content and intentionally excluded
    // — an ever-growing daily-pod catalog shouldn't drag the program
    // completion bar down, and a user "completing the program"
    // shouldn't depend on listening to every pod ever published.
    //
    // The numerator counts only program completions to match the
    // denominator (POTD progress doesn't push the bar up either).
    const [{ count: programTotal }, { count: programDone }] =
      await Promise.all([
        supabase
          .from('content_items')
          .select('id', { count: 'exact', head: true })
          .eq('is_published', true)
          .neq('type', 'potd'),
        supabase
          .from('content_progress')
          .select('id, content_items!inner(type)', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', userId)
          .neq('content_items.type', 'potd'),
      ])

    const total = programTotal ?? 0
    const done = programDone ?? 0
    setPct(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0)
  }, [supabase, userId])

  useEffect(() => {
    // fetchProgress is async — the setState inside it only fires after
    // a network round-trip, so this isn't a cascading-render problem.
    // The lint rule pattern-matches the call shape, not the async-ness.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProgress()
    const onFocus = () => fetchProgress()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchProgress])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {/* Mobile drawer backdrop — tap to close. Inert on desktop (CSS). */}
      <div
        className={`mobile-nav-backdrop${isOpen ? ' is-visible' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`app-sidebar${isOpen ? ' is-open' : ''}`}
        aria-label="Dashboard navigation"
      >
      {/* User block */}
      <div className="sidebar-user">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sidebar-avatar"
          src={profile?.avatar_url || '/default_avatar.png'}
          alt="Profile"
        />
        <div className="sidebar-user-info">
          <p className="sidebar-name">{profile?.full_name || '—'}</p>
          <p className="sidebar-org">{profile?.organization_name || '—'}</p>
          <p className="sidebar-role">{profile?.role_title || '—'}</p>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="sidebar-progress">
        <div className="sidebar-progress__header">
          <span>Overall Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="sidebar-progress__track">
          <div className="sidebar-progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Primary nav. onClick closes the mobile drawer when a link is
          tapped (covers same-page taps that don't trigger a nav change). */}
      <nav className="sidebar-nav" onClick={close}>
        <p className="sidebar-section-label">Menu</p>

        <Link
          href="/dashboard"
          className={`sidebar-link${pathname === '/dashboard' ? ' is-active' : ''}`}
          aria-current={pathname === '/dashboard' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Dashboard</span>
        </Link>

        <Link
          href="/courses"
          className={`sidebar-link${pathname === '/courses' || (isActive('/courses') && !pathname.startsWith('/courses/potd')) ? ' is-active' : ''}`}
          aria-current={pathname === '/courses' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Courses</span>
        </Link>

        <Link
          href="/courses/potd"
          className={`sidebar-link${isActive('/courses/potd') ? ' is-active' : ''}`}
          aria-current={isActive('/courses/potd') ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span>Daily Pod</span>
        </Link>

        {orgRole === 'manager' && (
          <Link
            href="/team"
            className={`sidebar-link${isActive('/team') ? ' is-active' : ''}`}
            aria-current={isActive('/team') ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Team</span>
          </Link>
        )}

        <Link
          href="/feed"
          className={`sidebar-link${isActive('/feed') ? ' is-active' : ''}`}
          aria-current={isActive('/feed') ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Feed</span>
          <span className="sidebar-notif-badge" aria-label="8 unread posts">8</span>
        </Link>

        <Link
          href="/settings"
          className={`sidebar-link${isActive('/settings') ? ' is-active' : ''}`}
          aria-current={isActive('/settings') ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </Link>

        {profile?.is_platform_admin && (
          <Link
            href="/admin"
            className={`sidebar-link${isActive('/admin') ? ' is-active' : ''}`}
            aria-current={isActive('/admin') ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z" />
            </svg>
            <span>Admin</span>
          </Link>
        )}
      </nav>
      </aside>
    </>
  )
}
