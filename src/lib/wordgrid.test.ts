import { describe, expect, it } from 'vitest'
import { seededRng } from './daily'
import {
  buildCrossword,
  buildWordSearch,
  findPlacement,
  gridWord,
  lineCells,
  placementCells,
  wordCells,
  type CrossWord,
} from './wordgrid'

const WORDS = ['GATO', 'PERRO', 'CASA', 'PAJARO', 'MARIPOSA', 'ARBOL', 'LECHE', 'AGUA', 'SOL', 'LUNA'].map((word, i) => ({
  key: `k${i}`,
  word,
}))

describe('gridWord', () => {
  it('keeps capital letters only and drops accents', () => {
    expect(gridWord('por favor')).toBe('PORFAVOR')
    expect(gridWord("l'été")).toBe('LETE')
    expect(gridWord('niño-a')).toBe('NINOA')
  })
  it('rejects answers with digits or no letters', () => {
    expect(gridWord('route 66')).toBeNull()
    expect(gridWord('?!')).toBeNull()
  })
})

describe('word search', () => {
  it('places words that read forwards in their cells and fills every cell', () => {
    for (const seed of ['a', 'b', 'c']) {
      const ws = buildWordSearch(WORDS, 10, seededRng(seed))
      expect(ws.placed.length + ws.skipped.length).toBe(WORDS.length)
      expect(ws.placed.length).toBeLessThanOrEqual(8)
      for (const p of ws.placed) expect(placementCells(p).map(([r, c]) => ws.grid[r][c]).join('')).toBe(p.word)
      expect(ws.grid.flat().every((ch) => /^[A-Z]$/.test(ch))).toBe(true)
    }
  })
  it('skips words longer than the grid', () => {
    expect(buildWordSearch([{ key: 'x', word: 'ABCDEFGHIJK' }], 10, seededRng('x')).skipped).toEqual(['x'])
  })
  it('finds lines and the word they cover, marked from either end', () => {
    expect(lineCells([0, 0], [0, 3])).toHaveLength(4)
    expect(lineCells([3, 3], [0, 0])).toEqual([[3, 3], [2, 2], [1, 1], [0, 0]])
    expect(lineCells([0, 0], [1, 2])).toBeNull()
    const ws = buildWordSearch(WORDS.slice(0, 3), 10, seededRng('find'))
    const p = ws.placed[0]
    const cells = placementCells(p)
    expect(findPlacement(ws.placed, cells)).toBe(p)
    expect(findPlacement(ws.placed, [...cells].reverse())).toBe(p)
    expect(findPlacement(ws.placed, cells.slice(1))).toBeUndefined()
  })
})

describe('crossword', () => {
  const letterAt = (cw: ReturnType<typeof buildCrossword>, w: CrossWord) => wordCells(w).map(([r, c]) => cw.cells[r][c]).join('')

  it('lays words out with no clashes, each joined to the grid', () => {
    for (const seed of ['a', 'b', 'c']) {
      const cw = buildCrossword(WORDS, seededRng(seed))
      expect(cw.words.length).toBeGreaterThanOrEqual(5)
      expect(cw.words.length + cw.leftover.length).toBe(WORDS.length)
      for (const w of cw.words) expect(letterAt(cw, w)).toBe(w.word)
      // Every word shares at least one cell with another word.
      for (const w of cw.words) {
        const mine = new Set(wordCells(w).map(String))
        expect(cw.words.some((o) => o !== w && wordCells(o).some((c) => mine.has(String(c))))).toBe(true)
      }
      expect(cw.rows).toBeLessThanOrEqual(14)
      expect(cw.cols).toBeLessThanOrEqual(14)
    }
  })
  it('numbers word starts in reading order', () => {
    const cw = buildCrossword(WORDS, seededRng('n'))
    const nums = cw.words.map((w) => w.number)
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
    expect(nums[0]).toBe(1)
    for (const w of cw.words) {
      const before = cw.words.filter((o) => o.row < w.row || (o.row === w.row && o.col < w.col))
      expect(before.every((o) => o.number <= w.number)).toBe(true)
    }
  })
  it('leaves out words that share no letters', () => {
    const cw = buildCrossword([{ key: 'a', word: 'ABC' }, { key: 'x', word: 'XYZ' }], seededRng('l'))
    expect(cw.words).toHaveLength(1)
    expect([cw.words[0].key, ...cw.leftover].sort()).toEqual(['a', 'x'])
  })
})
