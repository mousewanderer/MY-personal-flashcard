import { describe, expect, it } from 'vitest'
import { baseDamage, bossAnswer, bossMaxHp, bossOutcome, ENEMIES, multiplier, newBoss, nextQueue } from './boss'

const [easy, medium, hard] = ENEMIES

describe('boss', () => {
  it('scales health with the set size within limits, then by enemy', () => {
    expect(bossMaxHp(2, easy)).toBe(60)
    expect(bossMaxHp(12, easy)).toBe(120)
    expect(bossMaxHp(80, easy)).toBe(300)
    expect(bossMaxHp(12, medium)).toBe(180)
    expect(bossMaxHp(12, hard)).toBe(240)
  })
  it('hits harder with longer scramble words', () => {
    expect(baseDamage('choice', 12)).toBe(10)
    expect(baseDamage('scramble', 1)).toBe(8)
    expect(baseDamage('scramble', 6)).toBe(24)
  })
  it('multiplies damage on a streak', () => {
    expect([1, 2, 3, 5, 6, 9].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3])
  })
  it('deals damage on right answers and resets the streak on a wrong one', () => {
    let s = newBoss(10, easy)
    const damages: number[] = []
    for (let i = 0; i < 3; i++) {
      const r = bossAnswer(s, easy, true, 4)
      damages.push(r.damage)
      s = r.state
    }
    expect(damages).toEqual([10, 10, 20])
    expect(s.hp).toBe(60)
    const miss = bossAnswer(s, easy, false, 4)
    expect(miss.damage).toBe(0)
    expect(miss.state).toMatchObject({ hearts: 4, streak: 0, hp: 60 })
  })
  it('has no combos on the hard enemy', () => {
    let s = newBoss(10, hard)
    for (let i = 0; i < 6; i++) s = bossAnswer(s, hard, true, 5).state
    expect(bossAnswer(s, hard, true, 5)).toMatchObject({ damage: 20, mult: 1 })
  })
  it('reports a win or a loss', () => {
    expect(bossOutcome({ ...newBoss(6, easy), hp: 0 })).toBe('won')
    expect(bossOutcome({ ...newBoss(6, easy), hearts: 0 })).toBe('lost')
    expect(bossOutcome(newBoss(6, easy))).toBeNull()
  })
  it('sends a right card to the back and brings a miss back 3 cards later', () => {
    expect(nextQueue([1, 2, 3, 4, 5], true)).toEqual([2, 3, 4, 5, 1])
    expect(nextQueue([1, 2, 3, 4, 5], false)).toEqual([2, 3, 4, 1, 5])
    expect(nextQueue([1, 2], false)).toEqual([2, 1])
    expect(nextQueue([1], false)).toEqual([1])
  })
})
