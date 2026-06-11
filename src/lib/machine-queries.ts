import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeLessonSection } from './courses'
import type {
  MachinePart,
  LessonBlock,
  LessonBlockType,
  LessonBlockData,
  ActivityAnswer,
  SectionTitles,
} from './courses'

/**
 * Server-side data helpers for the rich 5D Machine course experience
 * (Parts → Lessons → blocks, plus per-user checks and answers).
 *
 * Visibility is left to RLS: a learner sees published parts/lessons/
 * blocks; a platform admin also sees drafts (preview). These helpers do
 * NOT filter on is_published, so admins can preview unpublished content
 * before it goes live.
 */

type MaybeClient = SupabaseClient // relaxed typing — schema isn't codegen'd

/** A lesson summary for the landing grid (no blocks loaded). */
export type MachineLessonSummary = {
  id: string
  sequenceNum: number
  title: string | null
  partId: string | null
  partSortIndex: number | null
  isPublished: boolean
}

/** A Part with its lessons attached, for the landing grid. */
export type MachinePartWithLessons = MachinePart & {
  lessons: MachineLessonSummary[]
}

/** A single lesson with its Part context and ordered blocks. */
export type MachineLessonFull = {
  id: string
  sequenceNum: number
  title: string | null
  description: string | null
  mediaUrl: string | null
  isPublished: boolean
  partId: string | null
  partTitle: string | null
  partNumber: number | null // machine_parts.sort_index → the X in X.Y.Z
  lessonNumber: number | null // content_items.part_sort_index → the Y in X.Y.Z
  sectionTitles: SectionTitles | null // per-lesson overrides; null = defaults
  blocks: LessonBlock[]
}

/**
 * Per-lesson section-title overrides. Fetched separately and
 * failure-tolerant: the section_titles column only exists once
 * 20260610_machine_three_sections has run, and a missing column must
 * not take the lesson page down — it just means default titles.
 */
export async function fetchSectionTitles(
  supabase: MaybeClient,
  lessonId: string
): Promise<SectionTitles | null> {
  const { data, error } = await supabase
    .from('content_items')
    .select('section_titles')
    .eq('id', lessonId)
    .maybeSingle()
  if (error || !data) return null
  return (
    ((data as { section_titles: SectionTitles | null }).section_titles) ?? null
  )
}

/** "Part One", "Part Two"… (falls back to the digit past twelve). */
export function partOrdinal(n: number): string {
  const words = [
    'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  ]
  return words[n - 1] ?? String(n)
}

function toLessonBlock(row: Record<string, unknown>): LessonBlock {
  return {
    id: row.id as string,
    lessonId: row.lesson_id as string,
    // normalize tolerates legacy 'content'/'activity' rows written
    // before the three-section migration ran.
    section: normalizeLessonSection(row.section as string),
    sortIndex: row.sort_index as number,
    blockType: row.block_type as LessonBlockType,
    data: (row.data as LessonBlockData) ?? {},
    isCheckpoint: row.is_checkpoint as boolean,
  }
}

/**
 * Parts + their machine lessons for the landing grid. Empty array when
 * no Parts exist (the caller can then fall back to the legacy flat list).
 */
export async function fetchMachineLanding(
  supabase: MaybeClient
): Promise<MachinePartWithLessons[]> {
  const [partsRes, lessonsRes] = await Promise.all([
    supabase
      .from('machine_parts')
      .select('id, sort_index, title, subtitle, is_published')
      .order('sort_index', { ascending: true }),
    supabase
      .from('content_items')
      .select('id, sequence_num, title, part_id, part_sort_index, is_published')
      .eq('type', 'machine')
      .order('part_sort_index', { ascending: true })
      .order('sequence_num', { ascending: true }),
  ])

  if (partsRes.error) {
    console.error('fetchMachineLanding parts error', partsRes.error)
    throw new Error(`fetchMachineLanding failed: ${partsRes.error.message}`)
  }
  if (lessonsRes.error) {
    console.error('fetchMachineLanding lessons error', lessonsRes.error)
    throw new Error(`fetchMachineLanding failed: ${lessonsRes.error.message}`)
  }

  const lessonsByPart = new Map<string, MachineLessonSummary[]>()
  for (const row of lessonsRes.data ?? []) {
    const r = row as Record<string, unknown>
    const partId = (r.part_id as string | null) ?? null
    if (!partId) continue // flat (non-Part) lessons don't belong in the grid
    const lesson: MachineLessonSummary = {
      id: r.id as string,
      sequenceNum: r.sequence_num as number,
      title: (r.title as string | null) ?? null,
      partId,
      partSortIndex: (r.part_sort_index as number | null) ?? null,
      isPublished: r.is_published as boolean,
    }
    const arr = lessonsByPart.get(partId) ?? []
    arr.push(lesson)
    lessonsByPart.set(partId, arr)
  }

  return (partsRes.data ?? []).map((p): MachinePartWithLessons => {
    const row = p as Record<string, unknown>
    return {
      id: row.id as string,
      sortIndex: row.sort_index as number,
      title: row.title as string,
      subtitle: (row.subtitle as string | null) ?? null,
      isPublished: row.is_published as boolean,
      lessons: lessonsByPart.get(row.id as string) ?? [],
    }
  })
}

/**
 * A single machine lesson by its global sequence_num, with Part context
 * and ordered blocks. Returns null if not found / not visible.
 */
export async function fetchMachineLessonBySequence(
  supabase: MaybeClient,
  sequenceNum: number
): Promise<MachineLessonFull | null> {
  // No .maybeSingle(): a seeded rich lesson can share a sequence_num
  // with a legacy flat machine item, and maybeSingle() throws on more
  // than one row. Fetch all matches and prefer the Part-linked (rich)
  // one. No relationship embed either — the Part is resolved with a
  // plain follow-up query, sidestepping any PostgREST FK detection.
  const { data: rows, error } = await supabase
    .from('content_items')
    .select(
      'id, sequence_num, title, description, media_url, is_published, part_id, part_sort_index'
    )
    .eq('type', 'machine')
    .eq('sequence_num', sequenceNum)

  if (error) {
    console.error('fetchMachineLessonBySequence item error', error)
    throw new Error(`fetchMachineLessonBySequence failed: ${error.message}`)
  }
  const list = (rows ?? []) as Record<string, unknown>[]
  if (list.length === 0) return null

  const row = list.find((r) => r.part_id) ?? list[0]
  const lessonId = row.id as string

  // Resolve the Part on its own (only when the lesson belongs to one).
  let part: { sort_index: number; title: string } | null = null
  if (row.part_id) {
    const { data: partRow, error: partErr } = await supabase
      .from('machine_parts')
      .select('sort_index, title')
      .eq('id', row.part_id as string)
      .maybeSingle()
    if (partErr) {
      console.error('fetchMachineLessonBySequence part error', partErr)
      throw new Error(`fetchMachineLessonBySequence failed: ${partErr.message}`)
    }
    part = (partRow as { sort_index: number; title: string } | null) ?? null
  }

  const [blocksRes, sectionTitles] = await Promise.all([
    supabase
      .from('lesson_blocks')
      .select('id, lesson_id, section, sort_index, block_type, data, is_checkpoint')
      .eq('lesson_id', lessonId)
      .order('sort_index', { ascending: true })
      .order('id', { ascending: true }),
    fetchSectionTitles(supabase, lessonId),
  ])

  if (blocksRes.error) {
    console.error('fetchMachineLessonBySequence blocks error', blocksRes.error)
    throw new Error(
      `fetchMachineLessonBySequence failed: ${blocksRes.error.message}`
    )
  }

  return {
    id: lessonId,
    sequenceNum: row.sequence_num as number,
    title: (row.title as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    mediaUrl: (row.media_url as string | null) ?? null,
    isPublished: row.is_published as boolean,
    partId: (row.part_id as string | null) ?? null,
    partTitle: part?.title ?? null,
    partNumber: part?.sort_index ?? null,
    lessonNumber: (row.part_sort_index as number | null) ?? null,
    sectionTitles,
    blocks: (blocksRes.data ?? []).map((b) =>
      toLessonBlock(b as Record<string, unknown>)
    ),
  }
}

/**
 * The set of block IDs the given user has checked off, among `blockIds`.
 */
export async function fetchBlockChecks(
  supabase: MaybeClient,
  userId: string,
  blockIds: string[]
): Promise<Set<string>> {
  if (blockIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('lesson_block_checks')
    .select('block_id')
    .eq('user_id', userId)
    .in('block_id', blockIds)

  if (error) {
    console.error('fetchBlockChecks error', error)
    throw new Error(`fetchBlockChecks failed: ${error.message}`)
  }
  return new Set((data ?? []).map((r: { block_id: string }) => r.block_id))
}

/**
 * The given user's activity answers among `blockIds`.
 */
export async function fetchActivityAnswers(
  supabase: MaybeClient,
  userId: string,
  blockIds: string[]
): Promise<ActivityAnswer[]> {
  if (blockIds.length === 0) return []
  const { data, error } = await supabase
    .from('activity_answers')
    .select('block_id, prompt_index, answer_text')
    .eq('user_id', userId)
    .in('block_id', blockIds)

  if (error) {
    console.error('fetchActivityAnswers error', error)
    throw new Error(`fetchActivityAnswers failed: ${error.message}`)
  }
  return (data ?? []).map(
    (r: { block_id: string; prompt_index: number; answer_text: string }) => ({
      blockId: r.block_id,
      promptIndex: r.prompt_index,
      answerText: r.answer_text,
    })
  )
}

/**
 * All Parts, ordered, for admin use (RLS shows admins drafts too). Used
 * by the Parts manager and the lesson Part-assignment dropdown.
 */
export async function fetchMachinePartsList(
  supabase: MaybeClient
): Promise<MachinePart[]> {
  const { data, error } = await supabase
    .from('machine_parts')
    .select('id, sort_index, title, subtitle, is_published')
    .order('sort_index', { ascending: true })

  if (error) {
    console.error('fetchMachinePartsList error', error)
    throw new Error(`fetchMachinePartsList failed: ${error.message}`)
  }
  return (data ?? []).map((p) => {
    const r = p as Record<string, unknown>
    return {
      id: r.id as string,
      sortIndex: r.sort_index as number,
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      isPublished: r.is_published as boolean,
    }
  })
}

/**
 * Full machine structure for the admin: every Part with its lessons (in
 * order), plus the lessons that aren't in any Part yet. Like
 * fetchMachineLanding but it also surfaces the unassigned lessons so the
 * admin can spot and slot them.
 */
export async function fetchMachineAdminStructure(supabase: MaybeClient): Promise<{
  parts: MachinePartWithLessons[]
  unassigned: MachineLessonSummary[]
}> {
  const [partsRes, lessonsRes] = await Promise.all([
    supabase
      .from('machine_parts')
      .select('id, sort_index, title, subtitle, is_published')
      .order('sort_index', { ascending: true }),
    supabase
      .from('content_items')
      .select('id, sequence_num, title, part_id, part_sort_index, is_published')
      .eq('type', 'machine')
      .order('part_sort_index', { ascending: true })
      .order('sequence_num', { ascending: true }),
  ])

  if (partsRes.error) {
    console.error('fetchMachineAdminStructure parts error', partsRes.error)
    throw new Error(`fetchMachineAdminStructure failed: ${partsRes.error.message}`)
  }
  if (lessonsRes.error) {
    console.error('fetchMachineAdminStructure lessons error', lessonsRes.error)
    throw new Error(`fetchMachineAdminStructure failed: ${lessonsRes.error.message}`)
  }

  const byPart = new Map<string, MachineLessonSummary[]>()
  const unassigned: MachineLessonSummary[] = []
  for (const row of lessonsRes.data ?? []) {
    const r = row as Record<string, unknown>
    const lesson: MachineLessonSummary = {
      id: r.id as string,
      sequenceNum: r.sequence_num as number,
      title: (r.title as string | null) ?? null,
      partId: (r.part_id as string | null) ?? null,
      partSortIndex: (r.part_sort_index as number | null) ?? null,
      isPublished: r.is_published as boolean,
    }
    if (lesson.partId) {
      const arr = byPart.get(lesson.partId) ?? []
      arr.push(lesson)
      byPart.set(lesson.partId, arr)
    } else {
      unassigned.push(lesson)
    }
  }

  const parts: MachinePartWithLessons[] = (partsRes.data ?? []).map((p) => {
    const r = p as Record<string, unknown>
    return {
      id: r.id as string,
      sortIndex: r.sort_index as number,
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      isPublished: r.is_published as boolean,
      lessons: byPart.get(r.id as string) ?? [],
    }
  })

  return { parts, unassigned }
}
