import { createClient } from '@/lib/supabase/server'
import {
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  fetchAnalyticsDashboard,
  fetchPartnerOptions,
  type AnalyticsRange,
  type AnalyticsScope,
  type PartnerFilter,
} from '@/lib/admin-analytics'
import { AnalyticsDashboard } from './AnalyticsDashboard'

export const metadata = { title: 'Analytics' }
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

/**
 * Platform-admin analytics (gated by the /admin layout, and again inside
 * every admin_analytics_* RPC). Validates the URL, loads the slice, and
 * hands it to the view.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams

  // Whitelist the URL: unknown ranges fall back to 30 days; the partner
  // filter is '', 'none' or a well-formed id (the view checks it against
  // the real partners and says so if it doesn't exist).
  const rangeNum = Number(firstParam(params.range))
  const range: AnalyticsRange = (ANALYTICS_RANGES as readonly number[]).includes(rangeNum)
    ? (rangeNum as AnalyticsRange)
    : DEFAULT_ANALYTICS_RANGE
  const rawPartner = firstParam(params.partner).trim().toLowerCase()
  const partner: PartnerFilter =
    rawPartner === 'none' ? 'none' : UUID_RE.test(rawPartner) ? rawPartner : ''
  const scope: AnalyticsScope = {
    partnerId: partner && partner !== 'none' ? partner : null,
    unpartnered: partner === 'none',
  }

  const supabase = await createClient()
  const [partners, data] = await Promise.all([
    fetchPartnerOptions(supabase),
    fetchAnalyticsDashboard(supabase, { days: range, scope }),
  ])

  return (
    <AnalyticsDashboard range={range} partner={partner} partners={partners} data={data} />
  )
}
