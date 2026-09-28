import { createEmptyCard, fsrs, Rating as Grade, State, type Card as FsrsCard } from 'ts-fsrs'
import type { Rating, ReviewState, SrsState } from '../types'
import type { Rng } from './random'
import { DAY, fuzz, previewIntervals, RATINGS, schedule } from './scheduler'

// The optional FSRS scheduler (Settings -> Scheduler). It keeps the classic learning steps
// (1 and 10 minutes, relearning 10 minutes) and aims for 90% recall. ReviewState stays the
// stored shape; FSRS's memory (stability, difficulty) rides along in two optional fields.

export type SchedulerKind = 'classic' | 'fsrs'

const engine = fsrs({
  request_retention: 0.9,
  enable_fuzz: false, // the app's own fuzz is applied below, so it stays testable
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

const GRADE: Record<Rating, Grade.Again | Grade.Hard | Grade.Good | Grade.Easy> = {
  again: Grade.Again,
  hard: Grade.Hard,
  good: Grade.Good,
  easy: Grade.Easy,
}
const TO_FSRS: Record<SrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}
const FROM_FSRS: Record<State, SrsState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}

/** A starting memory for a card scheduled by the classic scheduler: stability from the interval, difficulty from the ease. */
export function fromClassic(s: Pick<ReviewState, 'intervalDays' | 'ease'>): { stability: number; difficulty: number } {
  const difficulty = Math.min(10, Math.max(1, 5 + (2.5 - s.ease) * 5))
  return { stability: Math.max(0.5, s.intervalDays || 1), difficulty: Math.round(difficulty * 100) / 100 }
}

function toFsrs(s: ReviewState, now: number): FsrsCard {
  if (s.srsState === 'new') return createEmptyCard(new Date(now))
  const memory = s.stability && s.difficulty ? { stability: s.stability, difficulty: s.difficulty } : fromClassic(s)
  return {
    ...memory,
    due: new Date(s.due),
    elapsed_days: s.lastReviewedAt ? Math.max(0, Math.floor((now - s.lastReviewedAt) / DAY)) : 0,
    scheduled_days: s.intervalDays,
    learning_steps: s.learningStep,
    reps: s.reps,
    lapses: s.lapses,
    state: TO_FSRS[s.srsState],
    last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
  }
}

/** FSRS version of `schedule`: same inputs, same stored shape. Pure: pass `now` and `rng` in. */
export function scheduleFsrs(prev: ReviewState, rating: Rating, now: number, rng: Rng = Math.random): ReviewState {
  const { card } = engine.next(toFsrs(prev, now), new Date(now), GRADE[rating])
  const srsState = FROM_FSRS[card.state]
  const base: ReviewState = {
    ...prev,
    srsState,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: prev.reps + 1,
    lapses: card.lapses,
    learningStep: card.learning_steps,
    lastReviewedAt: now,
    due: card.due.getTime(),
  }
  if (srsState !== 'review') return base
  const days = Math.max(1, fuzz(card.scheduled_days, rng))
  return { ...base, intervalDays: days, due: now + days * DAY }
}

/** Picks the scheduler chosen in Settings. */
export const scheduleWith = (kind: SchedulerKind | undefined, prev: ReviewState, rating: Rating, now: number, rng?: Rng) =>
  kind === 'fsrs' ? scheduleFsrs(prev, rating, now, rng) : schedule(prev, rating, now, rng)

/** Time until due for each rating, without fuzz, for the rating buttons. */
export function previewWith(kind: SchedulerKind | undefined, prev: ReviewState, now: number): Record<Rating, number> {
  if (kind !== 'fsrs') return previewIntervals(prev, now)
  const out = {} as Record<Rating, number>
  for (const r of RATINGS) out[r] = scheduleFsrs(prev, r, now, () => 0.5).due - now
  return out
}
