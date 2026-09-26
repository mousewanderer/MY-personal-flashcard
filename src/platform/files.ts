/** Save a text file. Web: browser download. (Android share sheet comes with Capacitor.) */
export async function exportTextFile(fileName: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
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
