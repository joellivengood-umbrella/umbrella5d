'use client'

import { useEffect } from 'react'

/**
 * Toggles a class on document.body for the lifetime of the component.
 * Used so page-level body selectors (e.g. `.page-dashboard .site-header`)
 * keep working in the App Router, where <body> is set in the root layout.
 */
export function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(' ').filter(Boolean)
    classes.forEach((c) => document.body.classList.add(c))
    return () => {
      classes.forEach((c) => document.body.classList.remove(c))
    }
  }, [className])
  return null
}
