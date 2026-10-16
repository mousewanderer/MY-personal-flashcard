import { describe, expect, it } from 'vitest'
import { newCelebrations, type CelebrateInput, type Unlockable } from './celebrate'

const ach = (id: string, unlocked: boolean) => ({ id, name: id.toUpperCase(), description: `did ${id}`, unlocked })
const input = (over: Partial<CelebrateInput> = {}): CelebrateInput => ({
  level: 3,
  rank: 'Novice',
  achievements: [ach('a', true), ach('b', false)],
  today: 5,
  goal: 20,
  day: '2026-10-17',
  ...over,
})
const unlocks: Unlockable[] = [
  { name: 'Forest', level: 3, what: 'accent colour' },
  { name: 'Bronze', level: 6, what: 'theme' },
]

describe('celebrations', () => {
  it('records the first state without celebrating', () => {
    const r = newCelebrations(undefined, input({ today: 25 }), unlocks)
    expect(r.events).toEqual([])
    expect(r.seen).toEqual({ level: 3, achievements: ['a'], goalDay: '2026-10-17' })
  })
  it('celebrates a level up with what it unlocks, and new achievements, once', () => {
    const { seen } = newCelebrations(undefined, input(), unlocks)
    const r = newCelebrations(seen, input({ level: 6, rank: 'Apprentice', achievements: [ach('a', true), ach('b', true)] }), unlocks)
    expect(r.events).toEqual([
      { kind: 'level', level: 6, rank: 'Apprentice' },
      { kind: 'unlock', name: 'Bronze', what: 'theme' },
      { kind: 'achievement', name: 'B', description: 'did b' },
    ])
    expect(newCelebrations(r.seen, input({ level: 6, achievements: [ach('a', true), ach('b', true)] }), unlocks).events).toEqual([])
  })
  it('celebrates the daily goal once a day', () => {
    const { seen } = newCelebrations(undefined, input(), unlocks)
    const met = newCelebrations(seen, input({ today: 20 }), unlocks)
    expect(met.events).toEqual([{ kind: 'goal', goal: 20 }])
    expect(newCelebrations(met.seen, input({ today: 21 }), unlocks).events).toEqual([])
    expect(newCelebrations(met.seen, input({ today: 20, day: '2026-10-18' }), unlocks).events).toEqual([{ kind: 'goal', goal: 20 }])
  })
  it('does not repeat an achievement that was lost and regained', () => {
    const { seen } = newCelebrations(undefined, input(), unlocks)
    const lost = newCelebrations(seen, input({ achievements: [ach('a', false), ach('b', false)] }), unlocks)
    expect(newCelebrations(lost.seen, input(), unlocks).events).toEqual([])
  })
})
