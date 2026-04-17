import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for server components / server actions.
 * Use in: Server Components, Server Actions, Route Handlers.
 *
 * This client is aware of the user's auth cookies, so RLS policies
 * will correctly apply based on the current user's session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll can be called from Server Components where cookies
            // cannot be modified — safe to ignore if middleware refreshes
            // the session.
          }
        },
      },
    }
  )
}
