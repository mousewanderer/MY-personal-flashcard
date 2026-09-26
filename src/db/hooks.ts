import { useLiveQuery } from 'dexie-react-hooks'
import type { Settings } from '../types'
import { db } from './db'
import { DEFAULT_SETTINGS } from './repo'

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.kv.get('settings'), [])
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) }
}
