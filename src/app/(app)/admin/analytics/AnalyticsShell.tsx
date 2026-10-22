'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ANALYTICS_RANGES,
  BREAKDOWN_HEADING_ID,
  DEFAULT_ANALYTICS_RANGE,
  analyticsHref,
  type AnalyticsRange,
  type PartnerFilter,
  type PartnerOption,
} from '@/lib/admin-analytics'

type Navigate = (
  /** partnerName: the partner's display name, for the select while it loads. */
  next: { range?: AnalyticsRange; partner?: PartnerFilter; partnerName?: string },
  /** focusId: the element to move focus to if the clicked link unmounts. */
  opts?: { focusId?: string }
) => void

const AnalyticsNavContext = createContext<{
  range: AnalyticsRange
  navigate: Navigate
} | null>(null)

/**
 * The dashboard's single filter row (date range + partner) above everything
 * it scopes. A change navigates inside a transition, so the current
 * dashboard stays on screen — dimmed — until the next slice arrives.
 *
 * The controls show the chosen filters immediately (optimistic state):
 * otherwise the select would snap back to the old value for the whole round
 * trip, and a second change made meanwhile would be built from stale props
 * and silently drop the first.
 */
export function AnalyticsShell({
  range,
  partner,
  partners,
  children,
}: {
  range: AnalyticsRange
  partner: PartnerFilter
  partners: PartnerOption[]
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [view, setView] = useOptimistic<{
    range: AnalyticsRange
    partner: PartnerFilter
    partnerName?: string
  }>({ range, partner })
  const focusAfter = useRef<string | null>(null)

  const navigate = useCallback<Navigate>(
    (next, opts) => {
      const merged = {
        range: next.range ?? view.range,
        partner: next.partner ?? view.partner,
        partnerName: next.partner !== undefined ? next.partnerName : view.partnerName,
      }
      // The latest navigation decides: a range or select change made while
      // a link is still loading cancels that link's focus move.
      focusAfter.current = opts?.focusId ?? null
      startTransition(() => {
        setView(merged)
        router.push(analyticsHref(merged.range, merged.partner), { scroll: false })
      })
    },
    [view, router, setView]
  )

  // A filter link usually unmounts itself when its navigation lands (the
  // breakdown switches level, the unknown-partner notice goes away), which
  // would drop keyboard focus to <body>. Move focus to the link's chosen
  // target instead (or the breakdown heading if that section didn't load)
  // — only when focus really was lost, so it never leaves a control the
  // user has moved to since.
  useEffect(() => {
    const id = focusAfter.current
    if (pending || !id) return
    focusAfter.current = null
    const current = document.activeElement
    if (!current || current === document.body) {
      const target = document.getElementById(id) ?? document.getElementById(BREAKDOWN_HEADING_ID)
      target?.focus()
    }
  }, [pending])

  // While a partner the list doesn't have is in view or loading (the list
  // failed to load), keep an option for it so the select never shows a
  // value it has no option for.
  const unlisted =
    view.partner && view.partner !== 'none' && !partners.some((p) => p.id === view.partner)
      ? { id: view.partner, name: view.partnerName ?? 'Selected partner' }
      : null
  const options = unlisted ? [...partners, unlisted] : partners

  return (
    <AnalyticsNavContext.Provider value={{ range: view.range, navigate }}>
      <div className="analytics-filters">
        <div className="analytics-seg" role="group" aria-label="Date range">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`analytics-seg__btn${r === view.range ? ' is-active' : ''}`}
              aria-pressed={r === view.range}
              onClick={() => {
                if (r !== view.range) navigate({ range: r })
              }}
            >
              Last {r} days
            </button>
          ))}
        </div>

        <label className="analytics-filter">
          <span className="analytics-filter__label">Partner</span>
          <select
            className="analytics-filter__select"
            value={view.partner}
            onChange={(e) => navigate({ partner: e.target.value })}
          >
            <option value="">All partners</option>
            <option value="none">No partner</option>
            {options.length > 0 && (
              <optgroup label="Partners">
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <span className="analytics-filters__status" role="status">
          {pending ? 'Updating…' : ''}
        </span>
      </div>

      <div
        className={`analytics-body${pending ? ' is-pending' : ''}`}
        aria-busy={pending || undefined}
      >
        {children}
      </div>
    </AnalyticsNavContext.Provider>
  )
}

/**
 * A link to another partner slice of the dashboard (keeps the current date
 * range). A real <a href> for new-tab / no-JS use; a plain click goes
 * through the shell so the current view stays up while the next one loads,
 * and focus lands on `focusId` (the breakdown heading by default) afterwards.
 */
export function AnalyticsFilterLink({
  partner,
  partnerName,
  focusId = BREAKDOWN_HEADING_ID,
  className,
  children,
}: {
  partner: PartnerFilter
  /** The partner's name, shown in the select while its slice loads. */
  partnerName?: string
  focusId?: string
  className?: string
  children: ReactNode
}) {
  const ctx = useContext(AnalyticsNavContext)
  const href = analyticsHref(ctx?.range ?? DEFAULT_ANALYTICS_RANGE, partner)

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!ctx || e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    ctx.navigate({ partner, partnerName }, { focusId })
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
