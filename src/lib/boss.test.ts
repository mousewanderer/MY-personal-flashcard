import { describe, expect, it } from 'vitest'
import { bossAnswer, bossMaxHp, bossOutcome, multiplier, newBoss } from './boss'

describe('boss', () => {
  it('scales health with the set size within limits', () => {
    expect(bossMaxHp(2)).toBe(60)
    expect(bossMaxHp(12)).toBe(120)
    expect(bossMaxHp(80)).toBe(300)
  })
  it('multiplies damage on a streak', () => {
    expect([1, 2, 3, 5, 6, 9].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3])
  })
  it('deals damage on right answers and resets the streak on a wrong one', () => {
    let s = newBoss(10)
    const damages: number[] = []
    for (let i = 0; i < 3; i++) {
      const r = bossAnswer(s, true)
      damages.push(r.damage)
      s = r.state
    }
    expect(damages).toEqual([10, 10, 20])
    expect(s.hp).toBe(60)
    const miss = bossAnswer(s, false)
    expect(miss.damage).toBe(0)
    expect(miss.state).toMatchObject({ hearts: 2, streak: 0, hp: 60 })
  })
  it('reports a win or a loss', () => {
    expect(bossOutcome({ ...newBoss(6), hp: 0 })).toBe('won')
    expect(bossOutcome({ ...newBoss(6), hearts: 0 })).toBe('lost')
    expect(bossOutcome(newBoss(6))).toBeNull()
  })
})
