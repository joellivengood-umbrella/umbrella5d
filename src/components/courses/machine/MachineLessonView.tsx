'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContentPlayer } from '@/components/courses/ContentPlayer'
import type { ActivityAnswer, LessonBlock } from '@/lib/courses'

/**
 * The interactive body of a 5D Machine lesson.
 *
 * Renders the lesson's blocks (content sections + an activity), each
 * numbered item carrying a manual checkbox (Option A). A slim progress
 * bar tracks how many checkpoints are done; when all are checked the
 * lesson rolls up to content_progress (feeding Program Progress) and a
 * completion banner appears. Activity answer boxes autosave.
 */
export function MachineLessonView({
  userId,
  lessonId,
  partNumber,
  lessonNumber,
  blocks,
  initialCheckedIds,
  initialAnswers,
  initiallyComplete,
}: {
  userId: string
  lessonId: string
  partNumber: number | null
  lessonNumber: number | null
  blocks: LessonBlock[]
  initialCheckedIds: string[]
  initialAnswers: ActivityAnswer[]
  initiallyComplete: boolean
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialCheckedIds)
  )
  const [pending, setPending] = useState<Set<string>>(new Set())
  const completeRef = useRef(initiallyComplete)

  // The "X.Y." address prefix (e.g. "1.2.") for numbered items.
  const prefix =
    partNumber != null && lessonNumber != null
      ? `${partNumber}.${lessonNumber}.`
      : ''

  const checkpointBlocks = blocks.filter((b) => b.isCheckpoint)
  const totalCheckpoints = checkpointBlocks.length
  const checkedCount = checkpointBlocks.filter((b) => checked.has(b.id)).length
  const isComplete = totalCheckpoints > 0 && checkedCount === totalCheckpoints
  const pct = totalCheckpoints
    ? Math.round((checkedCount / totalCheckpoints) * 100)
    : 0

  async function toggle(blockId: string) {
    if (pending.has(blockId)) return
    const willCheck = !checked.has(blockId)

    const prevChecked = checked
    const nextChecked = new Set(checked)
    if (willCheck) nextChecked.add(blockId)
    else nextChecked.delete(blockId)

    setChecked(nextChecked)
    setPending((p) => new Set(p).add(blockId))

    const supabase = createClient()
    const res = willCheck
      ? await supabase
          .from('lesson_block_checks')
          .upsert(
            { user_id: userId, block_id: blockId },
            // insert-or-nothing: the table has no UPDATE policy by design
            // (a check is toggled by insert/delete), so never hit a
            // conflicting UPDATE.
            { onConflict: 'user_id,block_id', ignoreDuplicates: true }
          )
      : await supabase
          .from('lesson_block_checks')
          .delete()
          .eq('user_id', userId)
          .eq('block_id', blockId)

    if (res.error) {
      setChecked(prevChecked) // rollback
      setPending((p) => {
        const n = new Set(p)
        n.delete(blockId)
        return n
      })
      return
    }

    // Roll completion up to content_progress only on a true transition,
    // so we don't spam the table on every click.
    const nextComplete =
      totalCheckpoints > 0 && checkpointBlocks.every((b) => nextChecked.has(b.id))
    if (nextComplete !== completeRef.current) {
      if (nextComplete) {
        await supabase
          .from('content_progress')
          .upsert(
            { user_id: userId, content_item_id: lessonId },
            { onConflict: 'user_id,content_item_id' }
          )
      } else {
        await supabase
          .from('content_progress')
          .delete()
          .eq('user_id', userId)
          .eq('content_item_id', lessonId)
      }
      completeRef.current = nextComplete
    }

    setPending((p) => {
      const n = new Set(p)
      n.delete(blockId)
      return n
    })
  }

  // ── Group content blocks into numbered sections (a checkpoint heading
  //    plus the blocks that follow it until the next heading). ──
  const contentBlocks = blocks.filter((b) => b.section === 'content')
  const activityBlocks = blocks.filter((b) => b.section === 'activity')

  type Group = { checkpoint: LessonBlock | null; number: string | null; body: LessonBlock[] }
  const groups: Group[] = []
  let headingCount = 0
  let current: Group | null = null
  for (const b of contentBlocks) {
    if (b.blockType === 'heading' && b.isCheckpoint) {
      headingCount += 1
      current = { checkpoint: b, number: `${prefix}${headingCount}`, body: [] }
      groups.push(current)
    } else {
      if (!current) {
        current = { checkpoint: null, number: null, body: [] }
        groups.push(current)
      }
      current.body.push(b)
    }
  }

  // Activity question items get the "5D X.Y.N" numbering. Built in a
  // plain loop (not a .map callback) to keep render free of mutation.
  const activityItems: { block: LessonBlock; number: string | null }[] = []
  let questionCount = 0
  for (const b of activityBlocks) {
    if (b.blockType === 'question') {
      questionCount += 1
      activityItems.push({ block: b, number: `5D ${prefix}${questionCount}` })
    } else {
      activityItems.push({ block: b, number: null })
    }
  }

  // Answer lookup keyed "blockId:promptIndex".
  const answerMap = new Map<string, string>()
  for (const a of initialAnswers) {
    answerMap.set(`${a.blockId}:${a.promptIndex}`, a.answerText)
  }

  return (
    <div className="m-lesson">
      <div className={'m-progress' + (isComplete ? ' is-complete' : '')}>
        <div className="m-progress__row">
          <span className="m-progress__label">
            {isComplete ? 'Lesson complete' : 'Your progress'}
          </span>
          <span className="m-progress__count">
            {checkedCount} / {totalCheckpoints}
          </span>
        </div>
        <div className="m-progress__track" aria-hidden="true">
          <div className="m-progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="m-content">
        {groups.map((g, gi) => (
          <section
            key={g.checkpoint?.id ?? `lead-${gi}`}
            className={
              'm-item' +
              (g.checkpoint && checked.has(g.checkpoint.id) ? ' is-checked' : '')
            }
          >
            <div className="m-item__gutter">
              {g.checkpoint && g.number ? (
                <CheckPill
                  number={g.number}
                  checked={checked.has(g.checkpoint.id)}
                  pending={pending.has(g.checkpoint.id)}
                  onToggle={() => toggle(g.checkpoint!.id)}
                />
              ) : null}
            </div>
            <div className="m-item__body">
              {g.checkpoint?.data.text ? (
                <h2 className="m-item__heading">{g.checkpoint.data.text}</h2>
              ) : null}
              {g.body.map((b) => (
                <BlockBody key={b.id} block={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── Activity ── */}
      {activityItems.length > 0 && (
        <div className="m-activity">
          {activityItems.map(({ block: b, number }) => {
            if (b.blockType === 'heading') {
              return (
                <h2 key={b.id} className="m-activity__title">
                  {b.data.text}
                </h2>
              )
            }
            if (b.blockType === 'question') {
              const prompts = b.data.prompts ?? []
              return (
                <section
                  key={b.id}
                  className={
                    'm-item' + (checked.has(b.id) ? ' is-checked' : '')
                  }
                >
                  <div className="m-item__gutter">
                    <CheckPill
                      number={number ?? ''}
                      checked={checked.has(b.id)}
                      pending={pending.has(b.id)}
                      onToggle={() => toggle(b.id)}
                    />
                  </div>
                  <div className="m-item__body">
                    {prompts.map((prompt, pi) => (
                      <AnswerBox
                        key={pi}
                        userId={userId}
                        blockId={b.id}
                        promptIndex={pi}
                        prompt={prompt}
                        initialText={answerMap.get(`${b.id}:${pi}`) ?? ''}
                      />
                    ))}
                  </div>
                </section>
              )
            }
            // rich_text / media note inside the activity, aligned to the body column
            return (
              <div key={b.id} className="m-item m-item--note">
                <div className="m-item__gutter" />
                <div className="m-item__body">
                  <BlockBody block={b} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isComplete && (
        <div className="m-complete" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Lesson complete. Nice work.</span>
        </div>
      )}
    </div>
  )
}

/** A numbered pill that doubles as the checkbox for a section/item. */
function CheckPill({
  number,
  checked,
  pending,
  onToggle,
}: {
  number: string
  checked: boolean
  pending: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={checked}
      aria-label={checked ? `Mark ${number} not done` : `Mark ${number} done`}
      className={'m-pill' + (checked ? ' is-checked' : '')}
    >
      {checked && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      <span className="m-pill__num">{number}</span>
    </button>
  )
}

/** Renders one non-heading block (rich text or media). */
function BlockBody({ block }: { block: LessonBlock }) {
  if (block.blockType === 'rich_text') {
    return (
      <div
        className="m-prose"
        dangerouslySetInnerHTML={{ __html: block.data.html ?? '' }}
      />
    )
  }
  if (block.blockType === 'audio' || block.blockType === 'video') {
    return (
      <div className="m-media">
        <ContentPlayer
          mediaUrl={block.data.url ?? null}
          mediaKind={block.blockType === 'audio' ? 'audio' : 'video'}
          title={block.data.title ?? ''}
        />
        {block.data.title ? (
          <p className="m-media__caption">{block.data.title}</p>
        ) : null}
      </div>
    )
  }
  // A non-checkpoint heading sitting in a body (uncommon) — render plain.
  if (block.blockType === 'heading' && block.data.text) {
    return <h3 className="m-subheading">{block.data.text}</h3>
  }
  return null
}

/** An autosaving free-text answer box for one activity prompt. */
function AnswerBox({
  userId,
  blockId,
  promptIndex,
  prompt,
  initialText,
}: {
  userId: string
  blockId: string
  promptIndex: number
  prompt: string
  initialText: string
}) {
  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef(initialText)

  async function save(value: string) {
    if (value === lastSaved.current) {
      setStatus('saved')
      return
    }
    setStatus('saving')
    const supabase = createClient()
    const { error } = await supabase.from('activity_answers').upsert(
      {
        user_id: userId,
        block_id: blockId,
        prompt_index: promptIndex,
        answer_text: value,
      },
      { onConflict: 'user_id,block_id,prompt_index' }
    )
    if (error) {
      setStatus('idle')
    } else {
      lastSaved.current = value
      setStatus('saved')
    }
  }

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setText(v)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 1000)
  }

  function onBlur() {
    if (timer.current) clearTimeout(timer.current)
    save(text)
  }

  return (
    <div className="m-answer">
      <p className="m-answer__prompt">{prompt}</p>
      <textarea
        className="m-answer__input"
        value={text}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Type your answer..."
        rows={3}
      />
      <span className="m-answer__status" aria-live="polite">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
      </span>
    </div>
  )
}
