import { describe, expect, it } from 'vitest'
import {
  fallSeconds,
  levelFor,
  matchMeteor,
  maxMeteors,
  MAX_STEP,
  pickNext,
  shouldSpawn,
  spawnX,
  step,
  type Meteor,
} from './meteor'

const opts = { strictness: 'normal' as const, ignoreAccents: true }
const rock = (id: number, answer: string, y: number, x = 0.5): Meteor<null> => ({
  id,
  item: null,
  answer,
  x,
  y,
  speed: 0.5,
})

describe('difficulty curve', () => {
  it('levels up every 8 hits', () => {
    expect(levelFor(0)).toBe(1)
    expect(levelFor(7)).toBe(1)
    expect(levelFor(8)).toBe(2)
    expect(levelFor(17)).toBe(3)
  })
  it('falls faster each level but never under 4 seconds', () => {
    expect(fallSeconds(1)).toBe(12)
    expect(fallSeconds(2)).toBeLessThan(fallSeconds(1))
    expect(fallSeconds(50)).toBe(4)
  })
  it('adds meteors on screen up to 4', () => {
    expect(maxMeteors(1)).toBe(1)
    expect(maxMeteors(2)).toBe(2)
    expect(maxMeteors(40)).toBe(4)
  })
})

describe('shouldSpawn', () => {
  it('drops one straight away when the field is empty', () => {
    expect(shouldSpawn(0, 0, 1, 5)).toBe(true)
  })
  it('respects the on-screen limit and the number of cards', () => {
    expect(shouldSpawn(1, 99, 1, 5)).toBe(false)
    expect(shouldSpawn(1, 99, 4, 1)).toBe(false)
    expect(shouldSpawn(1, 99, 4, 5)).toBe(true)
  })
  it('waits for the gap while others are falling', () => {
    expect(shouldSpawn(1, 0.5, 4, 5)).toBe(false)
  })
})

describe('step', () => {
  it('moves meteors by speed times time and splits off landed ones', () => {
    const { flying, landed } = step([rock(1, 'a', 0.2), rock(2, 'b', 0.98)], 0.1)
    expect(flying.map((m) => m.id)).toEqual([1])
    expect(flying[0].y).toBeCloseTo(0.25)
    expect(landed.map((m) => m.id)).toEqual([2])
  })
  it('caps a long frame', () => {
    const { flying } = step([rock(1, 'a', 0)], 5)
    expect(flying[0].y).toBeCloseTo(0.5 * MAX_STEP)
  })
})

describe('spawnX', () => {
  it('stays inside the field', () => {
    let seed = 1
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 20; i++) {
      const x = spawnX([], rng)
      expect(x).toBeGreaterThanOrEqual(0.2)
      expect(x).toBeLessThanOrEqual(0.8)
    }
  })
  it('keeps away from a meteor near the top', () => {
    const tries = [0.3, 0.9] // -> x = 0.38 (next to the meteor) and 0.74
    let i = 0
    const x = spawnX([rock(1, 'a', 0.1, 0.4)], () => tries[i++ % 2], 2)
    expect(x).toBeCloseTo(0.74)
  })
})

describe('pickNext', () => {
  const items = ['a', 'b', 'c'].map((key) => ({ key }))
  it('skips items already falling and wraps around', () => {
    expect(pickNext(items, 0, new Set())).toBe(0)
    expect(pickNext(items, 2, new Set(['c']))).toBe(0)
    expect(pickNext(items, 1, new Set(['b', 'c']))).toBe(0)
  })
})

describe('matchMeteor', () => {
  it('destroys the lowest matching meteor', () => {
    const list = [rock(1, 'gato', 0.2), rock(2, 'gato', 0.7), rock(3, 'perro', 0.9)]
    expect(matchMeteor(list, 'gato', opts)?.id).toBe(2)
  })
  it('accepts small typos and alternatives', () => {
    expect(matchMeteor([rock(1, 'mariposa', 0.5)], 'maripsa', opts)?.id).toBe(1)
    expect(matchMeteor([rock(1, 'car / auto', 0.5)], 'auto', opts)?.id).toBe(1)
  })
  it('returns nothing for a wrong answer', () => {
    expect(matchMeteor([rock(1, 'gato', 0.5)], 'perro', opts)).toBeUndefined()
  })
})
