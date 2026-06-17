/**
 * Courses — static definitions for the 4 top-level content tracks.
 *
 * Each course corresponds to a value of `content_items.type`. The actual
 * items (segments, episodes, lessons) live in the database; this file
 * only holds the presentation-layer metadata: slug, display name, blurb,
 * accent color, and any shape-specific helpers.
 *
 * Adding a new course = one entry here + DB rows. No schema changes.
 */

import type { CSSProperties } from 'react'

export type CourseSlug = 'bss' | 'eos' | 'potd' | 'machine'

export type ContentType = CourseSlug // 1:1 for now

export type BssVersion = '5hr' | '3hr' | '2hr' | '1hr'

export const BSS_VERSIONS: ReadonlyArray<{
  slug: BssVersion
  label: string
  hours: number
}> = [
  { slug: '5hr', label: '5 Hour — Full Version', hours: 5 },
  { slug: '3hr', label: '3 Hour Version', hours: 3 },
  { slug: '2hr', label: '2 Hour Version', hours: 2 },
  { slug: '1hr', label: '1 Hour Version', hours: 1 },
]

export type CourseMeta = {
  slug: CourseSlug
  title: string
  shortTitle: string
  blurb: string
  mediaKind: 'video' | 'audio'
  hasDripRelease: boolean
}

// ── DB-backed course library (public.courses) ─────────────────────
//
// `CourseMeta`/`COURSES` above are the legacy STATIC registry, still used
// by the four built-in courses' bespoke routes + the admin pages. The
// types below model a row of public.courses — the dynamic source of truth
// the catalog, progress, and (later) Create Course read from. Fetchers live
// in src/lib/course-queries.ts (server-only); these types are client-safe.

/** The 8 `--ct-*` theme tokens stored on a course row (see globals.css). */
export type CourseTheme = {
  from: string
  to: string
  text: string
  tint: string
  tintBadge: string
  hoverBg: string
  doneText: string
  borderH: string
}

/** A course as read from public.courses. Slug is free text (any course). */
export type Course = {
  slug: string
  title: string
  shortTitle: string
  blurb: string
  mediaKind: 'video' | 'audio'
  template: 'flat' | 'versioned' | 'rich'
  hasDripRelease: boolean
  sortOrder: number
  theme: CourseTheme
  isPublished: boolean
  inProgram: boolean
  isAssignable: boolean
}

/**
 * Turn a course's theme tokens into the inline CSS custom properties every
 * `var(--ct-*)` rule reads — applied on the themed root element so a course
 * is fully coloured from data, with no per-slug `.course-theme-{slug}` block.
 */
export function courseThemeVars(theme: CourseTheme): CSSProperties {
  // CSS custom properties aren't part of this React version's CSSProperties
  // type, so build a plain map and widen it. Each var is read via var(--ct-*).
  const vars: Record<string, string> = {
    '--ct-from': theme.from,
    '--ct-to': theme.to,
    '--ct-text': theme.text,
    '--ct-tint': theme.tint,
    '--ct-tint-badge': theme.tintBadge,
    '--ct-hover-bg': theme.hoverBg,
    '--ct-done-text': theme.doneText,
    '--ct-border-h': theme.borderH,
  }
  return vars as unknown as CSSProperties
}

export const COURSES: ReadonlyArray<CourseMeta> = [
  {
    slug: 'bss',
    title: 'Business Success Seminar',
    shortTitle: 'BSS',
    blurb:
      'The hero seminar for every member of an organization. Available in four lengths so leaders can assign the right depth to the right team.',
    mediaKind: 'video',
    hasDripRelease: false,
  },
  {
    slug: 'eos',
    title: 'Employee Opportunity Seminars',
    shortTitle: 'EOS',
    blurb:
      'Nine five-minute video seminars designed to open doors for every employee in the organization.',
    mediaKind: 'video',
    hasDripRelease: false,
  },
  {
    slug: 'potd',
    title: 'Pod of the Day',
    shortTitle: 'POTD',
    blurb:
      'A new short podcast every morning, two to four minutes each. Business stories pulled from a century of wins, disasters, bad names, dumb mergers, and the occasional genius moment. Some episodes hammer a specific principle. Others just tell a great story and let you draw the lesson yourself. The format is built for a habit: listen on the drive in, pick up something useful, come back tomorrow.',
    mediaKind: 'audio',
    hasDripRelease: true,
  },
  {
    slug: 'machine',
    title: 'The 5D Machine',
    shortTitle: '5D Machine',
    blurb:
      'Thirty video lessons that walk you through the Umbrella framework one floor at a time. You cut your business down to its strongest core, expand outward with services and alliances, strip the friction out of every customer touchpoint, build real emotional loyalty with the people you serve, and set up a running source of new ideas. Every lesson ends with direct work to do on your own company, so by the end you have actually changed something, not just watched a course.',
    mediaKind: 'video',
    hasDripRelease: false,
  },
]

export function getCourseMeta(slug: CourseSlug): CourseMeta {
  const c = COURSES.find((x) => x.slug === slug)
  if (!c) throw new Error(`Unknown course slug: ${slug}`)
  return c
}

/**
 * The three core courses that make up "The Umbrella Program."
 * Used for the dashboard grid, the /courses index, and overall
 * progress math (POTD is excluded — it's a separate bonus track).
 *
 * Order matches the COURSES declaration above so display ordering
 * stays predictable.
 */
export const UMBRELLA_PROGRAM_COURSES: ReadonlyArray<CourseMeta> =
  COURSES.filter((c) => c.slug !== 'potd')

/**
 * POTD as a standalone metadata reference, separated from the main
 * program. Anywhere that previously iterated COURSES and treated
 * POTD identically to BSS/EOS/Machine should reach for one of:
 *   - UMBRELLA_PROGRAM_COURSES (for "the program")
 *   - POTD_META (for the bonus track)
 *   - COURSES (only when literally any course slug is valid)
 */
export const POTD_META: CourseMeta = (() => {
  const m = COURSES.find((c) => c.slug === 'potd')
  if (!m) throw new Error('POTD meta missing from COURSES')
  return m
})()

export function isValidCourseSlug(value: string): value is CourseSlug {
  return COURSES.some((c) => c.slug === (value as CourseSlug))
}

export function isValidBssVersion(value: string): value is BssVersion {
  return BSS_VERSIONS.some((v) => v.slug === (value as BssVersion))
}

/**
 * Shape of a content_items row as we read it from Supabase.
 * Columns we don't use are omitted.
 */
export type ContentItem = {
  id: string
  type: ContentType
  sequence_num: number
  title: string | null
  description: string | null
  media_url: string | null
  duration_mins: number | null
  parent_id: string | null
  metadata: Record<string, unknown> | null
  is_published: boolean
}

// ── 5D Machine: interactive course structure ──────────────────────
//
// The 5D Machine is richer than the other courses. Its lessons are
// still content_items (type === 'machine'), but they are grouped into
// Parts and their body is an ordered list of blocks (headings, rich
// text, audio/video, and activity questions) rather than a single
// description + media. See supabase/migrations/20260608_machine_*.sql.

/** A "Part" groups machine lessons (Part One, Part Two, …). */
export type MachinePart = {
  id: string
  sortIndex: number // 1-based; renders as "Part One", "Part Two", …
  title: string
  subtitle: string | null
  isPublished: boolean
}

/**
 * The three fixed sections of a machine lesson, in display order.
 * prerequisites + objectives are read-and-watch; instructions holds the
 * interactive question/answer items.
 */
export type LessonSection = 'prerequisites' | 'objectives' | 'instructions'

export const LESSON_SECTIONS: ReadonlyArray<LessonSection> = [
  'prerequisites',
  'objectives',
  'instructions',
]

/** Canonical section titles; lessons may override via section_titles. */
export const DEFAULT_SECTION_TITLES: Record<LessonSection, string> = {
  prerequisites: 'Essential Prerequisites',
  objectives: 'Objectives',
  instructions: 'Instructions',
}

/** Per-lesson title overrides stored in content_items.section_titles. */
export type SectionTitles = Partial<Record<LessonSection, string>>

/**
 * Tolerates rows written before 20260610_machine_three_sections ran:
 * legacy 'content' reads as prerequisites and 'activity' as
 * instructions, so the app works either side of the migration.
 */
export function normalizeLessonSection(raw: string): LessonSection {
  if (raw === 'activity' || raw === 'instructions') return 'instructions'
  if (raw === 'objectives') return 'objectives'
  return 'prerequisites' // 'prerequisites' or legacy 'content'
}

export type LessonBlockType =
  | 'heading'
  | 'rich_text'
  | 'audio'
  | 'video'
  | 'image'
  | 'question'

/**
 * Type-specific payload stored in lesson_blocks.data (jsonb). Only the
 * fields relevant to a given block_type are populated.
 */
export type LessonBlockData = {
  text?: string // heading: the section title
  html?: string // rich_text: sanitized HTML
  url?: string // audio | video | image: Supabase Storage URL
  title?: string // audio | video: caption / label; image: caption / alt text
  prompts?: string[] // question: one answer box per prompt
}

/**
 * One ordered block in a lesson body. `isCheckpoint` marks the blocks
 * the learner manually ticks off (numbered step headings in the read
 * sections, and question items in instructions); a lesson is complete
 * when all of its checkpoints are checked.
 */
export type LessonBlock = {
  id: string
  lessonId: string
  section: LessonSection
  sortIndex: number
  blockType: LessonBlockType
  data: LessonBlockData
  isCheckpoint: boolean
}

/** A machine lesson (content_items row) with its Part link and blocks. */
export type MachineLesson = {
  id: string
  partId: string | null
  partSortIndex: number | null // the "L" in the Part.Lesson address (e.g. the 2 in 1.2)
  sequenceNum: number // global machine order / route key
  title: string | null
  isPublished: boolean
  blocks: LessonBlock[]
}

/**
 * A learner's free-text answer to one prompt of an activity question.
 * Client-facing shape only; the row's id, user_id, and timestamps are
 * internal and intentionally omitted here.
 */
export type ActivityAnswer = {
  blockId: string
  promptIndex: number
  answerText: string
}

/** A learner's manual checkmark on a checkpoint block. */
export type BlockCheck = {
  blockId: string
  checkedAt: string
}
