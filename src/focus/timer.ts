import { useSyncExternalStore } from 'react'
import { getValue, setValue } from '../db/repo'
import {
  clampMinutes,
  DEFAULT_FOCUS,
  idleFocus,
  nextPhase,
  pauseFocus,
  remaining,
  startFocus,
  type FocusSettings,
  type FocusState,
} from '../lib/focus'
import * as player from '../music/player'

// The focus timer lives outside React (like the music player), so it keeps running across screens.

const KEY = 'focus'

export interface FocusView {
  state: FocusState
  settings: FocusSettings
  /** Milliseconds left, refreshed about once a second. */
  left: number
}

let settings: FocusSettings = DEFAULT_FOCUS
let state: FocusState = idleFocus(settings)
let view: FocusView = { state, settings, left: state.left }
let ticker = 0
const listeners = new Set<() => void>()

function publish() {
  view = { state, settings, left: remaining(state, Date.now()) }
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useFocus = (): FocusView => useSyncExternalStore(subscribe, () => view)

/** Two short beeps and a buzz on phones. Sound needs an earlier tap on the page, which Start provides. */
function chime() {
  try {
    const ctx = new AudioContext()
    for (const at of [0, 0.25]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.2, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.2)
    }
    window.setTimeout(() => void ctx.close(), 1000)
  } catch {
    // No audio available; the vibration and the screen still show the change.
  }
  navigator.vibrate?.([200, 100, 200])
}

/** With the music option on, music plays during focus and pauses during breaks. */
function syncMusic() {
  if (!settings.music) return
  const p = player.playerState()
  const want = state.running && state.phase === 'focus'
  if (p.queue.ids.length && p.playing !== want) player.toggle()
}

function tick() {
  if (state.running && remaining(state, Date.now()) <= 0) {
    state = nextPhase(state, settings, Date.now())
    chime()
    syncMusic()
  }
  const left = remaining(state, Date.now())
  // Only re-render when the shown second changes.
  if (Math.ceil(left / 1000) !== Math.ceil(view.left / 1000) || view.state !== state) publish()
}

function setTicking(on: boolean) {
  window.clearInterval(ticker)
  if (on) ticker = window.setInterval(tick, 250)
}

export function start() {
  state = startFocus(state, Date.now())
  setTicking(true)
  syncMusic()
  publish()
}

export function pause() {
  state = pauseFocus(state, Date.now())
  setTicking(false)
  syncMusic()
  publish()
}

/** Ends the current phase now and starts the next one. */
export function skip() {
  state = nextPhase(state, settings, Date.now())
  setTicking(true)
  syncMusic()
  publish()
}

export function reset() {
  state = idleFocus(settings)
  setTicking(false)
  syncMusic()
  publish()
}

export function saveSettings(patch: Partial<FocusSettings>) {
  settings = { ...settings, ...patch }
  settings.focusMin = clampMinutes(settings.focusMin)
  settings.breakMin = clampMinutes(settings.breakMin)
  // A fresh, untouched timer shows the new length straight away.
  if (!state.running && state.rounds === 0 && state.phase === 'focus') state = idleFocus(settings)
  void setValue(KEY, settings)
  publish()
}

export async function initFocus() {
  const saved = await getValue<Partial<FocusSettings>>(KEY)
  if (saved) settings = { ...DEFAULT_FOCUS, ...saved }
  state = idleFocus(settings)
  publish()
}
