import { checkAnswer, type CheckOptions } from './answer'
import type { Rng } from './random'

// Meteor: terms fall down the field; typing the answer destroys the matching meteor.
// Positions are fractions of the field (x: centre, 0..1; y: bottom edge, 0 = top, 1 = ground),
// so the game plays the same on any screen size.

export const METEOR_LIVES = 3
export const HITS_PER_LEVEL = 8
/** Longest step in seconds, so a slow frame never jumps meteors past the ground. */
export const MAX_STEP = 0.1

export interface Meteor<T> {
  id: number
  item: T
  answer: string
  x: number
  y: number
  /** Field heights per second. */
  speed: number
}

export const levelFor = (hits: number) => 1 + Math.floor(hits / HITS_PER_LEVEL)

/** Seconds to fall the whole field: 12 at level 1, 10% faster each level, never under 4. */
export const fallSeconds = (level: number) => Math.max(4, 12 * 0.9 ** (level - 1))

/** Meteors on screen at once: 1 at level 1, one more every second level, at most 4. */
export const maxMeteors = (level: number) => Math.min(4, 1 + Math.floor(level / 2))

/** Seconds between two meteors while others are still falling. */
export const spawnGap = (level: number) => Math.max(1.2, 3.5 * 0.9 ** (level - 1))

export const pointsFor = (level: number) => 10 * level

export function shouldSpawn(onScreen: number, sinceSpawn: number, level: number, cards: number): boolean {
  if (onScreen >= Math.min(maxMeteors(level), cards)) return false
  return onScreen === 0 || sinceSpawn >= spawnGap(level)
}

/** Moves every meteor down by `dt` seconds and splits off the ones that reached the ground. */
export function step<T>(meteors: Meteor<T>[], dt: number): { flying: Meteor<T>[]; landed: Meteor<T>[] } {
  const d = Math.min(Math.max(dt, 0), MAX_STEP)
  const moved = meteors.map((m) => ({ ...m, y: m.y + m.speed * d }))
  return { flying: moved.filter((m) => m.y < 1), landed: moved.filter((m) => m.y >= 1) }
}

/** A horizontal spot away from meteors still near the top, out of a few random tries. */
export function spawnX(meteors: Meteor<unknown>[], rng: Rng, tries = 8): number {
  const near = meteors.filter((m) => m.y < 0.35).map((m) => m.x)
  let best = 0.5
  let bestGap = -1
  for (let i = 0; i < tries; i++) {
    const x = 0.2 + rng() * 0.6
    const gap = near.length ? Math.min(...near.map((n) => Math.abs(n - x))) : 1
    if (gap > bestGap) {
      best = x
      bestGap = gap
    }
  }
  return best
}

/** Index of the next item to drop, starting at `cursor` and skipping items already falling. */
export function pickNext<T extends { key: string }>(items: T[], cursor: number, falling: Set<string>): number {
  for (let i = 0; i < items.length; i++) {
    const idx = (cursor + i) % items.length
    if (!falling.has(items[idx].key)) return idx
  }
  return cursor % items.length
}

/** The meteor a typed answer destroys: the lowest one it matches ("almost" counts), if any. */
export function matchMeteor<T>(meteors: Meteor<T>[], input: string, opts: CheckOptions): Meteor<T> | undefined {
  return meteors
    .filter((m) => checkAnswer(input, m.answer, opts) !== 'wrong')
    .sort((a, b) => b.y - a.y)[0]
}
