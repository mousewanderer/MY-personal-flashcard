import { describe, expect, it } from 'vitest'
import { clozeBack, parseCloze, wrapBlank } from './cloze'

describe('parseCloze', () => {
  it('hides a blank and returns its words as the answer', () => {
    expect(parseCloze('The capital of {{France}} is Paris')).toEqual({
      prompt: 'The capital of ___ is Paris',
      answer: 'France',
    })
  })
  it('hides several blanks together', () => {
    expect(parseCloze('{{Paris}} is the capital of {{ France }}')).toEqual({
      prompt: '___ is the capital of ___',
      answer: 'Paris, France',
    })
  })
  it('treats text without blanks, empty braces or single braces as a normal card', () => {
    expect(parseCloze('plain text')).toBeNull()
    expect(parseCloze('empty {{ }} braces')).toBeNull()
    expect(parseCloze('a {single} brace')).toBeNull()
  })
})

describe('clozeBack', () => {
  it('fills the back of a blank card and keeps a normal back', () => {
    expect(clozeBack('I {{am}} here', '')).toBe('am')
    expect(clozeBack('cat', 'gato')).toBe('gato')
  })
})

describe('wrapBlank', () => {
  it('wraps the selection and keeps spaces outside', () => {
    expect(wrapBlank('The capital of France is', 14, 22)).toEqual({ text: 'The capital of {{France}} is', cursor: 25 })
  })
  it('does nothing without a selection', () => {
    expect(wrapBlank('abc', 1, 1)).toEqual({ text: 'abc', cursor: 1 })
  })
})
