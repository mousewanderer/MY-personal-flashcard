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
