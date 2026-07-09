import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize lesson rich-text HTML down to a formatting-only allowlist.
 *
 * Lesson `rich_text` blocks are rendered to every learner via
 * dangerouslySetInnerHTML (see MachineLessonView). The editor has its own
 * sanitizer, but it's a browser-only UI helper — an author can bypass the
 * editor and write raw markup straight to `lesson_blocks` through the Supabase
 * client. This is the authoritative XSS boundary: it allows only formatting
 * tags plus a tightly-restricted `style` attribute (text colour, highlight
 * colour, paragraph alignment — nothing that can load an asset or hijack
 * layout), strips every other attribute, and runs on both the server (SSR)
 * and the client so a payload can't fire during the initial paint.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'ul', 'ol', 'li',
]

// The ONLY CSS properties allowed to survive in a style="" attribute. Enough
// for colour + alignment; deliberately excludes anything that can position,
// size, load a URL, or otherwise be abused for UI-redress / tracking.
const ALLOWED_STYLE_PROPS = new Set(['color', 'background-color', 'text-align'])

// Reject any value that could smuggle a URL, script, or CSS comment through.
const UNSAFE_STYLE_VALUE = /url\(|expression|javascript:|<|>|\/\*|\\/i

/**
 * Reduce an inline `style` string to the allowed formatting properties with
 * safe values, returned as a normalized "prop: value; …" string ('' if none
 * survive). Shared with the editor's own pre-store sanitizer so the two agree.
 */
export function filterInlineStyle(cssText: string | null | undefined): string {
  if (!cssText) return ''
  const kept: string[] = []
  for (const decl of cssText.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    if (!value || !ALLOWED_STYLE_PROPS.has(prop)) continue
    if (UNSAFE_STYLE_VALUE.test(value)) continue
    kept.push(`${prop}: ${value}`)
  }
  return kept.join('; ')
}

// DOMPurify strips dangerous style *values* but keeps any *property*; this hook
// constrains the property set to our allowlist. Registered once for the module.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'style') return
  const filtered = filterInlineStyle(data.attrValue)
  if (filtered) data.attrValue = filtered
  else data.keepAttr = false
})

export function sanitizeLessonHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['style'],
  })
}
