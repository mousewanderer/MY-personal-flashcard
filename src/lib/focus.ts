// Focus timer (Pomodoro): focus and break phases that alternate.
// A running phase stores when it ends, so the time stays right while the app sleeps.

export type FocusPhase = 'focus' | 'break'

export interface FocusSettings {
  focusMin: number
  breakMin: number
  /** Play the music queue during focus and pause it during breaks. */
  music: boolean
}

export const DEFAULT_FOCUS: FocusSettings = { focusMin: 25, breakMin: 5, music: false }

export interface FocusState {
  phase: FocusPhase
  running: boolean
  /** When the running phase ends (ms since epoch). */
  endsAt: number
  /** Time left while paused (ms). */
  left: number
  /** Focus phases finished since the last reset. */
  rounds: number
}

const MIN = 60_000
const phaseMs = (phase: FocusPhase, s: FocusSettings) => (phase === 'focus' ? s.focusMin : s.breakMin) * MIN

export const idleFocus = (s: FocusSettings): FocusState => ({
  phase: 'focus',
  running: false,
  endsAt: 0,
  left: phaseMs('focus', s),
  rounds: 0,
})

export const remaining = (st: FocusState, now: number) => (st.running ? Math.max(0, st.endsAt - now) : st.left)

export const startFocus = (st: FocusState, now: number): FocusState => ({ ...st, running: true, endsAt: now + st.left })

export const pauseFocus = (st: FocusState, now: number): FocusState => ({ ...st, running: false, left: remaining(st, now) })

/** The next phase, started straight away. */
export function nextPhase(st: FocusState, s: FocusSettings, now: number): FocusState {
  const phase: FocusPhase = st.phase === 'focus' ? 'break' : 'focus'
  const len = phaseMs(phase, s)
  return { phase, running: true, endsAt: now + len, left: len, rounds: st.phase === 'focus' ? st.rounds + 1 : st.rounds }
}

/** Keeps minutes whole and within 1 to 180. */
export const clampMinutes = (n: number) => Math.min(180, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)))

/** m:ss, rounding up so 0:00 only shows at the very end. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
