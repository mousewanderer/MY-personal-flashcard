import { describe, expect, it } from 'vitest'
import type { ReviewState } from '../types'
import { fromClassic, previewWith, scheduleFsrs, scheduleWith } from './fsrs'
import { DAY, initialReview, isMastered, MINUTE, schedule } from './scheduler'

const NOW = new Date(2026, 8, 28, 12).getTime()
const mid = () => 0.5

describe('fromClassic', () => {
  it('turns interval and ease into a starting memory', () => {
    expect(fromClassic({ intervalDays: 10, ease: 2.5 })).toEqual({ stability: 10, difficulty: 5 })
    expect(fromClassic({ intervalDays: 0, ease: 1.3 })).toEqual({ stability: 1, difficulty: 10 })
    expect(fromClassic({ intervalDays: 3, ease: 3.1 }).difficulty).toBe(2)
  })
})

describe('scheduleFsrs', () => {
  it('keeps the classic learning steps for a new card', () => {
    const fresh = initialReview('c')
    const again = scheduleFsrs(fresh, 'again', NOW, mid)
    expect(again.srsState).toBe('learning')
    expect(again.due - NOW).toBe(1 * MINUTE)
    const good = scheduleFsrs(fresh, 'good', NOW, mid)
    expect(good.srsState).toBe('learning')
    expect(good.due - NOW).toBe(10 * MINUTE)
    const easy = scheduleFsrs(fresh, 'easy', NOW, mid)
    expect(easy.srsState).toBe('review')
    expect(easy.intervalDays).toBeGreaterThanOrEqual(1)
    expect(easy.stability).toBeGreaterThan(0)
    expect(easy.difficulty).toBeGreaterThan(0)
  })
  it('orders review intervals Again < Hard < Good < Easy, and a lapse relearns', () => {
    const card: ReviewState = {
      ...initialReview('c'),
      srsState: 'review',
      intervalDays: 10,
      ease: 2.5,
      reps: 5,
      due: NOW,
      lastReviewedAt: NOW - 10 * DAY,
    }
    const p = previewWith('fsrs', card, NOW)
    expect(p.again).toBeLessThan(p.hard)
    expect(p.hard).toBeLessThan(p.good)
    expect(p.good).toBeLessThan(p.easy)
    const lapse = scheduleFsrs(card, 'again', NOW, mid)
    expect(lapse.srsState).toBe('relearning')
    expect(lapse.lapses).toBe(1)
  })
  it('reaches mastered after a few good reviews', () => {
    let s = scheduleFsrs(initialReview('c'), 'easy', NOW, mid)
    let t = NOW
    for (let i = 0; i < 6 && !isMastered(s); i++) {
      t = s.due
      s = scheduleFsrs(s, 'good', t, mid)
    }
    expect(isMastered(s)).toBe(true)
  })
})

describe('scheduleWith', () => {
  it('uses the classic scheduler unless FSRS is chosen', () => {
    const fresh = initialReview('c')
    expect(scheduleWith(undefined, fresh, 'good', NOW, mid)).toEqual(schedule(fresh, 'good', NOW, mid))
    expect(scheduleWith('classic', fresh, 'easy', NOW, mid)).toEqual(schedule(fresh, 'easy', NOW, mid))
    expect(scheduleWith('fsrs', fresh, 'easy', NOW, mid).stability).toBeGreaterThan(0)
  })
})
