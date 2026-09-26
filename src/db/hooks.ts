import { useLiveQuery } from 'dexie-react-hooks'
import { totalXp } from '../lib/profile'
import type { ProfileSettings, Settings } from '../types'
import { db } from './db'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './repo'

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.kv.get('settings'), [])
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) }
}

export function useProfileSettings(): ProfileSettings {
  const row = useLiveQuery(() => db.kv.get('profile'), [])
  return { ...DEFAULT_PROFILE, ...(row?.value as Partial<ProfileSettings> | undefined) }
}

/** Total XP, and the XP earned since `since` (a session's start). Undefined while loading. */
export function useXp(since: number): { total: number; earned: number } | undefined {
  return useLiveQuery(async () => {
    const [all, recent] = await Promise.all([
      db.logs.toArray(),
      db.logs.where('timestamp').aboveOrEqual(since).toArray(),
    ])
    return { total: totalXp(all), earned: totalXp(recent) }
  }, [since])
}
