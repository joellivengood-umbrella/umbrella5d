import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMachineLanding } from './machine-queries'

/**
 * Dashboard-only reads: the member's climb through the 5D Machine (for the
 * Part-by-Part strip and the "Up next" fallback) and their latest activity
 * answer (for "Put it to work"). Both degrade to null on error — a
 * dashboard section must never take the page down.
 */

type MaybeClient = SupabaseClient // relaxed typing — schema isn't codegen'd

export type JourneyLesson = {
  id: string
  sequenceNum: number
  title: string | null
  /** "1.3" — Part.Lesson */
  address: string
  done: boolean
}

export type JourneyPart = {
  number: number
  title: string
  lessons: JourneyLesson[]
  done: number
}

export type MachineJourney = {
  parts: JourneyPart[]
  totalLessons: number
  doneLessons: number
  /** The first lesson not yet finished (in course order); null when all done. */
  next: (JourneyLesson & { partNumber: number; partTitle: string }) | null
  /** The Part the member is in now (the next lesson's), or null when done. */
  currentPart: number | null
}

/** Published Parts and lessons, in order, with the member's completion. */
export async function fetchMachineJourney(
  supabase: MaybeClient,
  completedIds: Set<string>
): Promise<MachineJourney | null> {
  try {
    const landing = await fetchMachineLanding(supabase)
    const parts: JourneyPart[] = landing
      .filter((p) => p.isPublished)
      .map((p) => {
        const lessons = p.lessons
          .filter((l) => l.isPublished)
          .map((l, i) => ({
            id: l.id,
            sequenceNum: l.sequenceNum,
            title: l.title,
            address: `${p.sortIndex}.${l.partSortIndex ?? i + 1}`,
            done: completedIds.has(l.id),
          }))
        return {
          number: p.sortIndex,
          title: p.title,
          lessons,
          done: lessons.filter((l) => l.done).length,
        }
      })
      .filter((p) => p.lessons.length > 0)
    if (parts.length === 0) return null

    let next: MachineJourney['next'] = null
    for (const p of parts) {
      const l = p.lessons.find((x) => !x.done)
      if (l) {
        next = { ...l, partNumber: p.number, partTitle: p.title }
        break
      }
    }
    return {
      parts,
      totalLessons: parts.reduce((s, p) => s + p.lessons.length, 0),
      doneLessons: parts.reduce((s, p) => s + p.done, 0),
      next,
      currentPart: next?.partNumber ?? null,
    }
  } catch (err) {
    console.error('fetchMachineJourney error', err)
    return null
  }
}

export type LatestAnswer = {
  prompt: string | null
  answer: string
  lessonTitle: string | null
  lessonSequenceNum: number
  /** "1.2" when the lesson sits in a Part */
  address: string | null
}

/**
 * The member's most recently saved 5D Machine activity answer (non-empty),
 * with the question it answered and the lesson it came from.
 */
export async function fetchLatestActivityAnswer(
  supabase: MaybeClient,
  userId: string
): Promise<LatestAnswer | null> {
  try {
    const { data: rows, error } = await supabase
      .from('activity_answers')
      .select('block_id, prompt_index, answer_text, updated_at')
      .eq('user_id', userId)
      .neq('answer_text', '')
      .order('updated_at', { ascending: false })
      .limit(10)
    if (error || !rows?.length) return null

    // The newest answer whose lesson the member can still see (a lesson may
    // since have been unpublished or removed) — fall back to older ones.
    for (const row of rows as { block_id: string; prompt_index: number; answer_text: string }[]) {
      const answer = row.answer_text.trim()
      if (!answer) continue

      const { data: block } = await supabase
        .from('lesson_blocks')
        .select('lesson_id, data')
        .eq('id', row.block_id)
        .maybeSingle()
      if (!block) continue
      const prompts = ((block.data as { prompts?: string[] } | null)?.prompts ?? []) as string[]

      const { data: lesson } = await supabase
        .from('content_items')
        .select('title, sequence_num, part_sort_index, machine_parts(sort_index)')
        .eq('id', block.lesson_id as string)
        .maybeSingle()
      if (!lesson) continue
      const part = Array.isArray(lesson.machine_parts) ? lesson.machine_parts[0] : lesson.machine_parts
      const partNo = (part as { sort_index?: number } | null)?.sort_index
      const lessonNo = lesson.part_sort_index as number | null

      return {
        prompt: prompts[row.prompt_index]?.trim() || null,
        answer,
        lessonTitle: (lesson.title as string | null) ?? null,
        lessonSequenceNum: lesson.sequence_num as number,
        address: partNo != null && lessonNo != null ? `${partNo}.${lessonNo}` : null,
      }
    }
    return null
  } catch (err) {
    console.error('fetchLatestActivityAnswer error', err)
    return null
  }
}
