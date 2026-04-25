/**
 * Pure date math for the POTD daily-drip schedule.
 *
 * After a manager launches POTD for an org, episode 1 unlocks the same
 * local day, episode 2 the next local day, and so on. "Local" means the
 * user's profile timezone (default America/Chicago).
 *
 * No Supabase / Next dependencies in this file so it stays trivially
 * testable.
 */

/**
 * Format a Date as 'YYYY-MM-DD' in the given IANA timezone.
 * Uses 'en-CA' locale because that locale's date format is ISO-like
 * (always yyyy-mm-dd) without DOM-Intl quirks.
 */
function localDateKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Difference in calendar days between two 'YYYY-MM-DD' strings. */
function daysBetweenKeys(earlier: string, later: string): number {
  const [y1, m1, d1] = earlier.split('-').map(Number)
  const [y2, m2, d2] = later.split('-').map(Number)
  // Use Date.UTC so daylight-saving transitions don't perturb the diff.
  const t1 = Date.UTC(y1, m1 - 1, d1)
  const t2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((t2 - t1) / 86_400_000)
}

/**
 * How many POTD episodes are unlocked for a user, given:
 *   - the org's launch timestamp (UTC, as stored)
 *   - the user's profile timezone
 *   - the current time (defaulted, but injectable for tests)
 *
 * Returns 0 if POTD has not been launched (or is launched in the future).
 * Otherwise returns N, meaning episodes with sequence_num <= N are unlocked.
 */
export function computeUnlockedThroughDay({
  launchedAt,
  timezone,
  now = new Date(),
}: {
  launchedAt: string | Date | null | undefined
  timezone: string
  now?: Date
}): number {
  if (!launchedAt) return 0
  const launchDate =
    typeof launchedAt === 'string' ? new Date(launchedAt) : launchedAt
  if (Number.isNaN(launchDate.getTime())) return 0

  const launchKey = localDateKey(launchDate, timezone)
  const todayKey = localDateKey(now, timezone)
  const days = daysBetweenKeys(launchKey, todayKey)
  if (days < 0) return 0
  return days + 1
}
