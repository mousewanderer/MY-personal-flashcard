import { normalize } from './answer'
import { shuffle, type Rng } from './random'

// Memory: face-down tiles, one with the prompt and one with the answer for each card.

export interface MemoryTile {
  id: string
  /** The study item this tile came from. */
  key: string
  side: 'q' | 'a'
  text: string
  /** The item's answer, so cards with the same answer are interchangeable. */
  answer: string
}

export function dealMemory(
  batch: { key: string; prompt: string; answer: string }[],
  round: number,
  rng: Rng = Math.random,
): MemoryTile[] {
  const tiles = batch.flatMap((it): MemoryTile[] => [
    { id: `${round}:${it.key}:q`, key: it.key, side: 'q', text: it.prompt, answer: it.answer },
    { id: `${round}:${it.key}:a`, key: it.key, side: 'a', text: it.answer, answer: it.answer },
  ])
  return shuffle(tiles, rng)
}

export function isPair(a: MemoryTile, b: MemoryTile): boolean {
  if (a.side === b.side) return false
  return a.key === b.key || normalize(a.answer, false) === normalize(b.answer, false)
}
