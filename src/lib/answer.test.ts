import { describe, expect, it } from 'vitest'
import { alternatives, checkAnswer, levenshtein, normalize, tolerance } from './answer'

const normal = { strictness: 'normal' as const, ignoreAccents: false }

describe('normalize', () => {
  it('trims, lowercases, collapses spaces and drops punctuation', () => {
    expect(normalize('  Hello,   World! ', false)).toBe('hello world')
    expect(normalize("don't", false)).toBe('dont')
  })
  it('keeps accents unless told to ignore them', () => {
    expect(normalize('Año', false)).toBe('año')
    expect(normalize('Año', true)).toBe('ano')
  })
  it('treats composed and decomposed accents the same', () => {
    expect(normalize('ñ', false)).toBe(normalize('ñ', false))
  })
})

describe('typo tolerance', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })
  it('allows 1 error per 6 characters (normal), min 1', () => {
    expect(tolerance(3, 'normal')).toBe(1)
    expect(tolerance(12, 'normal')).toBe(2)
    expect(tolerance(12, 'strict')).toBe(0)
    expect(tolerance(12, 'lenient')).toBe(3)
  })
})

describe('checkAnswer', () => {
  it('accepts exact answers after normalization', () => {
    expect(checkAnswer('  por FAVOR! ', 'Por favor', normal)).toBe('correct')
  })
  it('marks small typos as almost', () => {
    expect(checkAnswer('grasias', 'gracias', normal)).toBe('almost')
    expect(checkAnswer('grasias', 'gracias', { ...normal, strictness: 'strict' })).toBe('wrong')
  })
  it('rejects answers that are too far off', () => {
    expect(checkAnswer('perro', 'gato', normal)).toBe('wrong')
    expect(checkAnswer('', 'gato', normal)).toBe('wrong')
  })
  it('handles the accents setting', () => {
    expect(checkAnswer('adios', 'adiós', { ...normal, ignoreAccents: true })).toBe('correct')
    expect(checkAnswer('adios', 'adiós', normal)).toBe('almost')
    expect(checkAnswer('adios', 'adiós', { strictness: 'strict', ignoreAccents: false })).toBe('wrong')
  })
  it('accepts alternatives separated by / or ;', () => {
    expect(alternatives('car / automobile; auto')).toEqual(['car / automobile; auto', 'car', 'automobile', 'auto'])
    expect(checkAnswer('automobile', 'car / automobile', normal)).toBe('correct')
    expect(checkAnswer('auto', 'car; auto', normal)).toBe('correct')
  })
})
