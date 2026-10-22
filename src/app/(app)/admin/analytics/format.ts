/**
 * Formatting shared by the analytics page (server) and its charts (client).
 * Plain functions only, so both sides render identical strings.
 */

const INTEGER = new Intl.NumberFormat('en-US')
const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const ONE_DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** 1,284 below ten thousand; 12.9K / 4.2M above. */
export function formatCount(n: number): string {
  return Math.abs(n) >= 10_000 ? COMPACT.format(n) : INTEGER.format(Math.round(n))
}

/** One decimal; a small non-zero value reads "<0.1", never a misleading "0". */
export function formatDecimal(n: number): string {
  if (n > 0 && n < 0.05) return '<0.1'
  return ONE_DECIMAL.format(n)
}

/** A 0–1 ratio as a whole percentage ("25%"). */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

// Day strings (YYYY-MM-DD) are already local calendar dates in the
// reporting zone, so format them in UTC to avoid any second shift.
const DAY_SHORT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})
const DAY_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

/** "Oct 14" */
export function formatDay(day: string): string {
  return day ? DAY_SHORT.format(parseDay(day)) : ''
}

/** "Tue, Oct 14" */
export function formatDayLong(day: string): string {
  return day ? DAY_LONG.format(parseDay(day)) : ''
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** An instant as a calendar date in `tz` ("Sep 24, 2026"). */
export function formatInstant(iso: string, tz: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** An instant as a YYYY-MM-DD local date in `tz`. */
export function instantToDay(iso: string, tz: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** "America/Indiana/Indianapolis" -> "Indianapolis time". */
export function formatZone(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ')
  return city ? `${city} time` : 'UTC'
}

export type Delta = {
  direction: 'up' | 'down' | 'flat' | 'new' | 'none'
  text: string
}

/** Percent change vs the previous period, for a stat tile. */
export function percentDelta(current: number, previous: number): Delta {
  if (previous === 0 && current === 0) return { direction: 'none', text: 'No activity either period' }
  if (previous === 0) return { direction: 'new', text: 'New this period' }
  const change = (current - previous) / previous
  const pct = Math.round(Math.abs(change) * 100)
  if (pct === 0) return { direction: 'flat', text: 'No change' }
  return { direction: change > 0 ? 'up' : 'down', text: `${pct}%` }
}

/** Change in percentage points between two 0–1 ratios. */
export function pointDelta(current: number, previous: number): Delta {
  const pts = Math.round((current - previous) * 100)
  if (pts === 0) return { direction: 'flat', text: 'No change' }
  return {
    direction: pts > 0 ? 'up' : 'down',
    text: `${Math.abs(pts)} pt${Math.abs(pts) === 1 ? '' : 's'}`,
  }
}
