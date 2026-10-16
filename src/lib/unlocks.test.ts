import { describe, expect, it } from 'vitest'
import { ACCENTS, activeAccent, activeBackdrop, isUnlocked, nextUnlock, UNLOCKABLES } from './unlocks'

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
  it('opens premium themes by rank and ignores a locked or unknown one', () => {
    expect(activeBackdrop('king', 26)).toBe('king')
    expect(activeBackdrop('king', 25)).toBeNull()
    expect(activeBackdrop('bronze', 6)).toBe('bronze')
    expect(activeBackdrop('nope', 99)).toBeNull()
    expect(activeBackdrop(undefined, 99)).toBeNull()
    expect(UNLOCKABLES.filter((u) => u.what === 'theme').map((u) => u.level)).toEqual([6, 11, 16, 26])
  })
})
