import Papa from 'papaparse'
import type { Card, CardInput } from '../types'
import { clozeBack } from './cloze'

export interface SimpleCsv {
  rows: string[][]
  /** True when the first row looks like a header (front/back, term/definition, question/answer). */
  headerLikely: boolean
}

const HEADER_PAIRS = [
  ['front', 'back'],
  ['term', 'definition'],
  ['question', 'answer'],
]

export const stripBom = (text: string) => text.replace(/^﻿/, '')

/** Format A: no header, columns front, back, then up to 3 wrong options. Comma, tab or semicolon. */
export function parseSimpleCsv(text: string): SimpleCsv {
  const parsed = Papa.parse<string[]>(stripBom(text), {
    delimitersToGuess: [',', '\t', ';'],
    skipEmptyLines: 'greedy',
  })
  const rows = parsed.data.map((row) => row.map((cell) => (cell ?? '').trim()))
  const first = rows[0]?.slice(0, 2).map((c) => c.toLowerCase()) ?? []
  const headerLikely = HEADER_PAIRS.some(([a, b]) => first[0] === a && first[1] === b)
  return { rows, headerLikely }
}

export interface RowsResult {
  cards: CardInput[]
  /** 1-based row numbers that were skipped because front or back was empty. */
  skipped: number[]
}

export function rowsToCards(rows: string[][], firstRowNumber = 1): RowsResult {
  const cards: CardInput[] = []
  const skipped: number[] = []
  rows.forEach((row, i) => {
    const [front = '', given = '', ...rest] = row
    const back = clozeBack(front, given)
    if (!front || !back) {
      skipped.push(firstRowNumber + i)
      return
    }
    cards.push({ front, back, options: rest.slice(0, 3).filter(Boolean) })
  })
  return { cards, skipped }
}

/** Format A export: no header, no BOM. */
export function toSimpleCsv(cards: Pick<Card, 'front' | 'back' | 'options'>[]): string {
  return Papa.unparse(
    cards.map((c) => [c.front, c.back, ...c.options.slice(0, 3)]),
    { newline: '\r\n' },
  )
}

export function csvFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'set'
  return `${safe}.csv`
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || 'Imported set'
}
