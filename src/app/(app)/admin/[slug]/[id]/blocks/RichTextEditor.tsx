'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A minimal WYSIWYG editor: bold, italic, and bullet/numbered lists over
 * a contentEditable area, storing sanitized HTML (the same shape the
 * lesson view renders). "Rich, but not Word." Uncontrolled after mount
 * to avoid caret jumps; the parent reads changes via onChange.
 *
 * A "</> HTML" toggle swaps the WYSIWYG area for a raw-HTML textarea, so an
 * admin can edit the markup directly. Either way the value is sanitized to
 * a safe set of formatting tags before it's stored (it's rendered to every
 * learner via dangerouslySetInnerHTML, so raw markup must never pass through).
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI',
])
const BLOCK_TAGS = new Set(['P', 'UL', 'OL'])

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

  // Wrap runs of top-level inline content (bare text + <b>/<i>/<u>/<br>) in
  // <p>, so the stored HTML is always block-delimited. Without this, a first
  // line typed before any Enter stays unwrapped and a block/flex renderer
  // splits it into one row per inline node.
  const body = doc.body
  const out: Node[] = []
  let run: HTMLParagraphElement | null = null
  for (const node of Array.from(body.childNodes)) {
    const isBlock =
      node.nodeType === 1 && BLOCK_TAGS.has((node as HTMLElement).tagName)
    if (isBlock) {
      run = null
      out.push(node)
    } else {
      // Drop whitespace-only text sitting between blocks.
      if (node.nodeType === 3 && !node.textContent?.trim() && !run) continue
      if (!run) {
        run = doc.createElement('p')
        out.push(run)
      }
      run.appendChild(node)
    }
  }
  body.replaceChildren(...out)

  return body.innerHTML
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'rich' | 'html'>('rich')
  const [htmlDraft, setHtmlDraft] = useState('')

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

  // Switch WYSIWYG → raw HTML: show the current (sanitized, so clean and
  // <p>-wrapped) markup in the textarea.
  function openHtml() {
    const current = ref.current ? sanitize(ref.current.innerHTML) : value
    setHtmlDraft(current)
    setMode('html')
  }

  // Switch raw HTML → WYSIWYG: sanitize the edited markup back into the
  // contentEditable and notify the parent.
  function closeHtml() {
    const clean = sanitize(htmlDraft)
    if (ref.current) ref.current.innerHTML = clean
    onChange(clean)
    setMode('rich')
    requestAnimationFrame(() => ref.current?.focus())
  }

  function onHtmlInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setHtmlDraft(e.target.value)
    // Keep the parent in sync (sanitized) even if it saves while in HTML mode.
    onChange(sanitize(e.target.value))
  }

  return (
    <div className="rte">
      <div className="rte__toolbar">
        {mode === 'rich' && (
          <>
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
          </>
        )}
        <button
          type="button"
          className={`rte__btn rte__btn--code${mode === 'html' ? ' is-active' : ''}`}
          aria-pressed={mode === 'html'}
          onMouseDown={(e) => {
            e.preventDefault()
            if (mode === 'html') closeHtml()
            else openHtml()
          }}
        >
          {mode === 'html' ? 'Done' : '</> HTML'}
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
        hidden={mode === 'html'}
      />

      {mode === 'html' && (
        <>
          <textarea
            className="rte__code"
            value={htmlDraft}
            onChange={onHtmlInput}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Raw HTML"
          />
          <p className="rte__code-hint">
            Allowed tags: paragraphs, <code>&lt;b&gt;</code>,{' '}
            <code>&lt;i&gt;</code>, <code>&lt;u&gt;</code>, and lists. Anything
            else is removed when you click <strong>Done</strong>.
          </p>
        </>
      )}
    </div>
  )
}
