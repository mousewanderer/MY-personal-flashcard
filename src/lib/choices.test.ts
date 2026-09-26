import { describe, expect, it } from 'vitest'
import { buildChoices } from './choices'

describe('multiple choice options', () => {
  it('uses the card options first, then fills from the pool', () => {
    const c = buildChoices('gato', ['perro'], ['casa', 'agua', 'sol'], Math.random)
    expect(c).toHaveLength(4)
    expect(c).toContain('gato')
    expect(c).toContain('perro')
  })
  it('never duplicates and never repeats the correct answer', () => {
    for (let i = 0; i < 50; i++) {
      const c = buildChoices('Gato', ['gato ', 'perro'], ['Perro', 'casa', 'casa', 'GATO', 'sol'], Math.random)
      expect(new Set(c.map((x) => x.toLowerCase())).size).toBe(c.length)
      expect(c.filter((x) => x.toLowerCase() === 'gato')).toHaveLength(1)
      expect(c).toHaveLength(4)
    }
  })
  it('returns fewer options when the pool is small', () => {
    expect(buildChoices('a', [], ['b'], Math.random).sort()).toEqual(['a', 'b'])
  })
})
