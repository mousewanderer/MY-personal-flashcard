import { describe, expect, it } from 'vitest'
import type { ReviewState } from '../types'
import {
  bestCorrectRun,
  buildProfile,
  dayCounts,
  last7Days,
  levelFromXp,
  rankTitle,
  streaks,
  totalXp,
  xpToNext,
} from './profile'
import { initialReview, startOfDay } from './scheduler'

const NOW = new Date(2026, 8, 26, 12, 0, 0).getTime()
/** Noon, `n` local days before 2026-09-26. */
const daysAgo = (n: number, hour = 12) => new Date(2026, 8, 26 - n, hour).getTime()
const log = (timestamp: number, correct = true, mode = 'flashcards') => ({ timestamp, correct, mode })

describe('xp and levels', () => {
  it('gives 10 XP for a correct answer and 2 for a wrong one', () => {
    expect(totalXp([log(NOW), log(NOW, false), log(NOW)])).toBe(22)
  })

  it('needs 100 XP for level 2, then 50 more for each level', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(2)).toBe(150)
    expect(levelFromXp(0)).toMatchObject({ level: 1, into: 0, needed: 100 })
    expect(levelFromXp(99).level).toBe(1)
    expect(levelFromXp(100)).toMatchObject({ level: 2, into: 0, needed: 150 })
    expect(levelFromXp(249).level).toBe(2)
    expect(levelFromXp(250)).toMatchObject({ level: 3, into: 0 })
  })

  it('changes rank every 5 levels and stops at the last one', () => {
    expect(rankTitle(1)).toBe('Novice')
    expect(rankTitle(5)).toBe('Novice')
    expect(rankTitle(6)).toBe('Apprentice')
    expect(rankTitle(99)).toBe('Grandmaster')
  })
})

describe('streaks', () => {
  it('counts days in a row up to today', () => {
    const days = dayCounts([log(daysAgo(0)), log(daysAgo(1)), log(daysAgo(2)), log(daysAgo(4))])
    expect(streaks(days, NOW)).toEqual({ current: 3, best: 3, studiedToday: true })
  })

  it('keeps the streak alive until today ends', () => {
    const days = dayCounts([log(daysAgo(1)), log(daysAgo(2))])
    expect(streaks(days, NOW)).toMatchObject({ current: 2, studiedToday: false })
  })

  it('breaks after a missed day but remembers the best', () => {
    const days = dayCounts([log(daysAgo(2)), log(daysAgo(5)), log(daysAgo(6)), log(daysAgo(7))])
    expect(streaks(days, NOW)).toMatchObject({ current: 0, best: 3 })
  })

  it('uses local days: late night and early morning are different days', () => {
    const days = dayCounts([log(daysAgo(1, 23)), log(daysAgo(0, 0))])
    expect(streaks(days, NOW).current).toBe(2)
  })

  it('counts across a whole month, including any DST change', () => {
    const march = Array.from({ length: 31 }, (_, i) => log(new Date(2026, 2, i + 1, 12).getTime()))
    expect(streaks(dayCounts(march), new Date(2026, 2, 31, 20).getTime()).current).toBe(31)
  })
})

describe('last7Days', () => {
  it('returns 7 days oldest first, ending today, with zeros filled in', () => {
    const week = last7Days(dayCounts([log(daysAgo(0)), log(daysAgo(0)), log(daysAgo(6)), log(daysAgo(7))]), NOW)
    expect(week.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 2])
    expect(week[6].day).toBe(startOfDay(NOW))
  })
})

describe('bestCorrectRun', () => {
  it('finds the longest run of correct answers', () => {
    const c = (correct: boolean) => ({ correct })
    expect(bestCorrectRun([c(true), c(true), c(false), c(true), c(true), c(true), c(false)])).toBe(3)
    expect(bestCorrectRun([])).toBe(0)
  })
})

describe('buildProfile', () => {
  const mastered: ReviewState = { ...initialReview('m'), srsState: 'review', intervalDays: 30 }
  const modes = ['flashcards', 'choice', 'writing']

  it('starts with everything locked', () => {
    const p = buildProfile([], [], NOW, 20, modes)
    expect(p).toMatchObject({ xp: 0, today: 0, mastered: 0, level: { level: 1 } })
    expect(p.achievements.every((a) => !a.unlocked && a.progress === 0)).toBe(true)
  })

  it('unlocks achievements and reports progress toward the rest', () => {
    const logs = [
      ...Array.from({ length: 20 }, () => log(daysAgo(1))),
      log(daysAgo(0), false, 'choice'),
      log(daysAgo(0), true, 'writing'),
    ]
    const p = buildProfile(logs, [mastered, initialReview('n')], NOW, 20, modes)
    const byId = Object.fromEntries(p.achievements.map((a) => [a.id, a]))
    expect(p.xp).toBe(212)
    expect(p.today).toBe(2)
    expect(p.mastered).toBe(1)
    expect(byId['answers-1'].unlocked).toBe(true)
    expect(byId['answers-100']).toMatchObject({ unlocked: false, progress: 22 })
    expect(byId['modes']).toMatchObject({ unlocked: true, target: 3 })
    expect(byId['mastered-1'].unlocked).toBe(true)
    expect(byId['run-25'].progress).toBe(20)
    expect(byId['goal-7'].progress).toBe(1)
    expect(byId['streak-3'].progress).toBe(2)
  })

  it('caps progress at the target', () => {
    const logs = Array.from({ length: 30 }, () => log(NOW))
    const run = buildProfile(logs, [], NOW, 20, modes).achievements.find((a) => a.id === 'run-25')
    expect(run).toMatchObject({ progress: 25, unlocked: true })
  })
})
