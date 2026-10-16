import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

// Hash routing works the same on GitHub Pages (any base path) and inside Capacitor.
// A screen change runs inside a view transition (a short fade, see global.css) where the browser has them.
const listeners = new Set<() => void>()
let animate = true

/** Off when the user asked for reduced motion. */
export function setRouteMotion(on: boolean): void {
  animate = on
}

window.addEventListener('hashchange', () => {
  const update = () => flushSync(() => listeners.forEach((cb) => cb()))
  if (animate && typeof document.startViewTransition === 'function') document.startViewTransition(update)
  else update()
})

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getHash = () => window.location.hash

export interface Route {
  parts: string[]
  query: URLSearchParams
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  const [path, qs = ''] = hash.replace(/^#/, '').split('?')
  return {
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(qs),
  }
}

export function navigate(to: string, replace = false): void {
  if (replace) window.location.replace(`#${to}`)
  else window.location.hash = to
}
