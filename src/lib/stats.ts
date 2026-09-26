import type { Card, ReviewState } from '../types'
import { DAY, isDue, isMastered } from './scheduler'

export interface SetStats {
  total: number
  newCount: number
  learning: number
  mastered: number
  dueToday: number
  dueTomorrow: number
}

export function computeStats(cards: Card[], reviews: Map<string, ReviewState>, now: number): SetStats {
  const s: SetStats = { total: cards.length, newCount: 0, learning: 0, mastered: 0, dueToday: 0, dueTomorrow: 0 }
  for (const c of cards) {
    const r = reviews.get(c.id)
    if (!r || r.srsState === 'new') s.newCount++
    else if (r.srsState !== 'review') s.learning++
    if (isMastered(r)) s.mastered++
    if (isDue(r, now)) s.dueToday++
    else if (isDue(r, now + DAY)) s.dueTomorrow++
  }
  return s
}

export const masteredPercent = (s: SetStats) => (s.total ? Math.round((s.mastered / s.total) * 100) : 0)
