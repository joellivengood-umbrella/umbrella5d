'use client'

import { useEffect, useRef } from 'react'

/**
 * A minimal WYSIWYG editor: bold, italic, and bullet/numbered lists over
 * a contentEditable area, storing sanitized HTML (the same shape the
 * lesson view renders). "Rich, but not Word." Uncontrolled after mount
 * to avoid caret jumps; the parent reads changes via onChange.
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI',
])

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== 1) continue
      const el = node as HTMLElement
      walk(el) // clean descendants first

      if (el.tagName === 'DIV') {
        // contentEditable often wraps lines in <div>; normalize to <p>.
        const p = doc.createElement('p')
        while (el.firstChild) p.appendChild(el.firstChild)
        el.replaceWith(p)
        continue
      }
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // Unwrap disallowed elements, keeping their (already-clean) content.
        const frag = doc.createDocumentFragment()
        while (el.firstChild) frag.appendChild(el.firstChild)
        el.replaceWith(frag)
        continue
      }
      for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name)
    }
  }

  walk(doc.body)
  return doc.body.innerHTML
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Initialize content once. Uncontrolled afterward (the DOM is the
  // source of truth; we only read it on input).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value
    try {
      // Emit semantic tags (<b>, <i>) rather than styled spans, so the
      // sanitizer keeps the formatting instead of stripping styles.
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      /* not supported — fine, lines just come through as <div>, which
         sanitize() normalizes to <p> anyway. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emit() {
    if (ref.current) onChange(sanitize(ref.current.innerHTML))
  }

  function exec(command: string) {
    document.execCommand(command, false)
    emit()
    ref.current?.focus()
  }

  return (
    <div className="rte">
      <div className="rte__toolbar">
        <button type="button" className="rte__btn" aria-label="Bold"
          onMouseDown={(e) => { e.preventDefault(); exec('bold') }}>
          <b>B</b>
        </button>
        <button type="button" className="rte__btn" aria-label="Italic"
          onMouseDown={(e) => { e.preventDefault(); exec('italic') }}>
          <i>I</i>
        </button>
        <span className="rte__divider" aria-hidden="true" />
        <button type="button" className="rte__btn" aria-label="Bullet list"
          onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}>
          • List
        </button>
        <button type="button" className="rte__btn" aria-label="Numbered list"
          onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList') }}>
          1. List
        </button>
      </div>
      <div
        ref={ref}
        className="rte__area"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder="Write the lesson text…"
      />
    </div>
  )
}
