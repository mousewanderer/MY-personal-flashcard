import { useSyncExternalStore } from 'react'

// Hash routing works the same on GitHub Pages (any base path) and inside Capacitor.
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
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
