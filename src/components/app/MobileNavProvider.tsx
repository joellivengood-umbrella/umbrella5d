'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'

/**
 * Shared open/close state for the mobile navigation drawer.
 *
 * The hamburger button lives in the header (AppNav) and the drawer is
 * the sidebar (AppSidebar) — two separate components — so they
 * coordinate through this context rather than prop-drilling.
 *
 * The drawer auto-closes on navigation (pathname change) and on Escape,
 * and locks body scroll while open. Desktop never opens it (the
 * hamburger is hidden by CSS above 768px), so this is inert there.
 */
type MobileNavContextValue = {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) {
    throw new Error('useMobileNav must be used within <MobileNavProvider>')
  }
  return ctx
}

export function MobileNavProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const toggle = useCallback(() => setIsOpen((o) => !o), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Close on navigation. Setting false when already false is a no-op in
  // React (it bails out), so there's no cascading re-render here — the
  // lint rule pattern-matches the shape, not the actual behaviour.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(false)
  }, [pathname])

  // While open: lock body scroll + close on Escape.
  useEffect(() => {
    if (!isOpen) return
    document.body.classList.add('mobile-nav-open')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('mobile-nav-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  return (
    <MobileNavContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </MobileNavContext.Provider>
  )
}
