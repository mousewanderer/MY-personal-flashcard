import type { StudyItem } from '../lib/session'
import type { Card, Rating, ReviewState, Settings } from '../types'

export interface SessionResult {
  correct: number
  wrong: number
  missed: Card[]
  ms: number
  note?: string
}

export interface ModeProps {
  setId: string
  items: StudyItem[]
  /** Every card in the set, used for distractors. */
  allCards: Card[]
  settings: Settings
  reviews: Map<string, ReviewState>
  practiceAhead: boolean
  /** Logs the answer and applies the schedule rule. Resolves to the new review state if it changed. */
  onAnswer: (item: StudyItem, correct: boolean, rating?: Rating) => Promise<ReviewState | undefined>
  onDone: (result: SessionResult) => void
}

/** Counts each card once: missed if it was answered wrong at least once. */
export function resultFrom(items: StudyItem[], missed: Set<string>, startedAt: number, note?: string): SessionResult {
  const cards = new Map(items.map((i) => [i.card.id, i.card]))
  const missedCards = [...cards.values()].filter((c) => missed.has(c.id))
  return {
    correct: cards.size - missedCards.length,
    wrong: missedCards.length,
    missed: missedCards,
    ms: Date.now() - startedAt,
    note,
  }
}
