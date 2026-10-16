// Duel: players answer the same question at once.
// On one phone the first right answer scores (or hits, in a battle); a wrong pick locks that player out of the question.

import { baseDamage } from './boss'
import { canScramble, scrambleChars } from './games'
import type { StudyItem } from './session'

export const DUEL_TARGET = 7
export const DUEL_QUESTION_MS = 12_000
export const DUEL_SCRAMBLE_MS = 40_000
/** Each player's health in a battle. */
export const DUEL_HP = 60
/** Scramble games use answers up to this length so the tiles fit half a phone screen. */
export const DUEL_MAX_LETTERS = 12

export type DuelGame = 'choice' | 'scramble' | 'battle' | 'battle-scramble'
export const isBattle = (g: DuelGame) => g === 'battle' || g === 'battle-scramble'
export const usesScramble = (g: DuelGame) => g === 'scramble' || g === 'battle-scramble'

export const DUEL_GAMES: { id: DuelGame; name: string; text: string }[] = [
  { id: 'choice', name: 'Multiple Choice', text: `The first right pick scores. First to ${DUEL_TARGET} wins.` },
  { id: 'scramble', name: 'Scramble', text: `Race to unscramble the answer. First to ${DUEL_TARGET} wins.` },
  { id: 'battle', name: 'Battle', text: 'Multiple choice. A right answer hits your rival; the last one standing wins.' },
  { id: 'battle-scramble', name: 'Scramble Battle', text: 'Unscramble to hit your rival. Longer words hit harder.' },
]

/** Answers that fit a scramble on half a phone screen. */
export const duelScrambleable = (it: Pick<StudyItem, 'answer'>) => canScramble(it.answer) && scrambleChars(it.answer).length <= DUEL_MAX_LETTERS

/** Damage of a right answer in a battle. */
export const duelDamage = (game: DuelGame, answer: string) =>
  game === 'battle-scramble' ? baseDamage('scramble', scrambleChars(answer).length) : 10

export interface DuelQuestion {
  picks: (number | null)[]
  locked: boolean[]
  /** The player who won the question, 'none' when it ended without one, null while open. */
  outcome: number | 'none' | null
}

export interface DuelState {
  battle: boolean
  scores: number[]
  /** Health per player; only used in a battle. */
  hp: number[]
  q: DuelQuestion
}

export type DuelAction =
  | { type: 'pick'; player: number; choice: number; correct: number; damage: number }
  | { type: 'solve'; player: number; damage: number }
  | { type: 'timeout' }
  | { type: 'next' }
  | { type: 'reset' }

const fill = <T,>(n: number, v: T): T[] => Array.from({ length: n }, () => v)
const setAt = <T,>(list: T[], i: number, v: T): T[] => list.map((x, j) => (j === i ? v : x))

export const newQuestion = (players: number): DuelQuestion => ({ picks: fill(players, null), locked: fill(players, false), outcome: null })

export const newDuel = (players = 2, battle = false): DuelState => ({
  battle,
  scores: fill(players, 0),
  hp: fill(players, battle ? DUEL_HP : 0),
  q: newQuestion(players),
})

/** Whom a hit lands on: the other player with the most health still standing (the first one on a tie). */
export function hitTarget(hp: number[], attacker: number): number {
  let target = -1
  hp.forEach((h, i) => {
    if (i !== attacker && h > 0 && (target < 0 || h > hp[target])) target = i
  })
  return target
}

/** Scores the point, or in a battle deals `damage` to the attacker's target. */
export function award(s: Omit<DuelState, 'q'>, player: number, damage: number): Pick<DuelState, 'scores' | 'hp'> {
  const scores = setAt(s.scores, player, s.scores[player] + 1)
  if (!s.battle) return { scores, hp: s.hp }
  const target = hitTarget(s.hp, player)
  return { scores, hp: target < 0 ? s.hp : setAt(s.hp, target, Math.max(0, s.hp[target] - damage)) }
}

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.type) {
    case 'pick': {
      if (s.q.outcome !== null || s.q.locked[a.player]) return s
      const picks = setAt(s.q.picks, a.player, a.choice)
      if (a.choice === a.correct) return { ...s, ...award(s, a.player, a.damage), q: { ...s.q, picks, outcome: a.player } }
      const locked = setAt(s.q.locked, a.player, true)
      return { ...s, q: { picks, locked, outcome: locked.every(Boolean) ? 'none' : null } }
    }
    case 'solve':
      return s.q.outcome === null ? { ...s, ...award(s, a.player, a.damage), q: { ...s.q, outcome: a.player } } : s
    case 'timeout':
      return s.q.outcome === null ? { ...s, q: { ...s.q, outcome: 'none' } } : s
    case 'next':
      return { ...s, q: newQuestion(s.scores.length) }
    case 'reset':
      return newDuel(s.scores.length, s.battle)
  }
}

/** The winner: the first to `target` points, or in a battle the last player standing. */
export function duelWinner(s: Pick<DuelState, 'battle' | 'scores' | 'hp'>, target = DUEL_TARGET): number | null {
  if (s.battle) {
    const standing = s.hp.flatMap((h, i) => (h > 0 ? [i] : []))
    return standing.length === 1 ? standing[0] : null
  }
  const i = s.scores.findIndex((n) => n >= target)
  return i < 0 ? null : i
}
