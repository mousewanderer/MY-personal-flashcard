import type { ReviewState } from '../types'
import { DAY, startOfDay } from './scheduler'

// Exam date: until the exam, a set's cards are never scheduled past it.

/** Local midnight at the start of a 'YYYY-MM-DD' date. */
export function examStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Whole days from today to the exam: 0 on the day, negative once it has passed. */
export const daysUntilExam = (date: string, now: number) => Math.round((examStart(date) - startOfDay(now)) / DAY)

/**
 * Caps a freshly scheduled review so the card comes up again before the exam:
 * at most half the days left (at least 1). Learning steps and past exams are left alone.
 */
export function capForExam(next: ReviewState, examDate: string | undefined, now: number): ReviewState {
  if (!examDate || next.srsState !== 'review') return next
  const left = daysUntilExam(examDate, now)
  if (left <= 0) return next
  const cap = Math.max(1, Math.floor(left / 2))
  if (next.intervalDays <= cap) return next
  return { ...next, intervalDays: cap, due: now + cap * DAY }
}

/** "Exam today", "Exam tomorrow", "Exam in 5 days", or null when there is none or it has passed. */
export function examLabel(examDate: string | undefined, now: number): string | null {
  if (!examDate) return null
  const left = daysUntilExam(examDate, now)
  if (left < 0) return null
  if (left === 0) return 'Exam today'
  if (left === 1) return 'Exam tomorrow'
  return `Exam in ${left} days`
}
