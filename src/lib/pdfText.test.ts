import { describe, expect, it } from 'vitest'
import { looksScanned, needsOcr, ocrToItems, pagesToText, pageToText, titleFromFileName, wordCount } from './pdfText'

describe('pageToText', () => {
  it('joins items and breaks lines where pdf.js marks an end of line', () => {
    const items = [{ str: 'The cell' }, { str: ' ' }, { str: 'membrane', hasEOL: true }, { str: 'controls entry.' }]
    expect(pageToText(items)).toBe('The cell membrane\ncontrols entry.')
  })

  it('squeezes spaces, trims lines and keeps at most one blank line', () => {
    const items = [
      { str: '  Title  ', hasEOL: true },
      { str: '', hasEOL: true },
      { str: '', hasEOL: true },
      { str: '', hasEOL: true },
      { str: 'a   b \tc' },
    ]
    expect(pageToText(items)).toBe('Title\n\na b c')
  })

  it('expands ligatures and drops soft hyphens', () => {
    expect(pageToText([{ str: 'ﬁrst ﬂoor, e­nough' }])).toBe('first floor, enough')
  })
})

describe('pagesToText', () => {
  it('separates pages with one blank line and skips empty pages', () => {
    expect(pagesToText([[{ str: 'Page one' }], [], [{ str: ' ' }], [{ str: 'Page two' }]])).toBe('Page one\n\nPage two')
  })

  it('returns an empty string for a document with no text', () => {
    expect(pagesToText([[], []])).toBe('')
  })
})

describe('looksScanned', () => {
  it('flags documents with almost no text per page', () => {
    expect(looksScanned('', 3)).toBe(true)
    expect(looksScanned('1\n\n2\n\n3', 3)).toBe(true)
    expect(looksScanned('Photosynthesis makes glucose.', 1)).toBe(false)
  })
})

describe('wordCount and titleFromFileName', () => {
  it('counts words across lines', () => {
    expect(wordCount('one two\nthree\n\n four ')).toBe(4)
    expect(wordCount('')).toBe(0)
  })

  it('drops the .pdf or image extension', () => {
    expect(titleFromFileName('Lecture 3 - Cells.PDF')).toBe('Lecture 3 - Cells')
    expect(titleFromFileName('notes page 2.jpeg')).toBe('notes page 2')
    expect(titleFromFileName('.pdf')).toBe('Untitled')
  })
})

describe('OCR', () => {
  it('scans pages with almost no text layer', () => {
    expect(needsOcr([])).toBe(true)
    expect(needsOcr([{ str: '12', hasEOL: true }])).toBe(true)
    expect(needsOcr([{ str: 'Photosynthesis turns light into sugar.' }])).toBe(false)
  })

  it('turns OCR lines into items and rejoins words split at a line end', () => {
    const items = ocrToItems('The mito-\nchondria makes\n\nATP. Self-\nTest')
    expect(pageToText(items)).toBe('The mitochondria makes\n\nATP. Self-\nTest')
  })
})
