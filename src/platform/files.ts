import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Save a text file. Web: browser download.
 * Android: write it to the cache directory, then open the share sheet (Drive, Files, Messenger...).
 */
export async function exportTextFile(fileName: string, text: string, mime = 'text/csv'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({ title: fileName, files: [uri], dialogTitle: `Save or send ${fileName}` })
    } catch {
      // The user closed the share sheet.
    }
    return
  }
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Android pickers report CSV MIME types inconsistently, so accept broadly and validate by content. */
export const IMPORT_ACCEPT =
  '.csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values,text/comma-separated-values,application/csv,application/vnd.ms-excel,application/octet-stream'
