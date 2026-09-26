import { describe, expect, it } from 'vitest'
import {
  answerWords,
  canHangman,
  canScramble,
  findTile,
  hintStep,
  initialOf,
  isSolved,
  isUnscrambled,
  keyboardFor,
  maskAnswer,
  nextPending,
  pickWheel,
  scrambleChars,
  scrambleTiles,
  takeCyclic,
  wrongCount,
} from './games'

describe('answerWords', () => {
  it('groups characters by word with raw and slot indexes', () => {
    expect(answerWords(' por  favor ')).toEqual([
      [0, 1, 2].map((i) => ({ raw: i, slot: i })),
      [5, 6, 7, 8, 9].map((raw, i) => ({ raw, slot: i + 3 })),
    ])
  })
})

describe('word scramble', () => {
  it('only uses answers of 2 to 24 letters with more than one distinct letter', () => {
    expect(canScramble('gato')).toBe(true)
    expect(canScramble('por favor')).toBe(true)
    expect(canScramble('a')).toBe(false)
    expect(canScramble('aa')).toBe(false)
    expect(canScramble('x'.repeat(12) + 'y'.repeat(13))).toBe(false)
  })
  it('shuffles the same letters into a different order', () => {
    for (let i = 0; i < 50; i++) {
      const tiles = scrambleTiles('por favor')
      expect([...tiles].sort()).toEqual(scrambleChars('por favor').sort())
      expect(tiles.join('')).not.toBe('porfavor')
    }
    expect(scrambleTiles('ab', () => 0.99)).toEqual(['b', 'a'])
  })
  it('finds tiles for typed keys, exact letters first', () => {
    const tiles = ['ñ', 'n', 'A']
    expect(findTile(tiles, [], 'n')).toBe(1)
    expect(findTile(tiles, [1], 'n')).toBe(0)
    expect(findTile(tiles, [], 'a')).toBe(2)
    expect(findTile(tiles, [0, 1], 'n')).toBe(-1)
  })
  it('hint keeps the correct prefix and adds the next letter', () => {
    const target = scrambleChars('gato')
    const tiles = ['t', 'o', 'g', 'a']
    expect(hintStep(tiles, [], target)).toEqual([2])
    expect(hintStep(tiles, [2, 0], target)).toEqual([2, 3]) // "gt" -> "ga"
    expect(isUnscrambled(tiles, [2, 3, 0, 1], target)).toBe(true)
    expect(isUnscrambled(tiles, [2, 3, 1, 0], target)).toBe(false)
  })
  it('treats repeated letters as interchangeable', () => {
    const target = scrambleChars('papa')
    const tiles = ['a', 'p', 'a', 'p']
    expect(isUnscrambled(tiles, [3, 2, 1, 0], target)).toBe(true)
  })
})

describe('hangman', () => {
  it('shows punctuation, spaces and digits from the start', () => {
    const mask = maskAnswer("it's 2 go", new Set())
    expect(mask.filter((m) => m.shown).map((m) => m.ch).join('')).toBe("' 2 ")
  })
  it('matches letters without accents', () => {
    const guessed = new Set(['n', 'a', 'o'])
    expect(maskAnswer('Año', guessed).every((m) => m.shown)).toBe(true)
    expect(isSolved('Año', guessed)).toBe(true)
  })
  it('counts wrong guesses', () => {
    expect(wrongCount('gato', new Set(['g', 'x', 'z']))).toBe(2)
    expect(isSolved('gato', new Set(['g', 'x']))).toBe(false)
  })
  it('adds keys for letters outside a to z', () => {
    expect(keyboardFor('straße')).toHaveLength(27)
    expect(keyboardFor('straße').at(-1)).toBe('ß')
    expect(keyboardFor('café')).toHaveLength(26)
  })
  it('needs at least one letter and at most 40 characters', () => {
    expect(canHangman('123')).toBe(false)
    expect(canHangman('a'.repeat(41))).toBe(false)
    expect(canHangman('hola')).toBe(true)
  })
})

describe('letter wheel', () => {
  it('takes the first letter or digit, uppercased', () => {
    expect(initialOf('  "ñandú"')).toBe('Ñ')
    expect(initialOf('3 cats')).toBe('3')
    expect(initialOf('...')).toBe('#')
  })
  it('prefers one card per letter, then fills, sorted by letter', () => {
    const words = ['bb', 'ab', 'ac', 'ca', 'ad']
    expect(pickWheel(words, (w) => w, 4)).toEqual(['ab', 'ac', 'bb', 'ca'])
    expect(pickWheel(words, (w) => w, 3)).toEqual(['ab', 'bb', 'ca'])
  })
  it('finds the next pending bubble, wrapping around', () => {
    expect(nextPending(['right', 'pending', 'wrong', 'pending'], 1)).toBe(3)
    expect(nextPending(['pending', 'right', 'wrong', 'pending'], 3)).toBe(0)
    expect(nextPending(['pending', 'right'], 0)).toBe(0)
    expect(nextPending(['right', 'wrong'], 0)).toBe(-1)
    expect(nextPending(['pending', 'right'], -1)).toBe(0)
  })
})

describe('time attack batches', () => {
  it('wraps around the list without repeats inside a batch', () => {
    expect(takeCyclic([1, 2, 3, 4, 5], 0, 4)).toEqual({ batch: [1, 2, 3, 4], cursor: 4 })
    expect(takeCyclic([1, 2, 3, 4, 5], 4, 4)).toEqual({ batch: [5, 1, 2, 3], cursor: 3 })
    expect(takeCyclic([1, 2], 1, 4)).toEqual({ batch: [2, 1], cursor: 1 })
  })
})
