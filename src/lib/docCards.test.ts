import { describe, expect, it } from 'vitest'
import { blankFront, sentenceAround, termFront } from './docCards'

const text = 'Cells need energy. The mitochondria\nmake ATP for the cell! Plants also\nhave chloroplasts.\n\nNew paragraph here'
const at = (word: string) => [text.indexOf(word), text.indexOf(word) + word.length] as const

describe('sentenceAround', () => {
  it('finds the sentence and ignores single line breaks', () => {
    const [a, b] = at('ATP')
    const s = sentenceAround(text, a, b)
    expect(text.slice(s.start, s.end)).toBe('The mitochondria\nmake ATP for the cell!')
  })
  it('works at the start of the text and stops at a blank line', () => {
    const [a, b] = at('Cells')
    const first = sentenceAround(text, a, b)
    expect(text.slice(first.start, first.end)).toBe('Cells need energy.')
    const [c, d] = at('chloroplasts')
    const s = sentenceAround(text, c, d)
    expect(text.slice(s.start, s.end)).toBe('Plants also\nhave chloroplasts.')
    const [e, f] = at('paragraph')
    const p = sentenceAround(text, e, f)
    expect(text.slice(p.start, p.end)).toBe('New paragraph here')
  })
})

describe('blankFront', () => {
  it('makes the selection the blank on one line', () => {
    const [a, b] = at('mitochondria')
    expect(blankFront(text, a, b)).toBe('The {{mitochondria}} make ATP for the cell!')
  })
  it('trims spaces from the selection and rejects an empty one', () => {
    const [a, b] = at(' energy')
    expect(blankFront(text, a, b)).toBe('Cells need {{energy}}.')
    expect(blankFront(text, 3, 3)).toBeNull()
  })
  it('shortens a very long sentence around the blank', () => {
    const long = `${'word '.repeat(100)}target ${'more '.repeat(100)}end.`
    const i = long.indexOf('target')
    const front = blankFront(long, i, i + 6)!
    expect(front).toContain('{{target}}')
    expect(front.length).toBeLessThan(300)
    expect(front.startsWith('…')).toBe(true)
  })
})

describe('termFront', () => {
  it('puts the selection on one line', () => {
    expect(termFront('a\n  b c', 0, 7)).toBe('a b c')
  })
})
