'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { LessonBlock, LessonBlockType, LessonSection } from '@/lib/courses'
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

const CONTENT_TYPES: { type: LessonBlockType; label: string }[] = [
  { type: 'heading', label: 'Section heading' },
  { type: 'rich_text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'audio', label: 'Audio' },
  { type: 'video', label: 'Video' },
]
const ACTIVITY_TYPES: { type: LessonBlockType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'question', label: 'Question' },
  { type: 'rich_text', label: 'Text' },
  { type: 'image', label: 'Image' },
]

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
    // Content headings are numbered/checkable sections by default;
    // activity headings are plain titles; questions are always checkpoints.
    isCheckpoint:
      type === 'question' ? true : type === 'heading' ? section === 'content' : false,
    text: '',
    html: '',
    url: '',
    title: '',
    prompts: type === 'question' ? [''] : [],
  }
}

export function LessonBlockEditor({
  lessonId,
  initialBlocks,
}: {
  lessonId: string
  initialBlocks: LessonBlock[]
}) {
  const router = useRouter()
  const [content, setContent] = useState<EditBlock[]>(() =>
    initialBlocks.filter((b) => b.section === 'content').map(toEdit)
  )
  const [activity, setActivity] = useState<EditBlock[]>(() =>
    initialBlocks.filter((b) => b.section === 'activity').map(toEdit)
  )
  const savedIds = useRef(new Set(initialBlocks.map((b) => b.id)))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const setter = (section: LessonSection) =>
    section === 'content' ? setContent : setActivity

  function update(section: LessonSection, id: string, patch: Partial<EditBlock>) {
    setter(section)((arr) => arr.map((b) => (b.id === id ? { ...b, ...patch } : b)))
    setStatus(null)
  }
  function add(section: LessonSection, type: LessonBlockType) {
    setter(section)((arr) => [...arr, newBlock(type, section)])
    setStatus(null)
  }
  function remove(section: LessonSection, id: string) {
    setter(section)((arr) => arr.filter((b) => b.id !== id))
    setStatus(null)
  }
  function move(section: LessonSection, id: string, dir: -1 | 1) {
    setter(section)((arr) => {
      const i = arr.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= arr.length) return arr
      const next = arr.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setStatus(null)
  }

  function toPayload(b: EditBlock, section: LessonSection, index: number) {
    let data: Record<string, unknown> = {}
    if (b.blockType === 'heading') data = { text: b.text }
    else if (b.blockType === 'rich_text') data = { html: b.html }
    else if (b.blockType === 'question')
      data = { prompts: b.prompts.map((p) => p.trim()).filter(Boolean) }
    else data = { url: b.url.trim(), title: b.title.trim() } // audio | video | image

    // Only content-section headings and questions are checkpoints. An
    // activity heading is a plain title (the learner view renders it as
    // one), so it must never count toward completion.
    const is_checkpoint =
      b.blockType === 'question'
        ? true
        : b.blockType === 'heading' && section === 'content'
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

    const payload = [
      ...content.map((b, i) => toPayload(b, 'content', i)),
      ...activity.map((b, i) => toPayload(b, 'activity', i)),
    ]
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

    savedIds.current = currentIds
    setSaving(false)
    setStatus({ type: 'success', msg: 'Saved' })
    router.refresh()
  }

  return (
    <div className="lbe">
      <Section
        title="Lesson content"
        hint="The body learners read, watch, and listen to. Section headings are the numbered, checkable steps."
        section="content"
        blocks={content}
        types={CONTENT_TYPES}
        onUpdate={update}
        onAdd={add}
        onRemove={remove}
        onMove={move}
      />
      <Section
        title="Activity"
        hint="The to-do questions. Each Question is a numbered, checkable item and may hold more than one answer box."
        section="activity"
        blocks={activity}
        types={ACTIVITY_TYPES}
        onUpdate={update}
        onAdd={add}
        onRemove={remove}
        onMove={move}
      />

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
  title,
  hint,
  section,
  blocks,
  types,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
}: {
  title: string
  hint: string
  section: LessonSection
  blocks: EditBlock[]
  types: { type: LessonBlockType; label: string }[]
  onUpdate: (s: LessonSection, id: string, patch: Partial<EditBlock>) => void
  onAdd: (s: LessonSection, t: LessonBlockType) => void
  onRemove: (s: LessonSection, id: string) => void
  onMove: (s: LessonSection, id: string, dir: -1 | 1) => void
}) {
  return (
    <section className="lbe-section">
      <header className="lbe-section__head">
        <h2 className="lbe-section__title">{title}</h2>
        <p className="lbe-section__hint">{hint}</p>
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
    heading: 'Heading',
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
              placeholder={section === 'content' ? 'Section heading' : 'Activity title'}
            />
            {section === 'content' && (
              <label className="lbe-toggle">
                <input
                  type="checkbox"
                  checked={block.isCheckpoint}
                  onChange={(e) =>
                    onUpdate(section, block.id, { isCheckpoint: e.target.checked })
                  }
                />
                <span>Numbered, checkable section (a step learners tick off)</span>
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
