import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service_role key.
 * NEVER import this from client components — it bypasses RLS.
 * Only use in:
 *   - route handlers (app/api/...)
 *   - server actions
 *   - server components that truly need admin access
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
