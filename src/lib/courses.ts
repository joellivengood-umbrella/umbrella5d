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
