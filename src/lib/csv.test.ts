import { describe, expect, it } from 'vitest'
import { csvFileName, parseSimpleCsv, rowsToCards, titleFromFileName, toSimpleCsv } from './csv'

const tricky = [
  { front: 'a, b', back: 'says "hi"', options: ['x', 'y'] },
  { front: 'line\nbreak', back: 'niño, año', options: [] },
  { front: 'café', back: 'Ñandú 🦤', options: ['', 'z'].filter(Boolean) },
  { front: 'plain', back: 'text', options: ['o1', 'o2', 'o3'] },
]

describe('simple CSV round trip', () => {
  it('keeps commas, quotes, line breaks, accents and emoji', () => {
    const text = toSimpleCsv(tricky)
    const { rows, headerLikely } = parseSimpleCsv(text)
    expect(headerLikely).toBe(false)
    expect(rowsToCards(rows).cards).toEqual(tricky)
  })
  it('exports without header or BOM', () => {
    const text = toSimpleCsv([{ front: 'f', back: 'b', options: [] }])
    expect(text).toBe('f,b')
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
  })
})

describe('simple CSV import', () => {
  it('strips a BOM', () => {
    const { rows } = parseSimpleCsv('﻿hola,hello\nadiós,bye')
    expect(rows[0][0]).toBe('hola')
    expect(rowsToCards(rows).cards).toHaveLength(2)
  })
  it('detects tab and semicolon separators', () => {
    expect(parseSimpleCsv('a\tb, with comma\nc\td').rows).toEqual([['a', 'b, with comma'], ['c', 'd']])
    expect(parseSimpleCsv('a;b\nc;d, e').rows).toEqual([['a', 'b'], ['c', 'd, e']])
  })
  it('detects header rows', () => {
    expect(parseSimpleCsv('Term,Definition\na,b').headerLikely).toBe(true)
    expect(parseSimpleCsv('front;back\na;b').headerLikely).toBe(true)
    expect(parseSimpleCsv('question,answer\na,b').headerLikely).toBe(true)
    expect(parseSimpleCsv('cat,gato\na,b').headerLikely).toBe(false)
  })
  it('skips rows missing front or back and reports row numbers', () => {
    const { rows } = parseSimpleCsv('a,b\nonly\n,c\nd,e')
    const res = rowsToCards(rows)
    expect(res.cards.map((c) => c.front)).toEqual(['a', 'd'])
    expect(res.skipped).toEqual([2, 3])
  })
  it('keeps at most 3 options and drops empty ones', () => {
    const { rows } = parseSimpleCsv('a,b,,o2,o3,o4')
    expect(rowsToCards(rows).cards[0].options).toEqual(['o2', 'o3'])
  })
})

describe('file names', () => {
  it('uses the set title and strips illegal characters', () => {
    expect(csvFileName('Spanish: basics/1')).toBe('Spanish_ basics_1.csv')
    expect(titleFromFileName('My set.csv')).toBe('My set')
  })
})
