/** m:ss */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** CSS class for card text that scales down for long answers. */
export function textSizeClass(text: string): string {
  if (text.length > 220) return 'txt-s'
  if (text.length > 90) return 'txt-m'
  return 'txt-l'
}
