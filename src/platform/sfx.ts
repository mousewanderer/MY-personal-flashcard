import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Sound effects are synthesized with Web Audio (no audio files), and the phone buzzes through Haptics.

export type Sound = 'tap' | 'flip' | 'right' | 'wrong' | 'streak' | 'hit' | 'hurt' | 'levelup' | 'achievement' | 'complete'

interface Prefs {
  sound: boolean
  /** 0 to 1. */
  volume: number
  haptics: boolean
}

let prefs: Prefs = { sound: true, volume: 0.6, haptics: true }
let ctx: AudioContext | null = null

export function setFeedbackPrefs(next: Prefs): void {
  prefs = next
}

function audio(): AudioContext | null {
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return null
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Browsers allow sound only after the user has tapped or typed, so the audio starts on the first one. */
export function initSfx(): void {
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(c: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType = 'sine', peak = 0.3, endFreq?: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** A burst of filtered noise whose pitch sweeps from `from` to `to` Hz: whooshes and impacts. */
function noise(c: AudioContext, out: AudioNode, at: number, dur: number, from: number, to: number, peak: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(from, at)
  filter.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(g).connect(out)
  src.start(at)
}

const arpeggio = (c: AudioContext, out: AudioNode, t: number, notes: number[], step: number, dur: number, type: OscillatorType, peak: number) =>
  notes.forEach((f, i) => tone(c, out, f, t + i * step, dur, type, peak))

const RECIPES: Record<Sound, (c: AudioContext, out: AudioNode, t: number) => void> = {
  tap: (c, out, t) => tone(c, out, 880, t, 0.05, 'sine', 0.12),
  flip: (c, out, t) => noise(c, out, t, 0.14, 500, 2600, 0.35),
  right: (c, out, t) => {
    tone(c, out, 659, t, 0.1, 'triangle', 0.25)
    tone(c, out, 988, t + 0.07, 0.18, 'triangle', 0.25)
  },
  wrong: (c, out, t) => {
    tone(c, out, 220, t, 0.24, 'triangle', 0.3, 140)
    tone(c, out, 165, t, 0.2, 'square', 0.05, 110)
  },
  streak: (c, out, t) => arpeggio(c, out, t, [523, 659, 784, 1047], 0.06, 0.14, 'triangle', 0.22),
  hit: (c, out, t) => {
    noise(c, out, t, 0.16, 2400, 300, 0.4)
    tone(c, out, 130, t, 0.2, 'sine', 0.45, 60)
  },
  hurt: (c, out, t) => tone(c, out, 320, t, 0.26, 'sawtooth', 0.1, 120),
  levelup: (c, out, t) => {
    arpeggio(c, out, t, [523, 659, 784], 0.09, 0.16, 'triangle', 0.22)
    for (const f of [784, 1047, 1319]) tone(c, out, f, t + 0.3, 0.55, 'triangle', 0.14)
  },
  achievement: (c, out, t) => {
    arpeggio(c, out, t, [1319, 1568, 2093, 2637], 0.05, 0.12, 'sine', 0.16)
    tone(c, out, 2093, t + 0.22, 0.45, 'sine', 0.08)
  },
  complete: (c, out, t) => {
    tone(c, out, 523, t, 0.14, 'triangle', 0.2)
    tone(c, out, 784, t + 0.1, 0.14, 'triangle', 0.2)
    tone(c, out, 1047, t + 0.2, 0.32, 'triangle', 0.22)
  },
}

export function play(sound: Sound): void {
  if (!prefs.sound || prefs.volume <= 0) return
  const c = audio()
  if (!c) return
  const out = c.createGain()
  out.gain.value = prefs.volume
  out.connect(c.destination)
  RECIPES[sound](c, out, c.currentTime + 0.01)
}

/** A light tap for a right answer, an error buzz for a wrong one, a thud for a hit. Android only. */
export function buzz(kind: 'right' | 'wrong' | 'hit'): void {
  if (!prefs.haptics || !Capacitor.isNativePlatform()) return
  const done = () => {}
  if (kind === 'wrong') void Haptics.notification({ type: NotificationType.Error }).catch(done)
  else void Haptics.impact({ style: kind === 'hit' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(done)
}

/** Sound and buzz for an answer. */
export function answerFeedback(correct: boolean, streak = 0): void {
  play(correct ? (streak > 0 && streak % 5 === 0 ? 'streak' : 'right') : 'wrong')
  buzz(correct ? 'right' : 'wrong')
}
