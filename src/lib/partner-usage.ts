import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * How a partner's organizations are using the program, for the Partner
 * Dashboard. Aggregates only (never individual members), computed by the
 * get_partner_usage() RPC for the caller's own partnership
 * (supabase/migrations/20261023_partner_usage.sql). Parsed defensively so a
 * missing field reads as zero rather than breaking the page.
 */

export type PartnerUsageOrg = {
  id: string
  name: string
  members: number
  active: number
  completions: number
  /** Latest tracked activity or completion by any member (ISO), or null. */
  lastActive: string | null
}

export type PartnerUsage = {
  tz: string
  /** The 30 complete days the numbers cover (YYYY-MM-DD). */
  window: { start: string; end: string }
  trackingStarted: string | null
  kpis: {
    membersTotal: number
    active: number
    activePrev: number
    completions: number
    completionsPrev: number
    newMembers: number
    newMembersPrev: number
  }
  orgs: PartnerUsageOrg[]
  machine: {
    lessons: number
    members: number
    avgPct: number
    finished: number
    notStarted: number
    parts: { part: number; title: string; members: number }[]
  }
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.map(obj) : [])
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Null when the RPC failed (e.g. its migration hasn't been run yet). */
export async function fetchPartnerUsage(supabase: SupabaseClient): Promise<PartnerUsage | null> {
  const { data, error } = await supabase.rpc('get_partner_usage')
  if (error) {
    console.error('get_partner_usage error', error)
    return null
  }
  const o = obj(data)
  const w = obj(o.window)
  const k = obj(o.kpis)
  const m = obj(o.machine)
  return {
    tz: str(o.tz),
    window: { start: str(w.start), end: str(w.end) },
    trackingStarted: strOrNull(o.tracking_started),
    kpis: {
      membersTotal: num(k.members_total),
      active: num(k.active),
      activePrev: num(k.active_prev),
      completions: num(k.completions),
      completionsPrev: num(k.completions_prev),
      newMembers: num(k.new_members),
      newMembersPrev: num(k.new_members_prev),
    },
    orgs: arr(o.orgs).map((r) => ({
      id: str(r.id),
      name: str(r.name),
      members: num(r.members),
      active: num(r.active),
      completions: num(r.completions),
      lastActive: strOrNull(r.last_active),
    })),
    machine: {
      lessons: num(m.lessons),
      members: num(m.members),
      avgPct: num(m.avg_pct),
      finished: num(m.finished),
      notStarted: num(m.not_started),
      parts: arr(m.parts).map((p) => ({
        part: num(p.part),
        title: str(p.title),
        members: num(p.members),
      })),
    },
  }
}
