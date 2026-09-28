import { fold } from './games'
import { shuffle, type Rng } from './random'

// Shared by Word Search and Crossword: answers become grid words of plain capital letters.

/** Uppercase letters only, accents removed ("por favor" -> "PORFAVOR"); null when the answer has digits. */
export function gridWord(answer: string): string | null {
  if (/\d/.test(answer)) return null
  const letters = fold(answer).replace(/[^\p{L}]/gu, '').toUpperCase()
  return letters || null
}

export type Cell = [row: number, col: number]

// ---------- Word Search ----------

/** Right, down, down-right, up-right: words always read forwards. */
export const SEARCH_DIRS: Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
]

export interface Placement {
  key: string
  word: string
  row: number
  col: number
  dir: Cell
}

export interface WordSearch {
  size: number
  grid: string[][]
  placed: Placement[]
  /** Keys that did not fit; they go into a later puzzle. */
  skipped: string[]
}

export const placementCells = (p: Placement): Cell[] =>
  Array.from({ length: p.word.length }, (_, i): Cell => [p.row + p.dir[0] * i, p.col + p.dir[1] * i])

export function buildWordSearch(
  words: { key: string; word: string }[],
  size: number,
  rng: Rng,
  maxWords = 8,
): WordSearch {
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''))
  const placed: Placement[] = []
  const skipped: string[] = []
  const order = [...words].sort((a, b) => b.word.length - a.word.length)
  for (const w of order) {
    if (placed.length >= maxWords || w.word.length > size) {
      skipped.push(w.key)
      continue
    }
    let spot: Placement | null = null
    for (let t = 0; t < 200 && !spot; t++) {
      const dir = SEARCH_DIRS[Math.floor(rng() * SEARCH_DIRS.length)]
      const p: Placement = { ...w, row: Math.floor(rng() * size), col: Math.floor(rng() * size), dir }
      const fits = placementCells(p).every(
        ([r, c], i) => r >= 0 && c >= 0 && r < size && c < size && (grid[r][c] === '' || grid[r][c] === w.word[i]),
      )
      if (fits) spot = p
    }
    if (!spot) {
      skipped.push(w.key)
      continue
    }
    placementCells(spot).forEach(([r, c], i) => (grid[r][c] = w.word[i]))
    placed.push(spot)
  }
  // Fill the gaps with letters from the placed words, so the filler looks like the answers.
  const pool = placed.map((p) => p.word).join('') || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = pool[Math.floor(rng() * pool.length)]
  return { size, grid, placed, skipped }
}

/** The cells from a to b when they lie on one straight or diagonal line (either direction), else null. */
export function lineCells(a: Cell, b: Cell): Cell[] | null {
  const dr = b[0] - a[0]
  const dc = b[1] - a[1]
  if (dr === 0 && dc === 0) return null
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null
  const n = Math.max(Math.abs(dr), Math.abs(dc))
  return Array.from({ length: n + 1 }, (_, i): Cell => [a[0] + (Math.sign(dr) * i), a[1] + (Math.sign(dc) * i)])
}

const sameCells = (x: Cell[], y: Cell[]) => x.length === y.length && x.every((c, i) => c[0] === y[i][0] && c[1] === y[i][1])

/** The placed word covering exactly these cells, marked from either end. */
export function findPlacement(placed: Placement[], cells: Cell[]): Placement | undefined {
  const back = [...cells].reverse()
  return placed.find((p) => sameCells(placementCells(p), cells) || sameCells(placementCells(p), back))
}

// ---------- Crossword ----------

export interface CrossWord {
  key: string
  word: string
  row: number
  col: number
  across: boolean
  number: number
}

export interface Crossword {
  rows: number
  cols: number
  words: CrossWord[]
  /** Letter per cell, or null for a black square. */
  cells: (string | null)[][]
  /** Keys that could not be joined in; they go into a later puzzle. */
  leftover: string[]
}

export const wordCells = (w: Pick<CrossWord, 'row' | 'col' | 'across' | 'word'>): Cell[] =>
  Array.from({ length: w.word.length }, (_, i): Cell => (w.across ? [w.row, w.col + i] : [w.row + i, w.col]))

const MAX_SIDE = 14

/**
 * Greedy layout: the longest word first, then each word crossing letters already placed,
 * with no clashing letters and no words touching side by side. Best candidate: most crossings,
 * then the smallest grid.
 */
export function buildCrossword(words: { key: string; word: string }[], rng: Rng, maxWords = 10): Crossword {
  const order = shuffle(words, rng).sort((a, b) => b.word.length - a.word.length)
  const letters = new Map<string, string>()
  const dirs = new Map<string, Set<'a' | 'd'>>()
  const id = (r: number, c: number) => `${r},${c}`
  const placed: Omit<CrossWord, 'number'>[] = []
  const leftover: string[] = []

  const bounds = (extra: Cell[] = []) => {
    const all = [...[...letters.keys()].map((k) => k.split(',').map(Number) as Cell), ...extra]
    const rs = all.map((c) => c[0])
    const cs = all.map((c) => c[1])
    return { top: Math.min(...rs), left: Math.min(...cs), h: Math.max(...rs) - Math.min(...rs) + 1, w: Math.max(...cs) - Math.min(...cs) + 1 }
  }

  const put = (w: Omit<CrossWord, 'number'>) => {
    wordCells(w).forEach(([r, c], i) => {
      letters.set(id(r, c), w.word[i])
      const d = dirs.get(id(r, c)) ?? new Set()
      d.add(w.across ? 'a' : 'd')
      dirs.set(id(r, c), d)
    })
    placed.push(w)
  }

  /** Crossings for a candidate, or -1 when it breaks a rule. */
  const check = (w: Omit<CrossWord, 'number'>): number => {
    const cells = wordCells(w)
    const [br, bc] = w.across ? [w.row, w.col - 1] : [w.row - 1, w.col]
    const [ar, ac] = w.across ? [w.row, w.col + w.word.length] : [w.row + w.word.length, w.col]
    if (letters.has(id(br, bc)) || letters.has(id(ar, ac))) return -1
    let crossings = 0
    for (let i = 0; i < cells.length; i++) {
      const [r, c] = cells[i]
      const here = letters.get(id(r, c))
      if (here !== undefined) {
        if (here !== w.word[i] || dirs.get(id(r, c))?.has(w.across ? 'a' : 'd')) return -1
        crossings++
        continue
      }
      const side: Cell[] = w.across ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]]
      if (side.some(([sr, sc]) => letters.has(id(sr, sc)))) return -1
    }
    const b = bounds(cells)
    if (b.h > MAX_SIDE || b.w > MAX_SIDE) return -1
    return crossings
  }

  for (const w of order) {
    if (placed.length >= maxWords || w.word.length > MAX_SIDE) {
      leftover.push(w.key)
      continue
    }
    if (!placed.length) {
      put({ ...w, row: 0, col: 0, across: true })
      continue
    }
    let best: { cand: Omit<CrossWord, 'number'>; score: number } | null = null
    for (const [cellId, letter] of letters) {
      const [r, c] = cellId.split(',').map(Number)
      for (let i = 0; i < w.word.length; i++) {
        if (w.word[i] !== letter) continue
        for (const across of [true, false]) {
          const cand = { ...w, across, row: across ? r : r - i, col: across ? c - i : c }
          const crossings = check(cand)
          if (crossings < 1) continue
          const b = bounds(wordCells(cand))
          const score = crossings * 1000 - b.h * b.w + rng()
          if (!best || score > best.score) best = { cand, score }
        }
      }
    }
    if (best) put(best.cand)
    else leftover.push(w.key)
  }

  const b = bounds()
  const shifted = placed.map((w) => ({ ...w, row: w.row - b.top, col: w.col - b.left }))
  const cells: (string | null)[][] = Array.from({ length: b.h }, () => Array<string | null>(b.w).fill(null))
  for (const w of shifted) wordCells(w).forEach(([r, c], i) => (cells[r][c] = w.word[i]))

  // Number the starts in reading order; a cell can start one across and one down word.
  const starts = new Map<string, number>()
  let n = 0
  for (let r = 0; r < b.h; r++) {
    for (let c = 0; c < b.w; c++) {
      if (shifted.some((w) => w.row === r && w.col === c)) starts.set(id(r, c), ++n)
    }
  }
  const numbered = shifted.map((w) => ({ ...w, number: starts.get(id(w.row, w.col))! }))
  numbered.sort((x, y) => x.number - y.number || Number(y.across) - Number(x.across))
  return { rows: b.h, cols: b.w, words: numbered, cells, leftover }
}
