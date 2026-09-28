type Tagged = { tags?: string[] }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Comma-separated input to clean tags: trimmed, no empties, no repeats (ignoring case). */
export function parseTags(input: string): string[] {
  const out: string[] = []
  for (const raw of input.split(',')) {
    const t = raw.trim().replace(/\s+/g, ' ')
    if (t && !out.some((o) => same(o, t))) out.push(t)
  }
  return out
}

export const tagsText = (tags?: string[]) => (tags ?? []).join(', ')

/** Every tag used by these sets, once each, sorted. */
export function allTags(sets: Tagged[]): string[] {
  const out: string[] = []
  for (const s of sets) for (const t of s.tags ?? []) if (!out.some((o) => same(o, t))) out.push(t)
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** True when no tag is chosen or the set carries it. */
export const hasTag = (set: Tagged, tag: string | null | undefined) => !tag || (set.tags ?? []).some((t) => same(t, tag))
