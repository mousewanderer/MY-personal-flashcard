// Duel: two players answer the same multiple-choice question at once.
// The first right pick scores; a wrong pick locks that player out of the question.

export const DUEL_TARGET = 7
export const DUEL_QUESTION_MS = 12_000

export type Player = 0 | 1
type Pair<T> = [T, T]

export interface DuelQuestion {
  picks: Pair<number | null>
  locked: Pair<boolean>
  /** The player who scored, 'none' when the question ended without a point, null while open. */
  outcome: Player | 'none' | null
}

export interface DuelState {
  scores: Pair<number>
  q: DuelQuestion
}

export type DuelAction =
  | { type: 'pick'; player: Player; choice: number; correct: number }
  | { type: 'timeout' }
  | { type: 'next' }
  | { type: 'reset' }

export const newQuestion = (): DuelQuestion => ({ picks: [null, null], locked: [false, false], outcome: null })
export const newDuel = (): DuelState => ({ scores: [0, 0], q: newQuestion() })

const set = <T,>(pair: Pair<T>, i: Player, value: T): Pair<T> => (i === 0 ? [value, pair[1]] : [pair[0], value])

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.type) {
    case 'pick': {
      if (s.q.outcome !== null || s.q.locked[a.player]) return s
      const picks = set(s.q.picks, a.player, a.choice)
      if (a.choice === a.correct) {
        return { scores: set(s.scores, a.player, s.scores[a.player] + 1), q: { ...s.q, picks, outcome: a.player } }
      }
      const locked = set(s.q.locked, a.player, true)
      return { ...s, q: { picks, locked, outcome: locked[0] && locked[1] ? 'none' : null } }
    }
    case 'timeout':
      return s.q.outcome === null ? { ...s, q: { ...s.q, outcome: 'none' } } : s
    case 'next':
      return { ...s, q: newQuestion() }
    case 'reset':
      return newDuel()
  }
}

export function duelWinner(s: DuelState, target = DUEL_TARGET): Player | null {
  if (s.scores[0] >= target) return 0
  if (s.scores[1] >= target) return 1
  return null
}
