import type { CourseTheme } from './courses'

/**
 * Preset course palettes for the Create / edit-course admin form. Each
 * preset defines all eight --ct-* tokens (hand-tuned for contrast), so an
 * admin picks a look from a swatch instead of choosing eight colours — and
 * a new course is guaranteed to read well. The first four mirror the
 * built-in courses; the rest are additional brand-safe options.
 */
export type ThemePreset = { id: string; label: string; theme: CourseTheme }

export const COURSE_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    theme: {
      from: '#5b4fff', to: '#7c3aed', text: '#5b4fff',
      tint: 'rgba(91, 79, 255, .1)', tintBadge: 'rgba(91, 79, 255, .12)',
      hoverBg: 'rgba(91, 79, 255, .07)', doneText: '#fff', borderH: '#c4b8ff',
    },
  },
  {
    id: 'crimson',
    label: 'Crimson',
    theme: {
      from: '#FF6E6E', to: '#e03535', text: '#c93030',
      tint: 'rgba(255, 110, 110, .12)', tintBadge: 'rgba(255, 110, 110, .14)',
      hoverBg: 'rgba(255, 110, 110, .08)', doneText: '#fff', borderH: '#ffb8b8',
    },
  },
  {
    id: 'green',
    label: 'Green',
    theme: {
      from: '#68F268', to: '#22a322', text: '#1a8a1a',
      tint: 'rgba(104, 242, 104, .14)', tintBadge: 'rgba(104, 242, 104, .18)',
      hoverBg: 'rgba(104, 242, 104, .09)', doneText: '#fff', borderH: '#b6f5b6',
    },
  },
  {
    id: 'gold',
    label: 'Gold',
    theme: {
      from: '#FFEE6E', to: '#d4b800', text: '#8a7200',
      tint: 'rgba(255, 238, 110, .18)', tintBadge: 'rgba(255, 238, 110, .22)',
      hoverBg: 'rgba(255, 238, 110, .12)', doneText: '#111', borderH: '#fff3a0',
    },
  },
  {
    id: 'teal',
    label: 'Teal',
    theme: {
      from: '#2dd4bf', to: '#0d9488', text: '#0d9488',
      tint: 'rgba(45, 212, 191, .12)', tintBadge: 'rgba(45, 212, 191, .16)',
      hoverBg: 'rgba(45, 212, 191, .08)', doneText: '#fff', borderH: '#99f6e4',
    },
  },
  {
    id: 'blue',
    label: 'Blue',
    theme: {
      from: '#38bdf8', to: '#2563eb', text: '#2563eb',
      tint: 'rgba(56, 189, 248, .12)', tintBadge: 'rgba(56, 189, 248, .16)',
      hoverBg: 'rgba(56, 189, 248, .08)', doneText: '#fff', borderH: '#bae6fd',
    },
  },
  {
    id: 'pink',
    label: 'Pink',
    theme: {
      from: '#f472b6', to: '#db2777', text: '#db2777',
      tint: 'rgba(244, 114, 182, .12)', tintBadge: 'rgba(244, 114, 182, .16)',
      hoverBg: 'rgba(244, 114, 182, .08)', doneText: '#fff', borderH: '#fbcfe8',
    },
  },
  {
    id: 'orange',
    label: 'Orange',
    theme: {
      from: '#fb923c', to: '#ea580c', text: '#c2410c',
      tint: 'rgba(251, 146, 60, .12)', tintBadge: 'rgba(251, 146, 60, .16)',
      hoverBg: 'rgba(251, 146, 60, .08)', doneText: '#fff', borderH: '#fed7aa',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    theme: {
      from: '#94a3b8', to: '#475569', text: '#475569',
      tint: 'rgba(148, 163, 184, .14)', tintBadge: 'rgba(148, 163, 184, .18)',
      hoverBg: 'rgba(148, 163, 184, .09)', doneText: '#fff', borderH: '#cbd5e1',
    },
  },
]

/** Resolve a preset by id, falling back to the first (indigo). */
export function presetById(id: string): ThemePreset {
  return COURSE_THEME_PRESETS.find((p) => p.id === id) ?? COURSE_THEME_PRESETS[0]
}

/**
 * Best-effort match of a stored theme back to a preset id (by from+to), so
 * the edit form can pre-select the right swatch. Defaults to the first.
 */
export function presetIdForTheme(theme: CourseTheme | null | undefined): string {
  if (!theme) return COURSE_THEME_PRESETS[0].id
  const hit = COURSE_THEME_PRESETS.find(
    (p) =>
      p.theme.from.toLowerCase() === theme.from?.toLowerCase() &&
      p.theme.to.toLowerCase() === theme.to?.toLowerCase()
  )
  return (hit ?? COURSE_THEME_PRESETS[0]).id
}
