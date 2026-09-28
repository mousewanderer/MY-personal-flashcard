// Boss Battle: right answers damage the boss, wrong or slow answers cost a heart.

export const BOSS_HEARTS = 3
export const BOSS_QUESTION_MS = 10_000
export const BASE_DAMAGE = 10

export interface BossState {
  hp: number
  maxHp: number
  hearts: number
  /** Right answers in a row. */
  streak: number
}

/** 10 health per card, kept between 60 and 300. */
export const bossMaxHp = (cards: number) => Math.min(300, Math.max(60, 10 * cards))

/** Damage multiplier for the answer that makes `streak` right in a row: x2 from 3, x3 from 6. */
export const multiplier = (streak: number) => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1)

export function newBoss(cards: number): BossState {
  const hp = bossMaxHp(cards)
  return { hp, maxHp: hp, hearts: BOSS_HEARTS, streak: 0 }
}

export function bossAnswer(s: BossState, correct: boolean): { state: BossState; damage: number } {
  if (!correct) return { state: { ...s, hearts: Math.max(0, s.hearts - 1), streak: 0 }, damage: 0 }
  const streak = s.streak + 1
  const damage = BASE_DAMAGE * multiplier(streak)
  return { state: { ...s, streak, hp: Math.max(0, s.hp - damage) }, damage }
}

export function bossOutcome(s: BossState): 'won' | 'lost' | null {
  if (s.hp <= 0) return 'won'
  if (s.hearts <= 0) return 'lost'
  return null
}
