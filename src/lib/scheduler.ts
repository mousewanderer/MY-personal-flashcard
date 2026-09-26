import type { Rating, ReviewState } from '../types'
import type { Rng } from './random'

export const MINUTE = 60_000
export const DAY = 86_400_000
export const LEARNING_STEPS = [1, 10] // minutes
export const RELEARNING_STEPS = [10] // minutes
export const START_EASE = 2.5
export const MIN_EASE = 1.3
export const MASTERED_DAYS = 21
export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy']

export function initialReview(cardId: string): ReviewState {
  return {
    cardId,
    srsState: 'new',
    due: 0,
    intervalDays: 0,
    ease: START_EASE,
    reps: 0,
    lapses: 0,
    learningStep: 0,
    lastReviewedAt: null,
  }
}

export const isMastered = (r: ReviewState | undefined): boolean =>
  !!r && r.srsState === 'review' && r.intervalDays >= MASTERED_DAYS

export function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** Non-new cards whose due time falls on or before the end of today. */
export const isDue = (r: ReviewState | undefined, now: number): boolean =>
  !!r && r.srsState !== 'new' && r.due <= endOfDay(now)

const round2 = (n: number) => Math.round(n * 100) / 100

/** ±5% random fuzz for intervals over 3 days. */
export function fuzz(days: number, rng: Rng): number {
  if (days <= 3) return days
  return Math.round(days * (1 + (rng() * 2 - 1) * 0.05))
}

function atStep(s: ReviewState, steps: number[], step: number, now: number): ReviewState {
  return { ...s, learningStep: step, due: now + steps[step] * MINUTE }
}

function toReview(s: ReviewState, days: number, now: number): ReviewState {
  return { ...s, srsState: 'review', learningStep: 0, intervalDays: days, due: now + days * DAY }
}

/** SM-2 style scheduler. Pure: pass `now` and `rng` in. */
export function schedule(prev: ReviewState, rating: Rating, now: number, rng: Rng = Math.random): ReviewState {
  const s: ReviewState = { ...prev, reps: prev.reps + 1, lastReviewedAt: now }

  if (prev.srsState === 'new' || prev.srsState === 'learning') {
    const step = prev.srsState === 'new' ? 0 : Math.min(prev.learningStep, LEARNING_STEPS.length - 1)
    const learning: ReviewState = { ...s, srsState: 'learning' }
    switch (rating) {
      case 'again':
        return atStep(learning, LEARNING_STEPS, 0, now)
      case 'hard':
        return atStep(learning, LEARNING_STEPS, step, now)
      case 'good':
        return step + 1 < LEARNING_STEPS.length
          ? atStep(learning, LEARNING_STEPS, step + 1, now)
          : toReview(s, 1, now)
      case 'easy':
        return toReview(s, fuzz(4, rng), now)
    }
  }

  if (prev.srsState === 'relearning') {
    const step = Math.min(prev.learningStep, RELEARNING_STEPS.length - 1)
    switch (rating) {
      case 'again':
        return atStep(s, RELEARNING_STEPS, 0, now)
      case 'hard':
        return atStep(s, RELEARNING_STEPS, step, now)
      case 'good':
        if (step + 1 < RELEARNING_STEPS.length) return atStep(s, RELEARNING_STEPS, step + 1, now)
        return toReview(s, prev.intervalDays, now)
      case 'easy':
        // intervalDays was already halved when the lapse happened.
        return toReview(s, prev.intervalDays, now)
    }
  }

  // review
  const ivl = prev.intervalDays
  if (rating === 'again') {
    return atStep(
      {
        ...s,
        srsState: 'relearning',
        lapses: prev.lapses + 1,
        ease: round2(Math.max(MIN_EASE, prev.ease - 0.2)),
        intervalDays: Math.max(1, Math.round(ivl * 0.5)),
      },
      RELEARNING_STEPS,
      0,
      now,
    )
  }
  let days: number
  let ease = prev.ease
  if (rating === 'hard') {
    days = Math.max(1, fuzz(Math.round(ivl * 1.2), rng))
    ease -= 0.15
  } else {
    const factor = rating === 'easy' ? prev.ease * 1.3 : prev.ease
    days = Math.max(ivl + 1, fuzz(Math.max(ivl + 1, Math.round(ivl * factor)), rng))
    if (rating === 'easy') ease += 0.15
  }
  return toReview({ ...s, ease: round2(Math.max(MIN_EASE, ease)) }, days, now)
}

/** Time until due for each rating, without fuzz, for button labels. */
export function previewIntervals(prev: ReviewState, now: number): Record<Rating, number> {
  const out = {} as Record<Rating, number>
  for (const r of RATINGS) out[r] = schedule(prev, r, now, () => 0.5).due - now
  return out
}

export function formatInterval(ms: number): string {
  const minutes = ms / MINUTE
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 3) / 10}mo`
  return `${Math.round(days / 36.5) / 10}y`
}
