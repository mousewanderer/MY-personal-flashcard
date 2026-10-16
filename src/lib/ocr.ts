// Text recognition for scanned PDF pages and photos, on the device with Tesseract.

export const OCR_LANGS = [
  { code: 'eng', name: 'English' },
  { code: 'fil', name: 'Filipino' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'kor', name: 'Korean' },
]

export interface OcrReader {
  read(image: HTMLCanvasElement | Blob): Promise<string>
  close(): Promise<void>
}

/**
 * Tesseract is large, so it loads only when something needs scanning. The worker and engine ship with the
 * app; the language data downloads on first use (needs internet once) and Tesseract caches it.
 */
export async function startOcr(lang: string): Promise<OcrReader> {
  const [{ createWorker }, worker, core] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
  ])
  // The worker runs from a blob URL, where relative paths don't resolve.
  const abs = (url: string) => new URL(url, window.location.href).href
  const w = await createWorker(lang, 1, { workerPath: abs(worker.default), corePath: abs(core.default) })
  return {
    async read(image) {
      const { data } = await w.recognize(image)
      return data.text
    },
    close: () => w.terminate().then(() => undefined),
  }
}
