import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Legal documents and the consent ledger (public.user_consent).
 *
 * Every member must have accepted the CURRENT Terms and Privacy Policy
 * versions to use the app — the (app) layout sends anyone who hasn't to
 * /consent. To make everyone re-accept after a document changes, bump its
 * version here (any new string; a date reads best).
 *
 * The data notice records the member's usage-analytics choice. Analytics is
 * on by default; turning it off (Settings) appends a row with
 * {usage_analytics: false}, and the database then refuses that member's
 * analytics events (see 20261022_consent_capture.sql).
 */

export const TERMS_VERSION = '2026-10-draft'
export const PRIVACY_VERSION = '2026-10-draft'
export const DATA_NOTICE_VERSION = '2026-10-draft'

export const TERMS_PATH = '/terms'
export const PRIVACY_PATH = '/privacy'
export const CONSENT_PATH = '/consent'

type MaybeClient = SupabaseClient // relaxed typing — schema isn't codegen'd

/** Has this member accepted the current Terms and Privacy Policy? */
export async function hasAcceptedCurrentTerms(
  supabase: MaybeClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_consent')
    .select('document, policy_version')
    .eq('user_id', userId)
    .in('document', ['terms', 'privacy'])
  if (error) {
    // Don't lock a member out of the app over a transient read error;
    // the next page load checks again.
    console.error('hasAcceptedCurrentTerms error', error)
    return true
  }
  const rows = (data ?? []) as { document: string; policy_version: string }[]
  return (
    rows.some((r) => r.document === 'terms' && r.policy_version === TERMS_VERSION) &&
    rows.some((r) => r.document === 'privacy' && r.policy_version === PRIVACY_VERSION)
  )
}

/** The member's current usage-analytics choice (on unless they turned it off). */
export async function fetchUsageAnalyticsChoice(
  supabase: MaybeClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_consent')
    .select('choices')
    .eq('user_id', userId)
    .eq('document', 'data_notice')
    .order('consented_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const choice = (data?.choices as Record<string, unknown> | undefined)?.usage_analytics
  return choice !== false
}

/**
 * Record acceptance of the current Terms + Privacy Policy and the data
 * notice. `usageAnalytics` carries the member's existing choice forward (a
 * re-accept after a document update must never switch an opt-out back on);
 * a brand-new member starts with it on.
 */
export async function recordAcceptance(
  supabase: MaybeClient,
  userId: string,
  usageAnalytics: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_consent').insert([
    { user_id: userId, document: 'terms', policy_version: TERMS_VERSION, choices: {} },
    { user_id: userId, document: 'privacy', policy_version: PRIVACY_VERSION, choices: {} },
    {
      user_id: userId,
      document: 'data_notice',
      policy_version: DATA_NOTICE_VERSION,
      choices: { usage_analytics: usageAnalytics },
    },
  ])
  return { error: error?.message ?? null }
}

/** Record a change to the member's usage-analytics choice (Settings). */
export async function recordUsageAnalyticsChoice(
  supabase: MaybeClient,
  userId: string,
  allowed: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_consent').insert({
    user_id: userId,
    document: 'data_notice',
    policy_version: DATA_NOTICE_VERSION,
    choices: { usage_analytics: allowed },
  })
  return { error: error?.message ?? null }
}
