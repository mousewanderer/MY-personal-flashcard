import { useEffect, useRef, useState } from 'react'

type KeyMap = Record<string, (e: KeyboardEvent) => void | boolean>

/**
 * Window-level shortcuts keyed by `KeyboardEvent.key` (' ', '1', 'Enter', 'Escape', ...).
 * Ignored while typing in a field (except Escape) and while a dialog is open.
 * A handler that returns `false` leaves the key to the browser (e.g. Enter on a focused button).
 * The `'*'` entry catches any single-character key not listed explicitly.
 */
export function useHotkeys(map: KeyMap, enabled = true): void {
  const ref = useRef(map)
  useEffect(() => {
    ref.current = map
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (document.querySelector('dialog[open]')) return
      const target = e.target instanceof Element ? e.target : null
      if (e.key !== 'Escape' && target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const single = [...e.key].length === 1
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()] ?? (single ? ref.current['*'] : undefined)
      if (fn && fn(e) !== false) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/** Milliseconds since `start`, refreshed a few times per second while running. */
export function useElapsed(start: number, running = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])
  return Math.max(0, now - start)
}
