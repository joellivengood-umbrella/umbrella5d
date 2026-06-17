import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course, CourseTheme } from './courses'

/**
 * Server-side reads of public.courses — the dynamic course library that
 * replaces the hardcoded registry. Degrades to []/null on error so a
 * transient read never 500s a page (the catalog simply renders empty).
 */

type MaybeClient = SupabaseClient

const COURSE_COLUMNS =
  'slug, title, short_title, blurb, media_kind, template, has_drip_release, sort_order, theme, is_published, in_program, is_assignable'

const PURPLE = '#7c3aed'

/** Fill any missing theme token so a half-themed row still renders sanely. */
function toTheme(raw: unknown): CourseTheme {
  const t = (raw ?? {}) as Partial<CourseTheme>
  const from = t.from ?? PURPLE
  return {
    from,
    to: t.to ?? '#5b4fff',
    text: t.text ?? from,
    tint: t.tint ?? 'rgba(124, 58, 237, .1)',
    tintBadge: t.tintBadge ?? 'rgba(124, 58, 237, .14)',
    hoverBg: t.hoverBg ?? 'rgba(124, 58, 237, .07)',
    doneText: t.doneText ?? '#fff',
    borderH: t.borderH ?? from,
  }
}

type CourseRow = {
  slug: string
  title: string
  short_title: string
  blurb: string | null
  media_kind: string
  template: string
  has_drip_release: boolean
  sort_order: number
  theme: unknown
  is_published: boolean
  in_program: boolean
  is_assignable: boolean
}

function rowToCourse(row: CourseRow): Course {
  return {
    slug: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    blurb: row.blurb ?? '',
    mediaKind: row.media_kind === 'audio' ? 'audio' : 'video',
    template:
      row.template === 'versioned' || row.template === 'rich'
        ? row.template
        : 'flat',
    hasDripRelease: row.has_drip_release,
    sortOrder: row.sort_order,
    theme: toTheme(row.theme),
    isPublished: row.is_published,
    inProgram: row.in_program,
    isAssignable: row.is_assignable,
  }
}

/**
 * All courses the caller can read (published for everyone; drafts too for
 * platform admins, per RLS), ordered by sort_order.
 */
export async function fetchCourses(supabase: MaybeClient): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('fetchCourses error', error)
    return []
  }
  return (data ?? []).map((r) => rowToCourse(r as CourseRow))
}

/** Courses that count toward the headline program progress %. */
export async function fetchProgramCourses(
  supabase: MaybeClient
): Promise<Course[]> {
  return (await fetchCourses(supabase)).filter((c) => c.inProgram)
}

/** A single course by slug, or null if it doesn't exist / isn't readable. */
export async function fetchCourse(
  supabase: MaybeClient,
  slug: string
): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('slug', slug)
    .limit(1)

  if (error) {
    console.error('fetchCourse error', error)
    return null
  }
  const rows = data ?? []
  return rows.length > 0 ? rowToCourse(rows[0] as CourseRow) : null
}

/** slug → Course, for resolving a slug to its display metadata. */
export async function fetchCourseMap(
  supabase: MaybeClient
): Promise<Map<string, Course>> {
  const courses = await fetchCourses(supabase)
  return new Map(courses.map((c) => [c.slug, c]))
}

/**
 * Just the slugs of in-program courses — for the `.in('type', …)` filters
 * that compute program progress (replaces the hardcoded `.neq('type','potd')`).
 */
export async function fetchProgramSlugs(
  supabase: MaybeClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('slug')
    .eq('in_program', true)

  if (error) {
    console.error('fetchProgramSlugs error', error)
    return []
  }
  return (data ?? []).map((r) => (r as { slug: string }).slug)
}
