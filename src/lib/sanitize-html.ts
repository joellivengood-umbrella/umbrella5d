import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize lesson rich-text HTML down to a formatting-only allowlist.
 *
 * Lesson `rich_text` blocks are rendered to every learner via
 * dangerouslySetInnerHTML (see MachineLessonView). The editor has its own
 * sanitizer, but it's a browser-only UI helper — an author can bypass the
 * editor and write raw markup straight to `lesson_blocks` through the Supabase
 * client. This is the authoritative XSS boundary: it allows only the same
 * formatting tags the editor offers and strips ALL attributes (so no
 * `onerror`/`onclick`, no `src`/`href`, no `style`), and it runs on both the
 * server (SSR) and the client so a payload can't fire during the initial
 * server-rendered paint.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li']

export function sanitizeLessonHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  })
}
