import type { Unlockable } from './celebrate'

// Unlockable accent colours: each opens at a Profile level, so XP has something to spend on.

export interface Accent {
  id: string
  name: string
  /** Profile level that unlocks it. */
  level: number
  /** Swatch shown in the picker (the light-theme accent). */
  swatch: string
}

export const DEFAULT_ACCENT = 'ocean'

export const ACCENTS: Accent[] = [
  { id: 'ocean', name: 'Ocean', level: 1, swatch: '#1f5f99' },
  { id: 'forest', name: 'Forest', level: 3, swatch: '#2e7d4f' },
  { id: 'sunset', name: 'Sunset', level: 5, swatch: '#b04a15' },
  { id: 'grape', name: 'Grape', level: 8, swatch: '#7446c4' },
  { id: 'rose', name: 'Rose', level: 12, swatch: '#b83266' },
  { id: 'gold', name: 'Gold', level: 16, swatch: '#8f6a05' },
]

export const isUnlocked = (a: Accent, level: number) => level >= a.level

/** The accent to show: the saved one if it exists and is unlocked, otherwise the default. */
export function activeAccent(saved: string | undefined, level: number): string {
  const a = ACCENTS.find((x) => x.id === saved)
  return a && isUnlocked(a, level) ? a.id : DEFAULT_ACCENT
}

/** The next accent to unlock above `level`, if any. */
export const nextUnlock = (level: number): Accent | null => ACCENTS.find((a) => a.level > level) ?? null

/** Premium themes: a full dark palette with a slow animated glow, one per rank from Apprentice up. */
export interface Backdrop {
  id: string
  name: string
  level: number
  /** Background and accent colours for the picker's preview. */
  bg: string
  accent: string
}

export const BACKDROPS: Backdrop[] = [
  { id: 'bronze', name: 'Bronze', level: 6, bg: '#120c08', accent: '#d08a4f' },
  { id: 'silver', name: 'Silver', level: 11, bg: '#0e1014', accent: '#c9d1dc' },
  { id: 'gold', name: 'Gold', level: 16, bg: '#0d0b06', accent: '#e3b341' },
  { id: 'king', name: 'Purple King', level: 26, bg: '#12081f', accent: '#a855f7' },
]

/** The saved premium theme if the level has reached it, else none. */
export function activeBackdrop(saved: string | undefined, level: number): string | null {
  const b = BACKDROPS.find((x) => x.id === saved)
  return b && level >= b.level ? b.id : null
}

/** Everything a level unlocks, for the level-up celebration. */
export const UNLOCKABLES: Unlockable[] = [
  ...ACCENTS.filter((a) => a.level > 1).map((a): Unlockable => ({ name: a.name, level: a.level, what: 'accent colour' })),
  ...BACKDROPS.map((b): Unlockable => ({ name: b.name, level: b.level, what: 'theme' })),
]
