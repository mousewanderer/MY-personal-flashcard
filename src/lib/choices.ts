import type { Card } from '../types'
import { shuffle, type Rng } from './random'
import type { StudyItem } from './session'

const key = (s: string) => s.trim().toLowerCase()

/**
 * Up to `count` options: the correct answer, the card's own wrong options first,
 * then other answers from the set. No duplicates, never the correct answer twice.
 */
export function buildChoices(correct: string, own: string[], pool: string[], rng: Rng, count = 4): string[] {
  const answer = correct.trim()
  const seen = new Set([key(answer)])
  const wrong: string[] = []
  const take = (s: string) => {
    const k = key(s)
    if (!k || seen.has(k) || wrong.length >= count - 1) return
    seen.add(k)
    wrong.push(s.trim())
  }
  own.forEach(take)
  shuffle(pool, rng).forEach(take)
  return shuffle([answer, ...wrong], rng)
}

/** Choices for a study item: own wrong options (written for the back) only when not reversed. */
export function itemChoices(item: StudyItem, allCards: Card[], rng: Rng): string[] {
  const pool = allCards.filter((c) => c.id !== item.card.id).map((c) => (item.reversed ? c.front : c.back))
  return buildChoices(item.answer, item.reversed ? [] : item.card.options, pool, rng)
}
