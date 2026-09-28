// Cards from Docs: turn a selection in a doc's text into a card.
// PDF text has line breaks inside sentences, so a single line break is not a sentence boundary;
// a sentence ends at . ! or ? followed by a space, or at a blank line.

const MAX_SENTENCE = 280

export interface Span {
  start: number
  end: number
}

/** The sentence that contains [start, end), as offsets into `text`, without surrounding spaces. */
export function sentenceAround(text: string, start: number, end: number): Span {
  let s = start
  while (s > 0 && !/[.!?]\s/.test(text.slice(s - 2, s)) && !/\n\s*\n$/.test(text.slice(Math.max(0, s - 4), s))) s--
  let e = end
  while (e < text.length && !/[.!?]/.test(text[e - 1] ?? '') && !/^\n\s*\n/.test(text.slice(e, e + 4))) e++
  // Include the closing mark when the selection ends just before it.
  if (e < text.length && /[.!?]/.test(text[e]) && e === end) e++
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  return { start: s, end: e }
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A fill-in-the-blank front: the sentence around the selection, with the selection as the blank. */
export function blankFront(text: string, start: number, end: number): string | null {
  let a = Math.min(start, end)
  let b = Math.max(start, end)
  while (a < b && /\s/.test(text[a])) a++
  while (b > a && /\s/.test(text[b - 1])) b--
  if (a === b) return null
  const s = sentenceAround(text, a, b)
  let before = text.slice(s.start, a)
  let after = text.slice(b, s.end)
  // Keep very long sentences readable: trim the far ends at a word boundary.
  const room = Math.max(0, MAX_SENTENCE - (b - a))
  if (before.length + after.length > room) {
    const half = Math.floor(room / 2)
    if (before.length > half) before = '…' + before.slice(before.length - half).replace(/^\S*\s/, '')
    if (after.length > half) after = after.slice(0, half).replace(/\s\S*$/, '') + '…'
  }
  return oneLine(`${before}{{${oneLine(text.slice(a, b))}}}${after}`)
}

/** A term card's front: just the selection on one line. */
export const termFront = (text: string, start: number, end: number) => oneLine(text.slice(Math.min(start, end), Math.max(start, end)))
