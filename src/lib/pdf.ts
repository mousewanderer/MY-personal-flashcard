import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api'
import { startOcr, type OcrReader } from './ocr'
import { needsOcr, ocrToItems, pagesToText, type PdfTextItem } from './pdfText'

/** An error whose message can be shown to the user as is. */
export class PdfError extends Error {}

/** `scanning` is true while a page goes through text recognition. */
export type ReadProgress = (page: number, total: number, scanning: boolean) => void

// pdf.js is large, so it loads only when a PDF is opened.
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

async function openOcr(lang: string): Promise<OcrReader> {
  try {
    return await startOcr(lang)
  } catch {
    throw new PdfError("Couldn't load the scanner for this language. It downloads once, so connect to the internet and try again.")
  }
}

/** Renders a page at twice its size (at most 2500 px across) for text recognition. */
async function renderPage(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2, 2500 / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport }).promise
  return canvas
}

/** The PDF's text layer; pages without one (scans) are read with OCR in `ocrLang`. */
export async function extractPdfText(file: File, onProgress?: ReadProgress, ocrLang = 'eng'): Promise<{ text: string; pages: number }> {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  let ocr: OcrReader | null = null
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
      onProgress?.(i, doc.numPages, false)
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      let items: PdfTextItem[] = content.items.filter((it): it is TextItem => 'str' in it)
      if (needsOcr(items)) {
        onProgress?.(i, doc.numPages, true)
        ocr ??= await openOcr(ocrLang)
        items = ocrToItems(await ocr.read(await renderPage(page)))
      }
      pages.push(items)
      page.cleanup()
    }
    return { text: pagesToText(pages), pages: doc.numPages }
  } finally {
    void task.destroy()
    void ocr?.close()
  }
}

/** A photo or scan of one page, read with OCR. */
export async function extractImageText(file: File, ocrLang = 'eng'): Promise<{ text: string; pages: number }> {
  const ocr = await openOcr(ocrLang)
  try {
    return { text: pagesToText([ocrToItems(await ocr.read(file))]), pages: 1 }
  } catch {
    throw new PdfError("This image couldn't be read.")
  } finally {
    void ocr.close()
  }
}
