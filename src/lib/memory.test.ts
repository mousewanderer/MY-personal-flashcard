import { describe, expect, it } from 'vitest'
import { dealMemory, isPair } from './memory'

describe('memory', () => {
  const batch = [
    { key: 'a', prompt: 'cat', answer: 'gato' },
    { key: 'b', prompt: 'kitty', answer: 'Gato' },
    { key: 'c', prompt: 'dog', answer: 'perro' },
  ]
  const tiles = dealMemory(batch, 0, () => 0.5)
  const tile = (key: string, side: 'q' | 'a') => tiles.find((t) => t.key === key && t.side === side)!

  it('deals a prompt tile and an answer tile per card', () => {
    expect(tiles).toHaveLength(6)
    expect(tile('c', 'a').text).toBe('perro')
  })
  it('pairs a prompt with its answer, or with any card that has the same answer', () => {
    expect(isPair(tile('a', 'q'), tile('a', 'a'))).toBe(true)
    expect(isPair(tile('a', 'q'), tile('b', 'a'))).toBe(true)
    expect(isPair(tile('a', 'q'), tile('c', 'a'))).toBe(false)
    expect(isPair(tile('a', 'q'), tile('b', 'q'))).toBe(false)
  })
})
