import { describe, expect, it } from 'vitest'
import type { ReviewState } from '../types'
import { dailyStatus, pickDaily, seededRng } from './daily'
import { initialReview } from './scheduler'

const NOW = new Date(2026, 8, 28, 15).getTime()
const DAY = 86_400_000
const cards = Array.from({ length: 30 }, (_, i) => ({ id: `c${String(i).padStart(2, '0')}` }))
const log = (t: number, correct = true, mode = 'daily') => ({ timestamp: t, correct, mode })
const tenOn = (t: number, correct = true) => Array.from({ length: 10 }, (_, i) => log(t + i * 1000, correct))

describe('seededRng', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = seededRng('x')
    const b = seededRng('x')
    const c = seededRng('y')
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    expect([c(), c(), c()]).not.toEqual(first)
    first.forEach((v) => expect(v).toBeGreaterThanOrEqual(0))
  })
})

describe('pickDaily', () => {
  it('picks 10 cards, the same all day, different the next day', () => {
    const today = pickDaily(cards, new Map(), NOW)
    expect(today).toHaveLength(10)
    expect(pickDaily([...cards].reverse(), new Map(), NOW + 3600_000)).toEqual(today)
    expect(pickDaily(cards, new Map(), NOW + DAY)).not.toEqual(today)
  })
  it('repeats a small collection to fill the challenge', () => {
    const few = pickDaily(cards.slice(0, 4), new Map(), NOW)
    expect(few).toHaveLength(10)
    expect(new Set(few.map((c) => c.id)).size).toBe(4)
    expect(pickDaily([], new Map(), NOW)).toEqual([])
  })
  it('puts due cards first, and keeps them first after they are reviewed today', () => {
    const due: ReviewState = { ...initialReview('c29'), srsState: 'review', due: NOW - DAY, intervalDays: 3 }
    expect(pickDaily(cards, new Map([['c29', due]]), NOW)[0].id).toBe('c29')
    const reviewed: ReviewState = { ...due, due: NOW + 5 * DAY, lastReviewedAt: NOW - 1000 }
    expect(pickDaily(cards, new Map([['c29', reviewed]]), NOW)[0].id).toBe('c29')
  })
})

describe('dailyStatus', () => {
  it('scores the first 10 answers of today', () => {
    const logs = [...tenOn(NOW - 60_000), log(NOW, false), log(NOW - 100, true, 'writing')]
    logs[3].correct = false
    expect(dailyStatus(logs, NOW)).toMatchObject({ answeredToday: 10, doneToday: true, scoreToday: 9 })
  })
  it('counts the streak up to today, or up to yesterday while today is open', () => {
    const logs = [...tenOn(NOW - 2 * DAY), ...tenOn(NOW - DAY), log(NOW)]
    expect(dailyStatus(logs, NOW)).toMatchObject({ streak: 2, doneToday: false, answeredToday: 1 })
    expect(dailyStatus([...logs, ...tenOn(NOW + 1000)], NOW + 20_000).streak).toBe(3)
    expect(dailyStatus(tenOn(NOW - 3 * DAY), NOW).streak).toBe(0)
  })
  it('counts perfect days', () => {
    expect(dailyStatus([...tenOn(NOW - DAY), ...tenOn(NOW - 2 * DAY, false)], NOW).perfectDays).toBe(1)
  })
})
