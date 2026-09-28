import { describe, expect, it } from 'vitest'
import { clampMinutes, clock, DEFAULT_FOCUS, idleFocus, nextPhase, pauseFocus, remaining, startFocus } from './focus'

const S = DEFAULT_FOCUS

describe('focus timer', () => {
  it('counts down from the end time and keeps the rest when paused', () => {
    let st = startFocus(idleFocus(S), 1000)
    expect(remaining(st, 1000 + 60_000)).toBe(24 * 60_000)
    st = pauseFocus(st, 1000 + 60_000)
    expect(remaining(st, 999_999_999)).toBe(24 * 60_000)
    st = startFocus(st, 5_000_000)
    expect(st.endsAt).toBe(5_000_000 + 24 * 60_000)
  })
  it('never goes below zero', () => {
    expect(remaining(startFocus(idleFocus(S), 0), 99 * 60_000)).toBe(0)
  })
  it('alternates focus and break and counts finished focus rounds', () => {
    const brk = nextPhase(startFocus(idleFocus(S), 0), S, 100)
    expect(brk).toMatchObject({ phase: 'break', running: true, endsAt: 100 + 5 * 60_000, rounds: 1 })
    expect(nextPhase(brk, S, 200)).toMatchObject({ phase: 'focus', rounds: 1 })
  })
  it('formats the clock and clamps minutes', () => {
    expect(clock(25 * 60_000)).toBe('25:00')
    expect(clock(61_001)).toBe('1:02')
    expect(clock(0)).toBe('0:00')
    expect([clampMinutes(0), clampMinutes(500), clampMinutes(Number.NaN), clampMinutes(24.6)]).toEqual([1, 180, 1, 25])
  })
})
