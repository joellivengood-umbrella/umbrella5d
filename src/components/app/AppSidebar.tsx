'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  full_name: string | null
  organization_name: string | null
  role_title: string | null
  avatar_url: string | null
  is_platform_admin?: boolean | null
}

export function AppSidebar({
  userId,
  profile,
}: {
  userId: string
  profile: Profile | null
}) {
  const pathname = usePathname()
  const [pct, setPct] = useState(0)
  const supabase = createClient()

  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const fetchProgress = useCallback(async () => {
    // Overall progress = completed content_progress rows / total published items.
    const [{ count: totalCount }, { count: doneCount }] = await Promise.all([
      supabase
        .from('content_items')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('content_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])
    const total = totalCount ?? 0
    const done = doneCount ?? 0
    setPct(total > 0 ? Math.round((done / total) * 100) : 0)
  }, [supabase, userId])

  useEffect(() => {
    fetchProgress()
    const onFocus = () => fetchProgress()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchProgress])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside className="app-sidebar" aria-label="Dashboard navigation">
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

      {/* Primary nav */}
      <nav className="sidebar-nav">
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
          className={`sidebar-link${isActive('/courses') ? ' is-active' : ''}`}
          aria-current={isActive('/courses') ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Courses</span>
        </Link>

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

      {/* Sidebar footer */}
      <div className="sidebar-footer">
        <button type="button" className="sidebar-link sidebar-signout" onClick={handleSignOut}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
