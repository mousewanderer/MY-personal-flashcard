import { describe, expect, it } from 'vitest'
import type { Card, ReviewState } from '../types'
import { initialReview } from './scheduler'
import { buildItems, buildReviewQueue, shouldUpdateSchedule } from './session'

const NOW = new Date(2026, 8, 26, 12).getTime()
const card = (id: string, i: number): Card => ({
  id, setId: 's', front: `f${i}`, back: `b${i}`, options: [], starred: false,
  position: i, createdAt: 0, updatedAt: 0, deleted: false,
})
const due = (id: string, at: number): ReviewState => ({ ...initialReview(id), srsState: 'review', intervalDays: 3, due: at })

describe('buildItems', () => {
  const cards = [card('a', 0), card('b', 1)]
  it('keeps order and swaps sides for back-front', () => {
    const items = buildItems(cards, { direction: 'back-front', shuffle: false })
    expect(items.map((i) => [i.prompt, i.answer])).toEqual([['b0', 'f0'], ['b1', 'f1']])
  })
})

describe('buildReviewQueue', () => {
  it('puts due cards first (earliest first), then new cards up to the limit', () => {
    const cards = ['a', 'b', 'c', 'd', 'e'].map(card)
    const reviews = new Map([
      ['a', due('a', NOW - 1000)],
      ['b', due('b', NOW - 5000)],
      ['c', due('c', NOW + 3 * 86_400_000)],
    ])
    expect(buildReviewQueue(cards, reviews, NOW, 1).map((c) => c.id)).toEqual(['b', 'a', 'd'])
    expect(buildReviewQueue(cards, reviews, NOW, 0).map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('shouldUpdateSchedule', () => {
  const dueCard = due('a', NOW - 1)
  const notDue = due('a', NOW + 5 * 86_400_000)
  it('flashcards always updates unless practicing ahead', () => {
    expect(shouldUpdateSchedule('flashcards', notDue, NOW, false)).toBe(true)
    expect(shouldUpdateSchedule('flashcards', undefined, NOW, false)).toBe(true)
    expect(shouldUpdateSchedule('flashcards', dueCard, NOW, true)).toBe(false)
  })
  it('other modes only update due cards', () => {
    expect(shouldUpdateSchedule('choice', dueCard, NOW, false)).toBe(true)
    expect(shouldUpdateSchedule('choice', notDue, NOW, false)).toBe(false)
    expect(shouldUpdateSchedule('writing', initialReview('a'), NOW, false)).toBe(false)
  })
})
