import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 * Same semantics — runs before routes render, handles auth/session refresh.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - logo/ (brand assets)
     * - files with extensions (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
