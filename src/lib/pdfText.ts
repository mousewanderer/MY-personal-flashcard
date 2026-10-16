/** The parts of a pdf.js text item this module reads. */
export interface PdfTextItem {
  str: string
  hasEOL?: boolean
}

const LIGATURES: Record<string, string> = { ﬀ: 'ff', ﬁ: 'fi', ﬂ: 'fl', ﬃ: 'ffi', ﬄ: 'ffl', ﬅ: 'st', ﬆ: 'st' }

function tidy(text: string): string {
  return text
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/­/g, '') // soft hyphens
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** One page's text items as plain text; pdf.js marks line ends with `hasEOL`. */
export function pageToText(items: PdfTextItem[]): string {
  return tidy(items.map((it) => (it.hasEOL ? `${it.str}\n` : it.str)).join(''))
}

/** Whole document as plain text, pages separated by a blank line and no page markers. */
export function pagesToText(pages: PdfTextItem[][]): string {
  return pages.map(pageToText).filter(Boolean).join('\n\n')
}

export const wordCount = (text: string): number => text.match(/\S+/g)?.length ?? 0

/** Scanned PDFs have no text layer; at most a page number or two per page comes through. */
export const looksScanned = (text: string, pages: number): boolean =>
  text.replace(/\s/g, '').length < Math.max(1, pages) * 5

/** A page with almost no text layer (a scan, or just a page number) goes through OCR. */
export const needsOcr = (items: PdfTextItem[]): boolean => pageToText(items).replace(/\s/g, '').length < 20

/** OCR text as text items, one per line, with words split across a line end ("exam-" "ple") joined. */
export function ocrToItems(text: string): PdfTextItem[] {
  return text
    .replace(/(\p{L})-\r?\n(\p{Ll})/gu, '$1$2')
    .split(/\r?\n/)
    .map((str) => ({ str, hasEOL: true }))
}

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.(pdf|png|jpe?g|webp)$/i, '').trim() || 'Untitled'
}

export const txtFileName = (title: string): string => `${title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'document'}.txt`
