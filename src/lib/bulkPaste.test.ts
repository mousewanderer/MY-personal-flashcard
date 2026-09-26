import { describe, expect, it } from 'vitest'
import { detectSeparator, parseBulk } from './bulkPaste'

describe('bulk paste', () => {
  it('detects each separator', () => {
    expect(detectSeparator('a\tb\nc\td')).toBe('\t')
    expect(detectSeparator('a,b\nc,d')).toBe(',')
    expect(detectSeparator('a;b\nc;d')).toBe(';')
    expect(detectSeparator('dog - perro\ncat - gato')).toBe(' - ')
    expect(detectSeparator('dog : perro\ncat : gato')).toBe(' : ')
  })
  it('prefers the separator found on the most lines', () => {
    expect(detectSeparator('a - b, c\nd - e\nf - g')).toBe(' - ')
  })
  it('splits on the first occurrence for non-tab separators', () => {
    expect(parseBulk('a, b, c', ',').cards).toEqual([{ front: 'a', back: 'b, c', options: [] }])
  })
  it('reads options from tab columns', () => {
    expect(parseBulk('q\ta\tw1\tw2').cards[0]).toEqual({ front: 'q', back: 'a', options: ['w1', 'w2'] })
  })
  it('skips blank lines and reports lines without a pair', () => {
    const res = parseBulk('a - b\n\nno separator here\nc - d', ' - ')
    expect(res.cards).toHaveLength(2)
    expect(res.skipped).toEqual([3])
  })
})
