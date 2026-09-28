import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { APP_NAME } from '../config'

// Local notifications, Android only: the daily study reminder and the focus timer's phase end.
// On the web every call is a no-op (a page cannot notify reliably once it is closed).

const REMINDER_ID = 1
const FOCUS_ID = 2

export const canNotify = () => Capacitor.isNativePlatform()

/** Asks once for permission (Android 13+); true when notifications may be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!canNotify()) return false
  const now = await LocalNotifications.checkPermissions()
  if (now.display === 'granted') return true
  return (await LocalNotifications.requestPermissions()).display === 'granted'
}

/** Schedules the repeating daily reminder at 'HH:MM'. Resolves to false without permission. */
export async function setDailyReminder(time: string): Promise<boolean> {
  if (!(await ensurePermission())) return false
  const [hour, minute] = time.split(':').map(Number)
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: APP_NAME,
        body: 'Time to study: your daily challenge and due cards are waiting.',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  })
  return true
}

export async function clearDailyReminder(): Promise<void> {
  if (canNotify()) await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
}

/** A one-off notification when the focus timer's phase ends while the app is in the background. */
export async function setFocusAlarm(at: number, phase: 'focus' | 'break'): Promise<void> {
  if (!canNotify() || at <= Date.now()) return
  const granted = (await LocalNotifications.checkPermissions()).display === 'granted'
  if (!granted) return
  await LocalNotifications.schedule({
    notifications: [
      {
        id: FOCUS_ID,
        title: phase === 'focus' ? 'Focus session done' : 'Break is over',
        body: phase === 'focus' ? 'Time for a break.' : 'Back to focus.',
        schedule: { at: new Date(at), allowWhileIdle: true },
      },
    ],
  })
}

export async function clearFocusAlarm(): Promise<void> {
  if (canNotify()) await LocalNotifications.cancel({ notifications: [{ id: FOCUS_ID }] })
}

/** Calls `onChange(true)` when the app comes to the front and `false` when it goes to the background. */
export function onAppActive(onChange: (active: boolean) => void): void {
  if (canNotify()) void App.addListener('appStateChange', ({ isActive }) => onChange(isActive))
}
