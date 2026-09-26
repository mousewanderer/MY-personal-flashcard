import type { CardInput } from '../types'

export const SEPARATORS = ['\t', ',', ';', ' - ', ' : '] as const
export type Separator = (typeof SEPARATORS)[number]

export const SEPARATOR_LABELS: Record<Separator, string> = {
  '\t': 'Tab',
  ',': 'Comma',
  ';': 'Semicolon',
  ' - ': 'Dash ( - )',
  ' : ': 'Colon ( : )',
}

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim())

/** The separator found on the most non-empty lines; ties go to the earlier entry in SEPARATORS. */
export function detectSeparator(text: string): Separator {
  const nonEmpty = lines(text).filter(Boolean)
  let best: Separator = '\t'
  let bestCount = 0
  for (const sep of SEPARATORS) {
    const count = nonEmpty.filter((l) => l.includes(sep)).length
    if (count > bestCount) {
      best = sep
      bestCount = count
    }
  }
  return best
}

export interface BulkResult {
  separator: Separator
  cards: CardInput[]
  /** 1-based line numbers that had text but no front/back pair. */
  skipped: number[]
}

/**
 * One card per line. Tab-separated lines may carry up to 3 wrong options after the back;
 * other separators split on the first occurrence only.
 */
export function parseBulk(text: string, separator?: Separator): BulkResult {
  const sep = separator ?? detectSeparator(text)
  const cards: CardInput[] = []
  const skipped: number[] = []
  lines(text).forEach((line, i) => {
    if (!line) return
    let parts: string[]
    if (sep === '\t') {
      parts = line.split('\t')
    } else {
      const at = line.indexOf(sep)
      parts = at < 0 ? [line] : [line.slice(0, at), line.slice(at + sep.length)]
    }
    const [front = '', back = '', ...rest] = parts.map((p) => p.trim())
    if (!front || !back) skipped.push(i + 1)
    else cards.push({ front, back, options: rest.slice(0, 3).filter(Boolean) })
  })
  return { separator: sep, cards, skipped }
}
