import { useSyncExternalStore } from 'react'
import { APP_NAME } from '../config'
import { db } from '../db/db'
import { getValue, setValue } from '../db/repo'
import * as Q from '../lib/queue'

/**
 * The music player: one <audio> element owned by this module, outside the React tree,
 * so changing pages or starting a study session never interrupts playback.
 */

export interface PlayerState {
  queue: Q.Queue
  /** The loaded track, or null when nothing is loaded. */
  currentId: string | null
  title: string
  playing: boolean
  volume: number
  repeat: Q.Repeat
  shuffle: boolean
  error: string | null
}

/** Kept apart from PlayerState: it changes several times a second. */
export interface PlayerTime {
  time: number
  duration: number
}

type Prefs = Pick<PlayerState, 'volume' | 'repeat' | 'shuffle'>
const PREFS_KEY = 'music'

let state: PlayerState = {
  queue: Q.EMPTY_QUEUE,
  currentId: null,
  title: '',
  playing: false,
  volume: 1,
  repeat: 'off',
  shuffle: false,
  error: null,
}
let clock: PlayerTime = { time: 0, duration: 0 }
const listeners = new Set<() => void>()
const clockListeners = new Set<() => void>()

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}
function setClock(patch: Partial<PlayerTime>) {
  clock = { ...clock, ...patch }
  for (const l of clockListeners) l()
}
const subscriber = (group: Set<() => void>) => (l: () => void) => {
  group.add(l)
  return () => {
    group.delete(l)
  }
}
const subscribe = subscriber(listeners)
const subscribeClock = subscriber(clockListeners)

export const usePlayer = (): PlayerState => useSyncExternalStore(subscribe, () => state)
/** The current state outside React (the focus timer uses it to start and stop music). */
export const playerState = (): PlayerState => state
export const usePlayerTime = (): PlayerTime => useSyncExternalStore(subscribeClock, () => clock)

// ---------- the audio element ----------

let audio: HTMLAudioElement | null = null
let url: string | null = null
let loadToken = 0

function el(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'auto'
  a.volume = state.volume
  a.addEventListener('play', () => set({ playing: true }))
  a.addEventListener('pause', () => set({ playing: false }))
  a.addEventListener('timeupdate', () => setClock({ time: a.currentTime }))
  a.addEventListener('durationchange', () => {
    if (Number.isFinite(a.duration)) setClock({ duration: a.duration })
  })
  a.addEventListener('ended', () => void goTo(Q.indexAfterEnded(state.queue, state.repeat), true))
  a.addEventListener('error', () => {
    if (url) set({ error: "This song can't be played on this device.", playing: false })
  })
  audio = a
  return a
}

const safePlay = (a: HTMLAudioElement) => a.play().catch(() => set({ playing: false }))

function unload() {
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  if (url) URL.revokeObjectURL(url)
  url = null
  setClock({ time: 0, duration: 0 })
}

/** Loads the queue entry at `index` (stopping when it is out of range) and optionally plays it. */
async function goTo(index: number, autoplay: boolean): Promise<void> {
  const token = ++loadToken
  const a = el()
  if (index < 0 || index >= state.queue.ids.length) {
    unload()
    set({ queue: { ...state.queue, index: -1 }, currentId: null, title: '', playing: false })
    return
  }
  const id = state.queue.ids[index]
  if (id === state.currentId) {
    a.currentTime = 0
    set({ queue: { ...state.queue, index } })
    if (autoplay) await safePlay(a)
    return
  }
  const track = await db.tracks.get(id)
  if (token !== loadToken) return
  if (!track) {
    set({ queue: Q.removeAt(state.queue, index) })
    return goTo(index, autoplay)
  }
  if (url) URL.revokeObjectURL(url)
  url = URL.createObjectURL(track.blob)
  a.src = url
  set({ queue: { ...state.queue, index }, currentId: id, title: track.title, error: null })
  setClock({ time: 0, duration: track.duration })
  showInMediaSession(track.title)
  if (autoplay) await safePlay(a)
}

// ---------- actions ----------

/** Replaces the queue with `ids` (shuffled when shuffle is on) and starts playing. */
export function playAll(ids: string[]): Promise<void> {
  const q = { ids: [...new Set(ids)], index: -1 }
  set({ queue: state.shuffle ? Q.shuffleUpcoming(q) : q })
  return goTo(0, true)
}

export function playNow(id: string): Promise<void> {
  set({ queue: Q.playNow(state.queue, id) })
  return goTo(state.queue.index, true)
}

export function addToQueue(ids: string[]): void {
  set({ queue: Q.enqueue(state.queue, ids) })
}

export function toggle(): void {
  if (!state.currentId) {
    if (state.queue.ids.length) void goTo(Math.max(0, state.queue.index), true)
    return
  }
  const a = el()
  if (a.paused) void safePlay(a)
  else a.pause()
}

export const next = (): Promise<void> => goTo(Q.nextIndex(state.queue, state.repeat), true)

export const prev = (): Promise<void> => goTo(Q.prevIndex(state.queue, audio?.currentTime ?? 0), true)

export function seek(seconds: number): void {
  if (!audio || !state.currentId) return
  audio.currentTime = seconds
  setClock({ time: seconds })
}

export function setVolume(volume: number): void {
  el().volume = volume
  set({ volume })
  savePrefs()
}

export function cycleRepeat(): void {
  const order: Q.Repeat[] = ['off', 'all', 'one']
  set({ repeat: order[(order.indexOf(state.repeat) + 1) % order.length] })
  savePrefs()
}

export function toggleShuffle(): void {
  const shuffle = !state.shuffle
  set({ shuffle, queue: shuffle ? Q.shuffleUpcoming(state.queue) : state.queue })
  savePrefs()
}

export function removeFromQueue(pos: number): void {
  const wasCurrent = pos === state.queue.index
  set({ queue: Q.removeAt(state.queue, pos) })
  if (wasCurrent) {
    const playing = state.playing
    set({ currentId: null })
    void goTo(state.queue.index, playing)
  }
}

export function moveInQueue(pos: number, delta: -1 | 1): void {
  set({ queue: Q.move(state.queue, pos, delta) })
}

export function clearQueue(): void {
  loadToken++
  unload()
  set({ queue: Q.EMPTY_QUEUE, currentId: null, title: '', playing: false, error: null })
}

/** Call before deleting a track from the library. */
export function forgetTrack(id: string): void {
  const pos = state.queue.ids.indexOf(id)
  if (pos !== -1) removeFromQueue(pos)
}

export function trackRenamed(id: string, title: string): void {
  if (id !== state.currentId) return
  set({ title })
  showInMediaSession(title)
}

// ---------- preferences and the browser's media controls ----------

function savePrefs() {
  const prefs: Prefs = { volume: state.volume, repeat: state.repeat, shuffle: state.shuffle }
  void setValue(PREFS_KEY, prefs)
}

function showInMediaSession(title: string) {
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title, artist: APP_NAME })
}

export async function initMusic(): Promise<void> {
  const prefs = await getValue<Partial<Prefs>>(PREFS_KEY)
  if (prefs) {
    set({ volume: prefs.volume ?? 1, repeat: prefs.repeat ?? 'off', shuffle: prefs.shuffle ?? false })
    if (audio) audio.volume = state.volume
  }
  if (!('mediaSession' in navigator)) return
  const handlers: [MediaSessionAction, () => void][] = [
    ['play', () => !state.playing && toggle()],
    ['pause', () => state.playing && toggle()],
    ['nexttrack', () => void next()],
    ['previoustrack', () => void prev()],
  ]
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // Action not supported by this browser.
    }
  }
}

/** Reads a file's length; null when this device can't decode it. */
export function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio()
    const src = URL.createObjectURL(blob)
    const done = (d: number | null) => {
      clearTimeout(timer)
      a.removeAttribute('src')
      URL.revokeObjectURL(src)
      resolve(d)
    }
    const timer = setTimeout(() => done(0), 8000)
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0)
    a.onerror = () => done(null)
    a.src = src
  })
}
