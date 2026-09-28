import { describe, expect, it } from 'vitest'
import { allTags, hasTag, parseTags, tagsText } from './tags'

describe('tags', () => {
  it('parses comma-separated input into clean tags', () => {
    expect(parseTags(' Spanish,  exam 1 ,,spanish, Verbs ')).toEqual(['Spanish', 'exam 1', 'Verbs'])
    expect(parseTags('')).toEqual([])
    expect(tagsText(['a', 'b'])).toBe('a, b')
  })
  it('lists every tag once, sorted', () => {
    expect(allTags([{ tags: ['verbs', 'Spanish'] }, { tags: ['spanish', 'Art'] }, {}])).toEqual(['Art', 'Spanish', 'verbs'])
  })
  it('filters by tag ignoring case', () => {
    expect(hasTag({ tags: ['Spanish'] }, 'spanish')).toBe(true)
    expect(hasTag({ tags: ['Spanish'] }, 'art')).toBe(false)
    expect(hasTag({}, null)).toBe(true)
  })
})
