import { shuffle, type Rng } from './random'

/** Lowercase and strip accents, for comparing single letters (n matches ñ). */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const isLetter = (ch: string) => /\p{L}/u.test(ch)
const lower = (s: string) => s.toLowerCase()

export interface Slot {
  /** Index into Array.from(answer.trim()). */
  raw: number
  /** Index among the non-whitespace characters. */
  slot: number
}

/** The answer's characters grouped by word, so the UI can wrap lines between words. */
export function answerWords(answer: string): Slot[][] {
  const words: Slot[][] = []
  let current: Slot[] | null = null
  let slot = 0
  Array.from(answer.trim()).forEach((ch, raw) => {
    if (/\s/u.test(ch)) {
      current = null
      return
    }
    if (!current) {
      current = []
      words.push(current)
    }
    current.push({ raw, slot: slot++ })
  })
  return words
}

// ---------- Word Scramble ----------

export const MAX_SCRAMBLE_LETTERS = 24

/** The answer's characters without whitespace; these become the tiles. */
export const scrambleChars = (answer: string) => Array.from(answer.trim()).filter((ch) => !/\s/u.test(ch))

export function canScramble(answer: string): boolean {
  const chars = scrambleChars(answer)
  return chars.length >= 2 && chars.length <= MAX_SCRAMBLE_LETTERS && new Set(chars.map(lower)).size > 1
}

/** Shuffled tiles, never in the answer's own order when another order exists. */
export function scrambleTiles(answer: string, rng: Rng = Math.random): string[] {
  const chars = scrambleChars(answer)
  const target = chars.join('').toLowerCase()
  let tiles = shuffle(chars, rng)
  for (let i = 0; i < 20 && tiles.join('').toLowerCase() === target; i++) tiles = shuffle(chars, rng)
  if (tiles.join('').toLowerCase() === target && chars.length > 1) tiles = [...chars.slice(1), chars[0]]
  return tiles
}

/** Index of an unused tile for a typed key: exact letter first, then ignoring case and accents. */
export function findTile(tiles: string[], used: number[], key: string): number {
  const free = (i: number) => !used.includes(i)
  const exact = tiles.findIndex((t, i) => free(i) && lower(t) === lower(key))
  return exact >= 0 ? exact : tiles.findIndex((t, i) => free(i) && fold(t) === fold(key))
}

/** Keeps the correct prefix of `placed` and adds the next correct tile. */
export function hintStep(tiles: string[], placed: number[], target: string[]): number[] {
  let ok = 0
  while (ok < placed.length && ok < target.length && lower(tiles[placed[ok]]) === lower(target[ok])) ok++
  const kept = placed.slice(0, ok)
  if (ok >= target.length) return kept
  const next = tiles.findIndex((t, i) => !kept.includes(i) && lower(t) === lower(target[ok]))
  return next < 0 ? kept : [...kept, next]
}

export const isUnscrambled = (tiles: string[], placed: number[], target: string[]) =>
  placed.length === target.length && placed.every((p, i) => lower(tiles[p]) === lower(target[i]))

// ---------- Hangman ----------

export const HANGMAN_LIVES = 6
export const MAX_HANGMAN_CHARS = 40

/** Distinct letters of the answer, folded. Digits and punctuation are never guessed. */
export const lettersOf = (answer: string) => new Set(Array.from(answer).filter(isLetter).map(fold))

export const canHangman = (answer: string) =>
  lettersOf(answer).size > 0 && Array.from(answer.trim()).length <= MAX_HANGMAN_CHARS

export function maskAnswer(answer: string, guessed: Set<string>): { ch: string; shown: boolean }[] {
  return Array.from(answer.trim()).map((ch) => ({ ch, shown: !isLetter(ch) || guessed.has(fold(ch)) }))
}

export function wrongCount(answer: string, guessed: Set<string>): number {
  const letters = lettersOf(answer)
  return [...guessed].filter((g) => !letters.has(g)).length
}

export const isSolved = (answer: string, guessed: Set<string>) => [...lettersOf(answer)].every((l) => guessed.has(l))

const AZ = 'abcdefghijklmnopqrstuvwxyz'.split('')

/** a to z, plus any letters in the answer that are outside a to z even after removing accents. */
export function keyboardFor(answer: string): string[] {
  return [...AZ, ...[...lettersOf(answer)].filter((l) => !AZ.includes(l)).sort()]
}

// ---------- Letter Wheel ----------

export const WHEEL_SIZE = 26
export type WheelStatus = 'pending' | 'right' | 'wrong'

/** First letter or digit of the answer, uppercased (Ñ stays Ñ). */
export function initialOf(answer: string): string {
  return (Array.from(answer.trim()).find((c) => /[\p{L}\p{N}]/u.test(c)) ?? '#').toLocaleUpperCase()
}

/** Up to `max` items: one per starting letter first, then the rest; ordered by letter. */
export function pickWheel<T>(items: T[], answerOf: (t: T) => string, max = WHEEL_SIZE): T[] {
  const seen = new Set<string>()
  const first: T[] = []
  const rest: T[] = []
  for (const it of items) {
    const letter = fold(initialOf(answerOf(it)))
    ;(seen.has(letter) ? rest : first).push(it)
    seen.add(letter)
  }
  const key = (t: T) => fold(initialOf(answerOf(t)))
  return [...first, ...rest].slice(0, max).sort((a, b) => key(a).localeCompare(key(b)))
}

/** Next pending index after `from`, wrapping around; -1 when nothing is pending. */
export function nextPending(statuses: WheelStatus[], from: number): number {
  for (let step = 1; step <= statuses.length; step++) {
    const i = (((from + step) % statuses.length) + statuses.length) % statuses.length
    if (statuses[i] === 'pending') return i
  }
  return -1
}

// ---------- Time Attack ----------

export const TIME_ATTACK_MS = 60_000
export const TIME_ATTACK_PENALTY_MS = 2_000
export const TIME_ATTACK_PAIRS = 4

/** `size` items starting at `cursor`, wrapping around the list; no repeats within a batch. */
export function takeCyclic<T>(list: T[], cursor: number, size: number): { batch: T[]; cursor: number } {
  const n = list.length
  const count = Math.min(size, n)
  const batch = Array.from({ length: count }, (_, i) => list[(cursor + i) % n])
  return { batch, cursor: n ? (cursor + count) % n : 0 }
}
