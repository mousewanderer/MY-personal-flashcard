import { describe, expect, it } from 'vitest'
import type { ReviewState } from '../types'
import { capForExam, daysUntilExam, examLabel } from './exam'
import { DAY, initialReview } from './scheduler'

const NOW = new Date(2026, 8, 28, 15).getTime() // 28 Sep 2026, 3 pm
const review = (days: number): ReviewState => ({
  ...initialReview('c'),
  srsState: 'review',
  intervalDays: days,
  due: NOW + days * DAY,
})

describe('exam date', () => {
  it('counts whole days to the exam', () => {
    expect(daysUntilExam('2026-09-28', NOW)).toBe(0)
    expect(daysUntilExam('2026-10-08', NOW)).toBe(10)
    expect(daysUntilExam('2026-09-20', NOW)).toBe(-8)
  })
  it('caps intervals to half the days left before the exam', () => {
    const capped = capForExam(review(30), '2026-10-08', NOW)
    expect(capped.intervalDays).toBe(5)
    expect(capped.due).toBe(NOW + 5 * DAY)
    expect(capForExam(review(3), '2026-10-08', NOW).intervalDays).toBe(3)
    expect(capForExam(review(9), '2026-09-29', NOW).intervalDays).toBe(1)
  })
  it('leaves learning steps, exam day and past exams alone', () => {
    const learning = { ...review(0), srsState: 'learning' as const }
    expect(capForExam(learning, '2026-10-08', NOW)).toBe(learning)
    expect(capForExam(review(30), '2026-09-28', NOW).intervalDays).toBe(30)
    expect(capForExam(review(30), '2026-09-01', NOW).intervalDays).toBe(30)
    expect(capForExam(review(30), undefined, NOW).intervalDays).toBe(30)
  })
  it('labels the countdown', () => {
    expect(examLabel('2026-09-28', NOW)).toBe('Exam today')
    expect(examLabel('2026-09-29', NOW)).toBe('Exam tomorrow')
    expect(examLabel('2026-10-03', NOW)).toBe('Exam in 5 days')
    expect(examLabel('2026-09-01', NOW)).toBeNull()
  })
})
