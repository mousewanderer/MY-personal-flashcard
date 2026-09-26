import { describe, expect, it } from 'vitest'
import type { ReviewState } from '../types'
import {
  DAY,
  MIN_EASE,
  MINUTE,
  fuzz,
  initialReview,
  isDue,
  isMastered,
  previewIntervals,
  formatInterval,
  schedule,
} from './scheduler'

const NOW = new Date(2026, 8, 26, 12, 0, 0).getTime()
const noFuzz = () => 0.5
const review = (patch: Partial<ReviewState> = {}): ReviewState => ({
  ...initialReview('c1'),
  srsState: 'review',
  intervalDays: 10,
  due: NOW,
  reps: 5,
  ...patch,
})

describe('new cards', () => {
  const n = initialReview('c1')
  it('again goes to the 1-minute step', () => {
    const s = schedule(n, 'again', NOW, noFuzz)
    expect(s).toMatchObject({ srsState: 'learning', learningStep: 0, due: NOW + MINUTE, reps: 1, lastReviewedAt: NOW })
  })
  it('hard repeats the first step', () => {
    expect(schedule(n, 'hard', NOW, noFuzz)).toMatchObject({ srsState: 'learning', learningStep: 0, due: NOW + MINUTE })
  })
  it('good moves to the 10-minute step', () => {
    expect(schedule(n, 'good', NOW, noFuzz)).toMatchObject({ srsState: 'learning', learningStep: 1, due: NOW + 10 * MINUTE })
  })
  it('easy graduates to 4 days', () => {
    expect(schedule(n, 'easy', NOW, noFuzz)).toMatchObject({ srsState: 'review', intervalDays: 4, due: NOW + 4 * DAY })
  })
})

describe('learning cards', () => {
  const last = { ...initialReview('c1'), srsState: 'learning' as const, learningStep: 1, due: NOW }
  it('good on the last step graduates to 1 day', () => {
    expect(schedule(last, 'good', NOW, noFuzz)).toMatchObject({ srsState: 'review', intervalDays: 1, due: NOW + DAY })
  })
  it('again returns to the first step', () => {
    expect(schedule(last, 'again', NOW, noFuzz)).toMatchObject({ srsState: 'learning', learningStep: 0, due: NOW + MINUTE })
  })
  it('hard repeats the current step', () => {
    expect(schedule(last, 'hard', NOW, noFuzz)).toMatchObject({ learningStep: 1, due: NOW + 10 * MINUTE })
  })
  it('easy graduates to 4 days', () => {
    expect(schedule(last, 'easy', NOW, noFuzz)).toMatchObject({ srsState: 'review', intervalDays: 4 })
  })
})

describe('review cards', () => {
  it('again is a lapse: ease -0.20, relearn at 10 minutes, interval halved', () => {
    const s = schedule(review({ intervalDays: 10, lapses: 1 }), 'again', NOW, noFuzz)
    expect(s).toMatchObject({ srsState: 'relearning', lapses: 2, intervalDays: 5, learningStep: 0, due: NOW + 10 * MINUTE })
    expect(s.ease).toBeCloseTo(2.3)
  })
  it('lapse interval is at least 1 day', () => {
    expect(schedule(review({ intervalDays: 1 }), 'again', NOW, noFuzz).intervalDays).toBe(1)
  })
  it('hard: interval x1.2, ease -0.15', () => {
    const s = schedule(review({ intervalDays: 10 }), 'hard', NOW, noFuzz)
    expect(s.intervalDays).toBe(12)
    expect(s.ease).toBeCloseTo(2.35)
  })
  it('good: interval x ease, ease unchanged', () => {
    const s = schedule(review({ intervalDays: 10 }), 'good', NOW, noFuzz)
    expect(s).toMatchObject({ srsState: 'review', intervalDays: 25, due: NOW + 25 * DAY })
    expect(s.ease).toBeCloseTo(2.5)
  })
  it('easy: interval x ease x1.3, ease +0.15', () => {
    const s = schedule(review({ intervalDays: 10 }), 'easy', NOW, noFuzz)
    expect(s.intervalDays).toBe(33) // 10 * 2.5 * 1.3 = 32.5
    expect(s.ease).toBeCloseTo(2.65)
  })
  it('good and easy always add at least 1 day', () => {
    const low = review({ intervalDays: 1, ease: MIN_EASE })
    expect(schedule(low, 'good', NOW, noFuzz).intervalDays).toBe(2)
    expect(schedule(low, 'easy', NOW, noFuzz).intervalDays).toBe(2)
    expect(schedule(low, 'good', NOW, () => 0).intervalDays).toBeGreaterThanOrEqual(2)
  })
  it('ease never drops below 1.3', () => {
    let s = review({ ease: 1.4 })
    for (let i = 0; i < 5; i++) s = schedule({ ...s, srsState: 'review' }, 'again', NOW, noFuzz)
    expect(s.ease).toBe(MIN_EASE)
    expect(schedule(review({ ease: 1.35 }), 'hard', NOW, noFuzz).ease).toBe(MIN_EASE)
  })
})

describe('relearning cards', () => {
  const r = review({ srsState: 'relearning', intervalDays: 5, learningStep: 0 })
  it('good returns to review with the halved interval', () => {
    expect(schedule(r, 'good', NOW, noFuzz)).toMatchObject({ srsState: 'review', intervalDays: 5, due: NOW + 5 * DAY })
  })
  it('easy also returns to review', () => {
    expect(schedule(r, 'easy', NOW, noFuzz)).toMatchObject({ srsState: 'review', intervalDays: 5 })
  })
  it('again and hard stay on the 10-minute step', () => {
    expect(schedule(r, 'again', NOW, noFuzz)).toMatchObject({ srsState: 'relearning', due: NOW + 10 * MINUTE })
    expect(schedule(r, 'hard', NOW, noFuzz)).toMatchObject({ srsState: 'relearning', due: NOW + 10 * MINUTE })
  })
})

describe('fuzz', () => {
  it('leaves intervals of 3 days or less alone', () => {
    expect(fuzz(3, () => 0)).toBe(3)
    expect(fuzz(1, () => 1)).toBe(1)
  })
  it('stays within ±5%', () => {
    for (const days of [4, 20, 100, 365]) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const f = fuzz(days, () => r)
        expect(f).toBeGreaterThanOrEqual(Math.round(days * 0.95))
        expect(f).toBeLessThanOrEqual(Math.round(days * 1.05))
      }
    }
  })
  it('scheduled review intervals stay within bounds', () => {
    for (let i = 0; i < 200; i++) {
      const days = schedule(review({ intervalDays: 40 }), 'good', NOW).intervalDays
      expect(days).toBeGreaterThanOrEqual(95)
      expect(days).toBeLessThanOrEqual(105)
    }
  })
})

describe('helpers', () => {
  it('isDue ignores new cards and uses end of today', () => {
    expect(isDue(undefined, NOW)).toBe(false)
    expect(isDue(initialReview('c'), NOW)).toBe(false)
    expect(isDue(review({ due: NOW + 6 * 3600_000 }), NOW)).toBe(true)
    expect(isDue(review({ due: NOW + DAY }), NOW)).toBe(false)
  })
  it('mastered means review with interval >= 21 days', () => {
    expect(isMastered(review({ intervalDays: 21 }))).toBe(true)
    expect(isMastered(review({ intervalDays: 20 }))).toBe(false)
    expect(isMastered(review({ srsState: 'relearning', intervalDays: 30 }))).toBe(false)
  })
  it('previews button intervals', () => {
    const p = previewIntervals(initialReview('c'), NOW)
    expect([p.again, p.hard, p.good, p.easy].map(formatInterval)).toEqual(['1m', '1m', '10m', '4d'])
  })
})
