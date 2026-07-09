'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { filterInlineStyle } from '@/lib/sanitize-html'

/**
 * A minimal WYSIWYG editor: bold, italic, underline, text/highlight colour,
 * paragraph alignment, and bullet/numbered lists over a contentEditable area,
 * storing sanitized HTML (the same shape the lesson view renders). "Rich, but
 * not Word." Uncontrolled after mount to avoid caret jumps; the parent reads
 * changes via onChange.
 *
 * A "</> HTML" toggle swaps the WYSIWYG area for a raw-HTML textarea, so an
 * admin can edit the markup directly. Either way the value is sanitized to
 * a safe set of formatting tags before it's stored (it's rendered to every
 * learner via dangerouslySetInnerHTML, so raw markup must never pass through).
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'UL', 'OL', 'LI',
])
const BLOCK_TAGS = new Set(['P', 'UL', 'OL'])

// Curated formatting palettes. Text "Default" resets to the base body colour;
// highlight "None" clears the highlight. (The sanitizer independently caps
// what can actually be stored, so these are UX, not the security boundary.)
const TEXT_COLORS = [
  { label: 'Default', value: '#111827' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
]
const HIGHLIGHT_COLORS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
]

// Three horizontal "text lines" at y = 4/8/12; each entry is [x1, x2] per line.
function alignIcon(lines: [number, number][]): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
    >
      {lines.map(([x1, x2], i) => (
        <line key={i} x1={x1} y1={4 + i * 4} x2={x2} y2={4 + i * 4} />
      ))}
    </svg>
  )
}
const ALIGNMENTS: { cmd: string; label: string; icon: ReactNode }[] = [
  { cmd: 'justifyLeft', label: 'Align left', icon: alignIcon([[2, 14], [2, 9], [2, 12]]) },
  { cmd: 'justifyCenter', label: 'Align center', icon: alignIcon([[2, 14], [4.5, 11.5], [3, 13]]) },
  { cmd: 'justifyRight', label: 'Align right', icon: alignIcon([[2, 14], [7, 14], [4, 14]]) },
  { cmd: 'justifyFull', label: 'Justify', icon: alignIcon([[2, 14], [2, 14], [2, 14]]) },
]

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== 1) continue
      const el = node as HTMLElement
      walk(el) // clean descendants first

      if (el.tagName === 'DIV') {
        // contentEditable often wraps lines in <div>; normalize to <p>,
        // carrying over any (filtered) alignment style.
        const p = doc.createElement('p')
        const divStyle = filterInlineStyle(el.getAttribute('style'))
        if (divStyle) p.setAttribute('style', divStyle)
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
      // Keep only a filtered style attribute (colour / highlight / align);
      // strip everything else.
      const style = filterInlineStyle(el.getAttribute('style'))
      for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name)
      // A <span> with no surviving style is meaningless — unwrap it, keeping
      // its (already-clean) content, so we don't accumulate empty spans.
      if (el.tagName === 'SPAN' && !style) {
        const frag = doc.createDocumentFragment()
        while (el.firstChild) frag.appendChild(el.firstChild)
        el.replaceWith(frag)
        continue
      }
      if (style) el.setAttribute('style', style)
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
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'rich' | 'html'>('rich')
  const [htmlDraft, setHtmlDraft] = useState('')
  const [palette, setPalette] = useState<null | 'text' | 'highlight'>(null)

  // Close an open colour palette on any click outside the toolbar.
  useEffect(() => {
    if (!palette) return
    const onDown = (e: MouseEvent) => {
      if (!toolbarRef.current?.contains(e.target as Node)) setPalette(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [palette])

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

  // Colour + alignment must emit CSS (<span style="color">, text-align), so
  // flip styleWithCSS on just for these, then back off so bold/italic/underline
  // keep emitting semantic <b>/<i>/<u> tags the sanitizer preserves.
  function execStyled(command: string, value?: string) {
    try {
      document.execCommand('styleWithCSS', false, 'true')
    } catch {
      /* unsupported — fall through */
    }
    document.execCommand(command, false, value)
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      /* noop */
    }
    emit()
    ref.current?.focus()
  }
  function applyColor(command: 'foreColor' | 'hiliteColor', value: string) {
    try {
      document.execCommand('styleWithCSS', false, 'true')
    } catch {
      /* unsupported */
    }
    const ok = document.execCommand(command, false, value)
    // Some engines expose highlight as backColor rather than hiliteColor.
    if (!ok && command === 'hiliteColor') {
      document.execCommand('backColor', false, value)
    }
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      /* noop */
    }
    emit()
    ref.current?.focus()
    setPalette(null)
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
      <div className="rte__toolbar" ref={toolbarRef}>
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
            <button type="button" className="rte__btn" aria-label="Underline"
              onMouseDown={(e) => { e.preventDefault(); exec('underline') }}>
              <u>U</u>
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
            <span className="rte__divider" aria-hidden="true" />

            {/* Text colour */}
            <div className="rte__colorwrap">
              <button type="button" className="rte__btn" aria-label="Text colour"
                aria-expanded={palette === 'text'}
                onMouseDown={(e) => { e.preventDefault(); setPalette((p) => (p === 'text' ? null : 'text')) }}>
                <span className="rte__ac">A</span>
              </button>
              {palette === 'text' && (
                <div className="rte__palette" role="menu">
                  {TEXT_COLORS.map((c) => (
                    <button key={c.value} type="button" className="rte__swatch"
                      title={c.label} aria-label={`Text ${c.label}`}
                      style={{ background: c.value }}
                      onMouseDown={(e) => { e.preventDefault(); applyColor('foreColor', c.value) }} />
                  ))}
                </div>
              )}
            </div>

            {/* Highlight colour */}
            <div className="rte__colorwrap">
              <button type="button" className="rte__btn" aria-label="Highlight colour"
                aria-expanded={palette === 'highlight'}
                onMouseDown={(e) => { e.preventDefault(); setPalette((p) => (p === 'highlight' ? null : 'highlight')) }}>
                <span className="rte__ac rte__ac--hl">A</span>
              </button>
              {palette === 'highlight' && (
                <div className="rte__palette" role="menu">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button key={c.value} type="button"
                      className={'rte__swatch' + (c.value === 'transparent' ? ' rte__swatch--none' : '')}
                      title={c.label} aria-label={`Highlight ${c.label}`}
                      style={c.value === 'transparent' ? undefined : { background: c.value }}
                      onMouseDown={(e) => { e.preventDefault(); applyColor('hiliteColor', c.value) }} />
                  ))}
                </div>
              )}
            </div>

            <span className="rte__divider" aria-hidden="true" />
            {ALIGNMENTS.map((a) => (
              <button key={a.cmd} type="button" className="rte__btn" aria-label={a.label}
                onMouseDown={(e) => { e.preventDefault(); execStyled(a.cmd) }}>
                {a.icon}
              </button>
            ))}
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
            Allowed: paragraphs, <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>,{' '}
            <code>&lt;u&gt;</code>, lists, and <code>&lt;span&gt;</code>/
            <code>&lt;p&gt;</code> with a <code>style</code> of text colour,
            highlight, or alignment only. Anything else is removed when you
            click <strong>Done</strong>.
          </p>
        </>
      )}
    </div>
  )
}
