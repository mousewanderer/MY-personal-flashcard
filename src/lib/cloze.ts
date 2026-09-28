// Fill-in-the-blank cards: words in the front wrapped in {{ }} are hidden while studying.

export const BLANK = '___'
const PATTERN = /\{\{([\s\S]+?)\}\}/g

export interface Cloze {
  /** The front with each blank replaced by ___. */
  prompt: string
  /** The hidden words, joined with ", " when there are several blanks. */
  answer: string
}

/** The blanks in a card front, or null when it has none (a normal card). */
export function parseCloze(front: string): Cloze | null {
  const parts: string[] = []
  const prompt = front.replace(PATTERN, (whole, inner: string) => {
    const t = inner.trim()
    if (!t) return whole
    parts.push(t)
    return BLANK
  })
  return parts.length ? { prompt, answer: parts.join(', ') } : null
}

/** A blank card's back is its hidden words; a normal card keeps the back it was given. */
export function clozeBack(front: string, back: string): string {
  return parseCloze(front)?.answer ?? back
}

/** Wraps the selected text in {{ }}, leaving surrounding spaces outside. Returns the new text and cursor. */
export function wrapBlank(text: string, start: number, end: number): { text: string; cursor: number } {
  let s = Math.min(start, end)
  let e = Math.max(start, end)
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  if (s === e) return { text, cursor: end }
  const wrapped = `${text.slice(0, s)}{{${text.slice(s, e)}}}${text.slice(e)}`
  return { text: wrapped, cursor: e + 4 }
}
