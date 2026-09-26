import type { Strictness } from '../types'

export type Verdict = 'correct' | 'almost' | 'wrong'

export interface CheckOptions {
  strictness: Strictness
  ignoreAccents: boolean
}

/** Lowercase, drop punctuation, collapse spaces; optionally strip accents. */
export function normalize(text: string, ignoreAccents: boolean): string {
  let t = text.normalize('NFC').toLowerCase()
  if (ignoreAccents) t = t.normalize('NFD').replace(/\p{M}/gu, '')
  return t.replace(/\p{P}/gu, '').replace(/\s+/g, ' ').trim()
}

/** The full answer plus each part split on "/" or ";". */
export function alternatives(answer: string): string[] {
  const parts = [answer, ...answer.split(/[/;]/)].map((p) => p.trim()).filter(Boolean)
  return [...new Set(parts)]
}

export function levenshtein(a: string, b: string): number {
  const x = Array.from(a)
  const y = Array.from(b)
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[y.length]
}

/** Allowed typos: strict 0, normal 1 per 6 chars, lenient 1 per 4 chars (min 1). */
export function tolerance(length: number, strictness: Strictness): number {
  if (strictness === 'strict') return 0
  return Math.max(1, Math.floor(length / (strictness === 'lenient' ? 4 : 6)))
}

export function checkAnswer(input: string, answer: string, opts: CheckOptions): Verdict {
  const given = normalize(input, opts.ignoreAccents)
  if (!given) return 'wrong'
  let almost = false
  for (const alt of alternatives(answer)) {
    const target = normalize(alt, opts.ignoreAccents)
    if (!target) continue
    if (target === given) return 'correct'
    if (levenshtein(target, given) <= tolerance(Array.from(target).length, opts.strictness)) almost = true
  }
  return almost ? 'almost' : 'wrong'
}
