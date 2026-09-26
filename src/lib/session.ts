import type { Card, Direction, ReviewState } from '../types'
import { shuffle, type Rng } from './random'
import { isDue } from './scheduler'

export interface StudyItem {
  /** Unique per appearance, so a re-queued card gets a fresh key. */
  key: string
  card: Card
  prompt: string
  answer: string
  reversed: boolean
}

export interface SessionOptions {
  direction: Direction
  shuffle: boolean
}

export function makeItem(card: Card, reversed: boolean, key = card.id): StudyItem {
  return {
    key,
    card,
    reversed,
    prompt: reversed ? card.back : card.front,
    answer: reversed ? card.front : card.back,
  }
}

export function buildItems(cards: Card[], opts: SessionOptions, rng: Rng = Math.random): StudyItem[] {
  const list = opts.shuffle ? shuffle(cards, rng) : cards
  return list.map((c) =>
    makeItem(c, opts.direction === 'back-front' || (opts.direction === 'mixed' && rng() < 0.5)),
  )
}

/** Due cards (earliest first) followed by new cards up to the remaining daily limit. */
export function buildReviewQueue(
  cards: Card[],
  reviews: Map<string, ReviewState>,
  now: number,
  newRemaining: number,
): Card[] {
  const due = cards
    .filter((c) => isDue(reviews.get(c.id), now))
    .sort((a, b) => reviews.get(a.id)!.due - reviews.get(b.id)!.due)
  const fresh = cards
    .filter((c) => (reviews.get(c.id)?.srsState ?? 'new') === 'new')
    .slice(0, Math.max(0, newRemaining))
  return [...due, ...fresh]
}

/**
 * Flashcards always updates the schedule (except "Practice all").
 * Every other mode only updates cards that are currently due, so practicing ahead
 * does not inflate intervals.
 */
export function shouldUpdateSchedule(
  mode: string,
  review: ReviewState | undefined,
  now: number,
  practiceAhead: boolean,
): boolean {
  if (mode === 'flashcards') return !practiceAhead
  return isDue(review, now)
}
