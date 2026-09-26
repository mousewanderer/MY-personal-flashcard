import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { pagesToText, type PdfTextItem } from './pdfText'

/** An error whose message can be shown to the user as is. */
export class PdfError extends Error {}

// pdf.js is large, so it loads only when a PDF is opened.
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ text: string; pages: number }> {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  try {
    let doc
    try {
      doc = await task.promise
    } catch (e) {
      if ((e as Error)?.name === 'PasswordException') {
        throw new PdfError('This PDF is password-protected. Remove the password and try again.')
      }
      throw new PdfError("This file couldn't be read as a PDF.")
    }
    const pages: PdfTextItem[][] = []
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(i, doc.numPages)
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.filter((it): it is TextItem => 'str' in it))
      page.cleanup()
    }
    return { text: pagesToText(pages), pages: doc.numPages }
  } finally {
    void task.destroy()
  }
}
