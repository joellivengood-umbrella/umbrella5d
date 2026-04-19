/**
 * Curriculum constants — single source of truth for module/lesson counts.
 * Update here to reshape the program.
 */
export const TOTAL_LESSONS = 32

export const MODULE_COUNTS: Record<number, number> = {
  1: 6,
  2: 6,
  3: 6,
  4: 6,
  5: 8,
}

export const MODULES: Array<{
  n: number
  title: string
  blurb: string
  lessons: number
}> = [
  {
    n: 1,
    title: 'The Five Dimensions',
    blurb:
      "The irrefutable laws of the business universe and why all five dimensions of your customer's benefit are equally essential.",
    lessons: 6,
  },
  {
    n: 2,
    title: 'The Customer Paradigm',
    blurb:
      'How and why the customer paradigm has migrated — and what complete and total benefit really means for your business.',
    lessons: 6,
  },
  {
    n: 3,
    title: 'The Umbrella Machine',
    blurb:
      'Introduction to the 32-step cloud-based tool and how to navigate each instruction set for maximum impact.',
    lessons: 6,
  },
  {
    n: 4,
    title: 'Implementation in Practice',
    blurb:
      'Working through the machine: prerequisites, objectives, and executing each step with precision and confidence.',
    lessons: 6,
  },
  {
    n: 5,
    title: 'Revenue, Profits & Glory',
    blurb:
      'The capstone seminar — integrating all five dimensions and measuring the full transformation of your business.',
    lessons: 8,
  },
]

export function moduleLessonIds(moduleNum: number): string[] {
  const count = MODULE_COUNTS[moduleNum] ?? 0
  return Array.from({ length: count }, (_, i) => `${moduleNum}-${i + 1}`)
}

export function isModuleComplete(
  moduleNum: number,
  completed: Record<string, boolean>
): boolean {
  return moduleLessonIds(moduleNum).every((id) => !!completed[id])
}
