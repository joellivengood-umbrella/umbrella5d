'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_SECTION_TITLES,
  LESSON_SECTIONS,
  type LessonBlock,
  type LessonBlockType,
  type LessonSection,
  type SectionTitles,
} from '@/lib/courses'
import { RichTextEditor } from './RichTextEditor'
import { MediaUpload } from './MediaUpload'

type Status = { type: 'success' | 'error'; msg: string } | null

/** Flat, editable view of a lesson_blocks row (data fields hoisted). */
type EditBlock = {
  id: string
  blockType: LessonBlockType
  isCheckpoint: boolean
  text: string
  html: string
  url: string
  title: string
  prompts: string[]
}

// Block menus per section. The two read sections have no Question
// button; questions (answer boxes) live only in Instructions, which the
// DB also enforces.
const READ_TYPES: { type: LessonBlockType; label: string }[] = [
  { type: 'heading', label: 'Step heading' },
  { type: 'rich_text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'audio', label: 'Audio' },
  { type: 'video', label: 'Video' },
]
const INSTRUCTION_TYPES: { type: LessonBlockType; label: string }[] = [
  { type: 'question', label: 'Question' },
  { type: 'rich_text', label: 'Text' },
  { type: 'heading', label: 'Sub-heading' },
  { type: 'image', label: 'Image' },
  { type: 'audio', label: 'Audio' },
  { type: 'video', label: 'Video' },
]

const SECTION_HINTS: Record<LessonSection, string> = {
  prerequisites:
    'Read-and-watch content. Step headings are the numbered, checkable items (1.1.1, 1.1.2…).',
  objectives:
    'Read-and-watch content. Step numbering continues from the section above.',
  instructions:
    'The to-do questions (numbered 5D 1.1.1…). Each Question is checkable and may hold more than one answer box.',
}

function toEdit(b: LessonBlock): EditBlock {
  return {
    id: b.id,
    blockType: b.blockType,
    isCheckpoint: b.isCheckpoint,
    text: b.data.text ?? '',
    html: b.data.html ?? '',
    url: b.data.url ?? '',
    title: b.data.title ?? '',
    prompts: b.data.prompts ?? [],
  }
}

function newBlock(type: LessonBlockType, section: LessonSection): EditBlock {
  return {
    id: crypto.randomUUID(),
    blockType: type,
    // Questions are always checkpoints; headings in the read sections
    // default to numbered/checkable steps; instructions sub-headings
    // are plain titles.
    isCheckpoint:
      type === 'question'
        ? true
        : type === 'heading' && section !== 'instructions',
    text: '',
    html: '',
    url: '',
    title: '',
    prompts: type === 'question' ? [''] : [],
  }
}

function emptySections(): Record<LessonSection, EditBlock[]> {
  return { prerequisites: [], objectives: [], instructions: [] }
}

export function LessonBlockEditor({
  lessonId,
  initialBlocks,
  initialTitles,
}: {
  lessonId: string
  initialBlocks: LessonBlock[]
  initialTitles: SectionTitles | null
}) {
  const router = useRouter()
  const [sections, setSections] = useState<Record<LessonSection, EditBlock[]>>(
    () => {
      const init = emptySections()
      for (const b of initialBlocks) init[b.section].push(toEdit(b))
      return init
    }
  )
  const [titles, setTitles] = useState<Record<LessonSection, string>>({
    prerequisites: initialTitles?.prerequisites ?? '',
    objectives: initialTitles?.objectives ?? '',
    instructions: initialTitles?.instructions ?? '',
  })
  const savedIds = useRef(new Set(initialBlocks.map((b) => b.id)))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  function update(section: LessonSection, id: string, patch: Partial<EditBlock>) {
    setSections((s) => ({
      ...s,
      [section]: s[section].map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
    setStatus(null)
  }
  function add(section: LessonSection, type: LessonBlockType) {
    setSections((s) => ({
      ...s,
      [section]: [...s[section], newBlock(type, section)],
    }))
    setStatus(null)
  }
  function remove(section: LessonSection, id: string) {
    setSections((s) => ({
      ...s,
      [section]: s[section].filter((b) => b.id !== id),
    }))
    setStatus(null)
  }
  function move(section: LessonSection, id: string, dir: -1 | 1) {
    setSections((s) => {
      const arr = s[section]
      const i = arr.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= arr.length) return s
      const next = arr.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...s, [section]: next }
    })
    setStatus(null)
  }
  function setTitle(section: LessonSection, value: string) {
    setTitles((t) => ({ ...t, [section]: value }))
    setStatus(null)
  }

  function toPayload(b: EditBlock, section: LessonSection, index: number) {
    let data: Record<string, unknown> = {}
    if (b.blockType === 'heading') data = { text: b.text }
    else if (b.blockType === 'rich_text') data = { html: b.html }
    else if (b.blockType === 'question')
      data = { prompts: b.prompts.map((p) => p.trim()).filter(Boolean) }
    else data = { url: b.url.trim(), title: b.title.trim() } // audio | video | image

    // Checkpoints: questions, or headings in the read sections. An
    // instructions heading is a plain title (matches the DB constraint
    // and the learner view, which gives it no checkbox).
    const is_checkpoint =
      b.blockType === 'question'
        ? true
        : b.blockType === 'heading' && section !== 'instructions'
          ? b.isCheckpoint
          : false

    return {
      id: b.id,
      lesson_id: lessonId,
      section,
      sort_index: index,
      block_type: b.blockType,
      data,
      is_checkpoint,
    }
  }

  async function save() {
    setSaving(true)
    setStatus(null)

    const payload = LESSON_SECTIONS.flatMap((s) =>
      sections[s].map((b, i) => toPayload(b, s, i))
    )
    const currentIds = new Set(payload.map((p) => p.id))
    const toDelete = [...savedIds.current].filter((id) => !currentIds.has(id))

    const supabase = createClient()

    const { error: upErr } = await supabase
      .from('lesson_blocks')
      .upsert(payload, { onConflict: 'id' })
    if (upErr) {
      setSaving(false)
      setStatus({ type: 'error', msg: upErr.message })
      return
    }

    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('lesson_blocks')
        .delete()
        .in('id', toDelete)
      if (delErr) {
        setSaving(false)
        setStatus({ type: 'error', msg: delErr.message })
        return
      }
    }

    // Persist section-title overrides (only names that differ from the
    // defaults; null clears the column back to all-defaults).
    const overrides: Record<string, string> = {}
    for (const s of LESSON_SECTIONS) {
      const t = titles[s].trim()
      if (t && t !== DEFAULT_SECTION_TITLES[s]) overrides[s] = t
    }
    const { error: titlesErr } = await supabase
      .from('content_items')
      .update({
        section_titles: Object.keys(overrides).length ? overrides : null,
      })
      .eq('id', lessonId)
    if (titlesErr) {
      setSaving(false)
      // 42703 = column doesn't exist: the three-sections migration
      // hasn't been run on this database yet.
      const msg =
        titlesErr.code === '42703'
          ? 'Blocks saved. Section titles need the latest database migration (20260610) before they can be customized.'
          : `Blocks saved, but section titles failed: ${titlesErr.message}`
      setStatus({ type: 'error', msg })
      return
    }

    savedIds.current = currentIds
    setSaving(false)
    setStatus({ type: 'success', msg: 'Saved' })
    router.refresh()
  }

  return (
    <div className="lbe">
      {LESSON_SECTIONS.map((s) => (
        <Section
          key={s}
          section={s}
          title={titles[s]}
          blocks={sections[s]}
          types={s === 'instructions' ? INSTRUCTION_TYPES : READ_TYPES}
          onTitle={setTitle}
          onUpdate={update}
          onAdd={add}
          onRemove={remove}
          onMove={move}
        />
      ))}

      <div className="lbe-savebar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {status ? (
          <span className={`settings-status settings-status--${status.type}`}>
            {status.msg}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  section,
  title,
  blocks,
  types,
  onTitle,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
}: {
  section: LessonSection
  title: string
  blocks: EditBlock[]
  types: { type: LessonBlockType; label: string }[]
  onTitle: (s: LessonSection, value: string) => void
  onUpdate: (s: LessonSection, id: string, patch: Partial<EditBlock>) => void
  onAdd: (s: LessonSection, t: LessonBlockType) => void
  onRemove: (s: LessonSection, id: string) => void
  onMove: (s: LessonSection, id: string, dir: -1 | 1) => void
}) {
  return (
    <section className="lbe-section">
      <header className="lbe-section__head">
        <label className="lbe-section__titlefield">
          <span>Section title</span>
          <input
            type="text"
            className="lbe-input"
            value={title}
            onChange={(e) => onTitle(section, e.target.value)}
            placeholder={DEFAULT_SECTION_TITLES[section]}
            maxLength={80}
          />
        </label>
        <p className="lbe-section__hint">
          {SECTION_HINTS[section]} Empty sections are hidden from learners.
        </p>
      </header>

      {blocks.length === 0 ? (
        <p className="lbe-section__empty">No blocks yet. Add one below.</p>
      ) : (
        <div className="lbe-blocks">
          {blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              section={section}
              index={i}
              total={blocks.length}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
        </div>
      )}

      <div className="lbe-add">
        <span className="lbe-add__label">Add:</span>
        {types.map((t) => (
          <button
            key={t.type}
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => onAdd(section, t.type)}
          >
            + {t.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function BlockCard({
  block,
  section,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: EditBlock
  section: LessonSection
  index: number
  total: number
  onUpdate: (s: LessonSection, id: string, patch: Partial<EditBlock>) => void
  onRemove: (s: LessonSection, id: string) => void
  onMove: (s: LessonSection, id: string, dir: -1 | 1) => void
}) {
  const TYPE_LABEL: Record<LessonBlockType, string> = {
    heading: section === 'instructions' ? 'Sub-heading' : 'Step heading',
    rich_text: 'Text',
    audio: 'Audio',
    video: 'Video',
    image: 'Image',
    question: 'Question',
  }

  return (
    <div className="lbe-card">
      <div className="lbe-card__bar">
        <span className="lbe-card__type">{TYPE_LABEL[block.blockType]}</span>
        <div className="lbe-card__actions">
          <button type="button" className="lbe-iconbtn" aria-label="Move up"
            disabled={index === 0} onClick={() => onMove(section, block.id, -1)}>↑</button>
          <button type="button" className="lbe-iconbtn" aria-label="Move down"
            disabled={index === total - 1} onClick={() => onMove(section, block.id, 1)}>↓</button>
          <button type="button" className="lbe-iconbtn lbe-iconbtn--danger" aria-label="Delete block"
            onClick={() => onRemove(section, block.id)}>✕</button>
        </div>
      </div>

      <div className="lbe-card__body">
        {block.blockType === 'heading' && (
          <>
            <input
              type="text"
              className="lbe-input"
              value={block.text}
              onChange={(e) => onUpdate(section, block.id, { text: e.target.value })}
              placeholder={
                section === 'instructions' ? 'Sub-heading' : 'Step heading'
              }
            />
            {section !== 'instructions' && (
              <label className="lbe-toggle">
                <input
                  type="checkbox"
                  checked={block.isCheckpoint}
                  onChange={(e) =>
                    onUpdate(section, block.id, { isCheckpoint: e.target.checked })
                  }
                />
                <span>Numbered, checkable step (learners tick it off)</span>
              </label>
            )}
          </>
        )}

        {block.blockType === 'rich_text' && (
          <RichTextEditor
            value={block.html}
            onChange={(html) => onUpdate(section, block.id, { html })}
          />
        )}

        {(block.blockType === 'audio' ||
          block.blockType === 'video' ||
          block.blockType === 'image') && (
          <>
            <MediaUpload
              kind={block.blockType}
              url={block.url}
              onChange={(url) => onUpdate(section, block.id, { url })}
            />
            <input
              type="text"
              className="lbe-input"
              value={block.title}
              onChange={(e) => onUpdate(section, block.id, { title: e.target.value })}
              placeholder={
                block.blockType === 'image' ? 'Caption / alt text (optional)' : 'Caption (optional)'
              }
            />
          </>
        )}

        {block.blockType === 'question' && (
          <QuestionEditor
            prompts={block.prompts}
            onChange={(prompts) => onUpdate(section, block.id, { prompts })}
          />
        )}
      </div>
    </div>
  )
}

function QuestionEditor({
  prompts,
  onChange,
}: {
  prompts: string[]
  onChange: (prompts: string[]) => void
}) {
  const list = prompts.length ? prompts : ['']
  return (
    <div className="lbe-prompts">
      {list.map((p, i) => (
        <div key={i} className="lbe-prompt">
          <textarea
            className="lbe-input"
            rows={2}
            value={p}
            onChange={(e) => {
              const next = list.slice()
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={`Prompt ${i + 1} (each gets its own answer box)`}
          />
          {list.length > 1 ? (
            <button
              type="button"
              className="lbe-iconbtn lbe-iconbtn--danger"
              aria-label="Remove prompt"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => onChange([...list, ''])}
      >
        + Add answer box
      </button>
    </div>
  )
}
