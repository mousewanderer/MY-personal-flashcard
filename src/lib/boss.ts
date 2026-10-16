// Boss Battle: pick an enemy, then answer to attack it. Each mistake lets it hit back and costs a heart.

export type BossLevel = 'easy' | 'medium' | 'hard'
export type BossQuestion = 'choice' | 'scramble'

export interface Enemy {
  level: BossLevel
  name: string
  question: BossQuestion
  hearts: number
  /** Multiplies the enemy's health. */
  hpScale: number
  /** Time per question in milliseconds, or 0 for no timer. */
  timeMs: number
  /** Whether right answers in a row multiply damage. */
  combos: boolean
}

export const ENEMIES: Enemy[] = [
  { level: 'easy', name: 'Ink Slime', question: 'choice', hearts: 5, hpScale: 1, timeMs: 0, combos: true },
  { level: 'medium', name: 'Stone Golem', question: 'scramble', hearts: 4, hpScale: 1.5, timeMs: 0, combos: true },
  { level: 'hard', name: 'Horned Tyrant', question: 'scramble', hearts: 4, hpScale: 2, timeMs: 60_000, combos: false },
]

export interface BossState {
  hp: number
  maxHp: number
  hearts: number
  /** Right answers in a row. */
  streak: number
}

/** 10 health per card, kept between 60 and 300, then scaled by the enemy. */
export const bossMaxHp = (cards: number, enemy: Enemy) => Math.round(Math.min(300, Math.max(60, 10 * cards)) * enemy.hpScale)

/** 10 for multiple choice. A scramble deals 4 per letter (at least 8), so longer words hit harder. */
export const baseDamage = (question: BossQuestion, letters: number) => (question === 'choice' ? 10 : Math.max(8, 4 * letters))

/** Damage multiplier for the answer that makes `streak` right in a row: x2 from 3, x3 from 6. */
export const multiplier = (streak: number) => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1)

export function newBoss(cards: number, enemy: Enemy): BossState {
  const hp = bossMaxHp(cards, enemy)
  return { hp, maxHp: hp, hearts: enemy.hearts, streak: 0 }
}

export function bossAnswer(
  s: BossState,
  enemy: Enemy,
  correct: boolean,
  letters: number,
): { state: BossState; damage: number; mult: number } {
  if (!correct) return { state: { ...s, hearts: Math.max(0, s.hearts - 1), streak: 0 }, damage: 0, mult: 1 }
  const streak = s.streak + 1
  const mult = enemy.combos ? multiplier(streak) : 1
  const damage = baseDamage(enemy.question, letters) * mult
  return { state: { ...s, streak, hp: Math.max(0, s.hp - damage) }, damage, mult }
}

export function bossOutcome(s: BossState): 'won' | 'lost' | null {
  if (s.hp <= 0) return 'won'
  if (s.hearts <= 0) return 'lost'
  return null
}

/** A missed card comes back this many cards later, as in Learn. */
export const MISS_GAP = 3

/** Moves the current card (the head): to the back when right, `MISS_GAP` places on when missed. */
export function nextQueue<T>(queue: T[], correct: boolean): T[] {
  if (queue.length < 2) return queue
  const [head, ...rest] = queue
  if (correct) return [...rest, head]
  const at = Math.min(MISS_GAP, rest.length)
  return [...rest.slice(0, at), head, ...rest.slice(at)]
}
