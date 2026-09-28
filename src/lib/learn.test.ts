import { describe, expect, it } from 'vitest'
import { advance, learnProgress, nextRound, questionKind, type LearnStage } from './learn'

const items = ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key }))
const keys = (list: { key: string }[]) => list.map((i) => i.key)

describe('advance', () => {
  it('moves one stage on when correct and stops at learned', () => {
    expect(advance(0, true)).toBe(1)
    expect(advance(1, true)).toBe(2)
    expect(advance(2, true)).toBe(2)
  })
  it('keeps the stage when wrong', () => {
    expect(advance(0, false)).toBe(0)
    expect(advance(1, false)).toBe(1)
  })
})

describe('questionKind', () => {
  it('asks multiple choice first, then writing', () => {
    expect(questionKind(0, 4)).toBe('choice')
    expect(questionKind(1, 4)).toBe('write')
  })
  it('falls back to writing when there are not two options', () => {
    expect(questionKind(0, 1)).toBe('write')
  })
})

describe('nextRound', () => {
  it('takes cards in order up to the round size', () => {
    expect(keys(nextRound(items, new Map(), 3))).toEqual(['a', 'b', 'c'])
  })
  it('brings started cards back before new ones and skips learned cards', () => {
    const stages = new Map<string, LearnStage>([
      ['a', 2],
      ['b', 0],
      ['c', 1],
    ])
    expect(keys(nextRound(items, stages, 3))).toEqual(['b', 'c', 'd'])
  })
  it('is empty once every card is learned', () => {
    const stages = new Map<string, LearnStage>(items.map((i) => [i.key, 2]))
    expect(nextRound(items, stages)).toEqual([])
  })
})

describe('learnProgress', () => {
  it('counts learned and familiar cards', () => {
    const stages = new Map<string, LearnStage>([
      ['a', 2],
      ['b', 1],
      ['c', 0],
    ])
    expect(learnProgress(keys(items), stages)).toEqual({ learned: 1, familiar: 1, total: 5 })
  })
})
