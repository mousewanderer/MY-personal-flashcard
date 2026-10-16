import { describe, expect, it } from 'vitest'
import { DUEL_HP, duelReducer, duelWinner, hitTarget, newDuel, type DuelState } from './duel'

describe('duel', () => {
  const pick = (s: DuelState, player: number, choice: number) =>
    duelReducer(s, { type: 'pick', player, choice, correct: 2, damage: 10 })

  it('gives the point to the first right pick and ignores later picks', () => {
    let s = pick(newDuel(), 1, 2)
    expect(s.scores).toEqual([0, 1])
    expect(s.q.outcome).toBe(1)
    s = pick(s, 0, 2)
    expect(s.scores).toEqual([0, 1])
  })
  it('locks out a wrong pick but lets the other player answer', () => {
    let s = pick(newDuel(), 0, 1)
    expect(s.q.locked).toEqual([true, false])
    expect(s.q.outcome).toBeNull()
    expect(pick(s, 0, 2)).toBe(s)
    s = pick(s, 1, 2)
    expect(s.scores).toEqual([0, 1])
  })
  it('ends the question with no point when everyone misses or time runs out', () => {
    expect(pick(pick(newDuel(), 0, 1), 1, 3).q.outcome).toBe('none')
    expect(duelReducer(newDuel(), { type: 'timeout' }).q.outcome).toBe('none')
  })
  it('keeps scores on the next question and finds the winner at the target', () => {
    let s = newDuel()
    for (let i = 0; i < 3; i++) s = duelReducer(pick(s, 0, 2), { type: 'next' })
    expect(s.scores).toEqual([3, 0])
    expect(s.q.outcome).toBeNull()
    expect(duelWinner(s, 3)).toBe(0)
    expect(duelWinner(s, 4)).toBeNull()
    expect(duelReducer(s, { type: 'reset' })).toEqual(newDuel())
  })
  it('scores the first finished scramble only', () => {
    let s = duelReducer(newDuel(), { type: 'solve', player: 1, damage: 20 })
    s = duelReducer(s, { type: 'solve', player: 0, damage: 20 })
    expect(s.scores).toEqual([0, 1])
    expect(s.q.outcome).toBe(1)
  })
  it('hits the other player in a battle until one is left standing', () => {
    let s = newDuel(2, true)
    s = duelReducer(s, { type: 'solve', player: 0, damage: 24 })
    expect(s.hp).toEqual([DUEL_HP, DUEL_HP - 24])
    for (let i = 0; i < 2; i++) s = duelReducer(duelReducer(s, { type: 'next' }), { type: 'solve', player: 0, damage: 24 })
    expect(s.hp[1]).toBe(0)
    expect(duelWinner(s)).toBe(0)
  })
  it('aims at the healthiest other player still standing', () => {
    expect(hitTarget([60, 30, 50, 0], 0)).toBe(2)
    expect(hitTarget([60, 30, 50, 0], 2)).toBe(0)
    expect(hitTarget([60, 0, 0, 0], 0)).toBe(-1)
  })
})
