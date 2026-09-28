import type { ReviewState } from '../types'
import { shuffle, type Rng } from './random'
import { isDue, startOfDay } from './scheduler'

// Daily challenge: 10 questions a day from all sets. Done, score and streak come from the review log.

export const DAILY_MODE = 'daily'
export const DAILY_SIZE = 10
export const DAILY_MIN_CARDS = 4

type LogLike = { timestamp: number; mode: string; correct: boolean }

/** A small seeded random source (mulberry32), so a day always gets the same picks. */
export function seededRng(seed: string): Rng {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const dailySeed = (now: number) => `daily:${new Date(startOfDay(now)).toDateString()}`

/**
 * Today's cards: cards due today come first, the rest follow, both in the day's own random order.
 * A card rescheduled earlier today still counts as due, so the picks stay the same all day.
 * With fewer cards than `size`, the list repeats so a challenge always has `size` questions.
 */
export function pickDaily<T extends { id: string }>(
  cards: T[],
  reviews: Map<string, ReviewState>,
  now: number,
  size = DAILY_SIZE,
): T[] {
  const today = startOfDay(now)
  const dueToday = (c: T) => {
    const r = reviews.get(c.id)
    return isDue(r, now) || (!!r && r.srsState !== 'new' && (r.lastReviewedAt ?? 0) >= today)
  }
  const order = shuffle([...cards].sort((a, b) => a.id.localeCompare(b.id)), seededRng(dailySeed(now)))
  const ranked = [...order.filter(dueToday), ...order.filter((c) => !dueToday(c))]
  return Array.from({ length: ranked.length ? size : 0 }, (_, i) => ranked[i % ranked.length])
}

export interface DailyStatus {
  /** Daily answers given today (the first DAILY_SIZE count). */
  answeredToday: number
  doneToday: boolean
  /** Right answers among today's first DAILY_SIZE. */
  scoreToday: number
  /** Days in a row with a finished challenge, up to today (or yesterday while today is open). */
  streak: number
  /** Days finished with every answer right. */
  perfectDays: number
}

export function dailyStatus(logs: LogLike[], now: number): DailyStatus {
  const byDay = new Map<number, LogLike[]>()
  for (const l of logs) {
    if (l.mode !== DAILY_MODE) continue
    const d = startOfDay(l.timestamp)
    const list = byDay.get(d)
    if (list) list.push(l)
    else byDay.set(d, [l])
  }
  const firstTen = (d: number) =>
    (byDay.get(d) ?? []).sort((a, b) => a.timestamp - b.timestamp).slice(0, DAILY_SIZE)
  const done = (d: number) => firstTen(d).length >= DAILY_SIZE

  const today = startOfDay(now)
  const todays = firstTen(today)
  let streak = 0
  let d = done(today) ? today : startOfDay(today - 1)
  while (done(d)) {
    streak++
    d = startOfDay(d - 1)
  }
  const perfectDays = [...byDay.keys()].filter((k) => done(k) && firstTen(k).every((l) => l.correct)).length
  return {
    answeredToday: todays.length,
    doneToday: todays.length >= DAILY_SIZE,
    scoreToday: todays.filter((l) => l.correct).length,
    streak,
    perfectDays,
  }
}
