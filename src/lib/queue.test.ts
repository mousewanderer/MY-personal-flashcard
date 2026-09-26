import { describe, expect, it } from 'vitest'
import {
  enqueue,
  formatTime,
  indexAfterEnded,
  move,
  nextIndex,
  playNow,
  prevIndex,
  removeAt,
  shuffleUpcoming,
  songTitle,
  formatSize,
  type Queue,
} from './queue'

const q = (index: number, ids = ['a', 'b', 'c']): Queue => ({ ids, index })

describe('next and previous', () => {
  it('moves forward, then stops or wraps at the end depending on repeat', () => {
    expect(nextIndex(q(0), 'off')).toBe(1)
    expect(nextIndex(q(2), 'off')).toBe(-1)
    expect(nextIndex(q(2), 'all')).toBe(0)
    expect(nextIndex(q(2), 'one')).toBe(0)
    expect(nextIndex(q(-1, []), 'all')).toBe(-1)
  })

  it('replays the same track after it ends on repeat-one', () => {
    expect(indexAfterEnded(q(1), 'one')).toBe(1)
    expect(indexAfterEnded(q(1), 'off')).toBe(2)
    expect(indexAfterEnded(q(2), 'off')).toBe(-1)
  })

  it('restarts the track after 3 seconds, otherwise goes back one', () => {
    expect(prevIndex(q(2), 10)).toBe(2)
    expect(prevIndex(q(2), 1)).toBe(1)
    expect(prevIndex(q(0), 1)).toBe(0)
  })
})

describe('editing the queue', () => {
  it('appends only tracks that are not queued yet', () => {
    expect(enqueue(q(0, ['a']), ['b', 'a', 'c', 'b'])).toEqual({ ids: ['a', 'b', 'c'], index: 0 })
  })

  it('plays a queued track by jumping to it, or inserts it after the current one', () => {
    expect(playNow(q(0), 'c')).toEqual({ ids: ['a', 'b', 'c'], index: 2 })
    expect(playNow(q(0), 'x')).toEqual({ ids: ['a', 'x', 'b', 'c'], index: 1 })
    expect(playNow(q(-1, []), 'x')).toEqual({ ids: ['x'], index: 0 })
  })

  it('keeps the current track current when removing others', () => {
    expect(removeAt(q(2), 0)).toEqual({ ids: ['b', 'c'], index: 1 })
    expect(removeAt(q(0), 2)).toEqual({ ids: ['a', 'b'], index: 0 })
  })

  it('lets the next track take the place of a removed current one', () => {
    expect(removeAt(q(1), 1)).toEqual({ ids: ['a', 'c'], index: 1 })
    expect(removeAt(q(2), 2)).toEqual({ ids: ['a', 'b'], index: -1 })
    expect(removeAt(q(0), 5)).toEqual(q(0))
  })

  it('moves tracks and follows the current one', () => {
    expect(move(q(0), 0, 1)).toEqual({ ids: ['b', 'a', 'c'], index: 1 })
    expect(move(q(1), 0, 1)).toEqual({ ids: ['b', 'a', 'c'], index: 0 })
    expect(move(q(0), 2, 1)).toEqual(q(0))
  })

  it('shuffles only the upcoming tracks', () => {
    const reverse = () => 0 // Fisher-Yates with j = 0 every step
    const out = shuffleUpcoming(q(1, ['a', 'b', 'c', 'd', 'e']), reverse)
    expect(out.ids.slice(0, 2)).toEqual(['a', 'b'])
    expect([...out.ids.slice(2)].sort()).toEqual(['c', 'd', 'e'])
    expect(out.ids.slice(2)).not.toEqual(['c', 'd', 'e'])
    expect(out.index).toBe(1)
  })
})

describe('songTitle and formatSize', () => {
  it('makes a title from the file name', () => {
    expect(songTitle('01_Lo-fi_Study  Beats.mp3')).toBe('01 Lo-fi Study Beats')
    expect(songTitle('.mp3')).toBe('Untitled')
  })

  it('shows sizes in KB, MB or GB', () => {
    expect(formatSize(300)).toBe('1 KB')
    expect(formatSize(4.25 * 1024 * 1024)).toBe('4.3 MB')
    expect(formatSize(48 * 1024 * 1024)).toBe('48 MB')
    expect(formatSize(3 * 1024 ** 3)).toBe('3.0 GB')
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65.9)).toBe('1:05')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(Number.NaN)).toBe('0:00')
  })
})
