import { describe, expect, it } from 'vitest'
import { duelReducer, duelWinner, newDuel, type DuelState } from './duel'

describe('duel', () => {
  const pick = (s: DuelState, player: 0 | 1, choice: number) => duelReducer(s, { type: 'pick', player, choice, correct: 2 })

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
  it('ends the question with no point when both miss or time runs out', () => {
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
})
