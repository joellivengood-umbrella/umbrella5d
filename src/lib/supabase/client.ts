import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for browser (client components).
 * Use in: 'use client' files that need to read/write data from the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
