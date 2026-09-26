import { shuffle, type Rng } from './random'

export type Repeat = 'off' | 'all' | 'one'

/** Track ids in play order; `index` is the current track, -1 when nothing is loaded. */
export interface Queue {
  ids: string[]
  index: number
}

export const EMPTY_QUEUE: Queue = { ids: [], index: -1 }

/** Manual "next": wraps to the start unless repeat is off, then stops (-1). */
export function nextIndex(q: Queue, repeat: Repeat): number {
  if (q.index + 1 < q.ids.length) return q.index + 1
  return repeat === 'off' || q.ids.length === 0 ? -1 : 0
}

/** When a track finishes on its own: repeat-one plays it again. */
export const indexAfterEnded = (q: Queue, repeat: Repeat): number => (repeat === 'one' ? q.index : nextIndex(q, repeat))

/** "Previous" restarts the current track once it has played for more than 3 seconds. */
export const prevIndex = (q: Queue, seconds: number): number => (seconds > 3 || q.index <= 0 ? q.index : q.index - 1)

/** Appends tracks that aren't queued yet. */
export function enqueue(q: Queue, ids: string[]): Queue {
  const have = new Set(q.ids)
  const add = ids.filter((id) => !have.has(id) && have.add(id))
  return { ids: [...q.ids, ...add], index: q.index }
}

/** Jumps to a queued track, or inserts it right after the current one and jumps there. */
export function playNow(q: Queue, id: string): Queue {
  const at = q.ids.indexOf(id)
  if (at !== -1) return { ids: q.ids, index: at }
  const pos = q.index + 1
  return { ids: [...q.ids.slice(0, pos), id, ...q.ids.slice(pos)], index: pos }
}

/** Removes the track at `pos`. If it was the current one, the next track takes its place (-1 at the end). */
export function removeAt(q: Queue, pos: number): Queue {
  if (pos < 0 || pos >= q.ids.length) return q
  const ids = q.ids.filter((_, i) => i !== pos)
  let index = q.index
  if (pos < q.index) index--
  else if (pos === q.index && index >= ids.length) index = -1
  return { ids, index }
}

export const removeId = (q: Queue, id: string): Queue => removeAt(q, q.ids.indexOf(id))

/** Moves the track at `pos` up (-1) or down (1), keeping the current track current. */
export function move(q: Queue, pos: number, delta: -1 | 1): Queue {
  const to = pos + delta
  if (pos < 0 || to < 0 || to >= q.ids.length) return q
  const ids = [...q.ids]
  ;[ids[pos], ids[to]] = [ids[to], ids[pos]]
  const index = q.index === pos ? to : q.index === to ? pos : q.index
  return { ids, index }
}

/** Shuffles only the tracks after the current one, so what's playing keeps playing. */
export function shuffleUpcoming(q: Queue, rng?: Rng): Queue {
  const done = q.ids.slice(0, q.index + 1)
  return { ids: [...done, ...shuffle(q.ids.slice(q.index + 1), rng)], index: q.index }
}

/** A song title from its file name: no extension, underscores as spaces. */
export const songTitle = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return mb < 1024 ? `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB` : `${(mb / 1024).toFixed(1)} GB`
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
