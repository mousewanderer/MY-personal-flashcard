import { describe, expect, it } from 'vitest'
import { ACCENTS, activeAccent, isUnlocked, nextUnlock } from './unlocks'

describe('unlocks', () => {
  it('opens colours by level', () => {
    expect(ACCENTS.filter((a) => isUnlocked(a, 1)).map((a) => a.id)).toEqual(['ocean'])
    expect(ACCENTS.filter((a) => isUnlocked(a, 5)).map((a) => a.id)).toEqual(['ocean', 'forest', 'sunset'])
    expect(ACCENTS.every((a) => isUnlocked(a, 16))).toBe(true)
  })
  it('falls back to the default for a locked or unknown colour', () => {
    expect(activeAccent('grape', 8)).toBe('grape')
    expect(activeAccent('grape', 7)).toBe('ocean')
    expect(activeAccent('neon', 20)).toBe('ocean')
    expect(activeAccent(undefined, 20)).toBe('ocean')
  })
  it('names the next unlock', () => {
    expect(nextUnlock(1)?.id).toBe('forest')
    expect(nextUnlock(5)?.id).toBe('grape')
    expect(nextUnlock(16)).toBeNull()
  })
})
