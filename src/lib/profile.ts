import type { ReviewLog, ReviewState } from '../types'
import { isMastered, startOfDay } from './scheduler'

type LogLike = Pick<ReviewLog, 'timestamp' | 'correct' | 'mode'>

export const XP_CORRECT = 10
export const XP_WRONG = 2

export const xpFor = (correct: boolean): number => (correct ? XP_CORRECT : XP_WRONG)

export const totalXp = (logs: Pick<ReviewLog, 'correct'>[]): number =>
  logs.reduce((sum, l) => sum + xpFor(l.correct), 0)

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number): number => 100 + 50 * (level - 1)

export const RANKS = ['Novice', 'Apprentice', 'Scholar', 'Expert', 'Master', 'Grandmaster']

/** A new rank every 5 levels. */
export const rankTitle = (level: number): string => RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 5))]

export interface LevelInfo {
  level: number
  /** XP earned inside the current level. */
  into: number
  /** XP the current level takes in total. */
  needed: number
  title: string
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1
  let rest = Math.max(0, xp)
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return { level, into: rest, needed: xpToNext(level), title: rankTitle(level) }
}

// ---------- days ----------

/** Start of the previous local day; stepping through midnight keeps DST days right. */
const prevDay = (dayStart: number) => startOfDay(dayStart - 1)

/** Answers per local day, keyed by the day's start time. */
export function dayCounts(logs: Pick<ReviewLog, 'timestamp'>[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const l of logs) {
    const d = startOfDay(l.timestamp)
    m.set(d, (m.get(d) ?? 0) + 1)
  }
  return m
}

export interface Streaks {
  /** Days in a row up to today, or up to yesterday while today has no answers yet. */
  current: number
  best: number
  studiedToday: boolean
}

export function streaks(days: Map<number, number>, now: number): Streaks {
  const today = startOfDay(now)
  const studiedToday = days.has(today)
  let current = 0
  for (let d = studiedToday ? today : prevDay(today); days.has(d); d = prevDay(d)) current++

  let best = 0
  let run = 0
  let last: number | null = null
  for (const d of [...days.keys()].sort((a, b) => a - b)) {
    run = last !== null && prevDay(d) === last ? run + 1 : 1
    best = Math.max(best, run)
    last = d
  }
  return { current, best, studiedToday }
}

export interface DayCount {
  day: number
  count: number
}

/** The last 7 local days, oldest first, ending today. */
export function last7Days(days: Map<number, number>, now: number): DayCount[] {
  const out: DayCount[] = []
  let d = startOfDay(now)
  for (let i = 0; i < 7; i++, d = prevDay(d)) out.unshift({ day: d, count: days.get(d) ?? 0 })
  return out
}

/** Longest run of correct answers, with `logs` in the order they were answered. */
export function bestCorrectRun(logs: Pick<ReviewLog, 'correct'>[]): number {
  let best = 0
  let run = 0
  for (const l of logs) {
    run = l.correct ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// ---------- achievements ----------

export type AchievementKind = 'answers' | 'streak' | 'mastered' | 'modes' | 'run' | 'goal'

export interface Achievement {
  id: string
  name: string
  description: string
  kind: AchievementKind
  target: number
  progress: number
  unlocked: boolean
}

type Def = Omit<Achievement, 'progress' | 'unlocked'>

function defs(modeCount: number): Def[] {
  return [
    { id: 'answers-1', name: 'First Step', description: 'Answer your first card', kind: 'answers', target: 1 },
    { id: 'answers-100', name: 'Warming Up', description: 'Answer 100 cards', kind: 'answers', target: 100 },
    { id: 'answers-1000', name: 'Dedicated', description: 'Answer 1,000 cards', kind: 'answers', target: 1000 },
    { id: 'answers-5000', name: 'Relentless', description: 'Answer 5,000 cards', kind: 'answers', target: 5000 },
    { id: 'streak-3', name: 'On a Roll', description: 'Study 3 days in a row', kind: 'streak', target: 3 },
    { id: 'streak-7', name: 'Full Week', description: 'Study 7 days in a row', kind: 'streak', target: 7 },
    { id: 'streak-30', name: 'Unbreakable', description: 'Study 30 days in a row', kind: 'streak', target: 30 },
    { id: 'mastered-1', name: 'It Stuck', description: 'Master a card', kind: 'mastered', target: 1 },
    { id: 'mastered-50', name: 'Memory Vault', description: 'Master 50 cards', kind: 'mastered', target: 50 },
    { id: 'modes', name: 'Explorer', description: 'Try every study mode and game', kind: 'modes', target: modeCount },
    { id: 'run-25', name: 'Sharpshooter', description: 'Get 25 answers right in a row', kind: 'run', target: 25 },
    { id: 'goal-7', name: 'Goal Getter', description: 'Meet your daily goal on 7 days', kind: 'goal', target: 7 },
  ]
}

export interface Profile {
  xp: number
  level: LevelInfo
  today: number
  streak: Streaks
  mastered: number
  week: DayCount[]
  achievements: Achievement[]
}

/**
 * Everything on the Profile page, derived from the review log.
 * `reviews` must already exclude deleted cards; `modeIds` lists every mode that counts for Explorer.
 */
export function buildProfile(
  logs: LogLike[],
  reviews: ReviewState[],
  now: number,
  dailyGoal: number,
  modeIds: string[],
): Profile {
  const days = dayCounts(logs)
  const streak = streaks(days, now)
  const mastered = reviews.filter(isMastered).length
  const used = new Set(logs.map((l) => l.mode))
  const values: Record<AchievementKind, number> = {
    answers: logs.length,
    streak: streak.best,
    mastered,
    modes: modeIds.filter((id) => used.has(id)).length,
    run: bestCorrectRun(logs),
    goal: [...days.values()].filter((n) => n >= Math.max(1, dailyGoal)).length,
  }
  const xp = totalXp(logs)
  return {
    xp,
    level: levelFromXp(xp),
    today: days.get(startOfDay(now)) ?? 0,
    streak,
    mastered,
    week: last7Days(days, now),
    achievements: defs(modeIds.length).map((d) => {
      const v = values[d.kind]
      return { ...d, progress: Math.min(v, d.target), unlocked: v >= d.target }
    }),
  }
}
