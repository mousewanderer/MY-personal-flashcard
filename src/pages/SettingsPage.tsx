import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useSettings, useXp } from '../db/hooks'
import { getValue, saveSettings, setValue } from '../db/repo'
import { levelFromXp } from '../lib/profile'
import { ACCENTS, activeAccent, isUnlocked } from '../lib/unlocks'
import { canNotify, clearDailyReminder, setDailyReminder } from '../platform/notify'
import type { Direction, Strictness, Theme } from '../types'

interface Reminder {
  enabled: boolean
  time: string
}
const REMINDER_KEY = 'reminder'
const DEFAULT_REMINDER: Reminder = { enabled: false, time: '19:00' }

/** The daily study reminder (Android only): stored in kv and scheduled as a repeating notification. */
function ReminderSetting() {
  const [r, setR] = useState<Reminder | null>(null)
  const [denied, setDenied] = useState(false)
  useEffect(() => {
    void getValue<Reminder>(REMINDER_KEY).then((v) => setR({ ...DEFAULT_REMINDER, ...v }))
  }, [])

  async function update(next: Reminder) {
    setR(next)
    setDenied(false)
    if (next.enabled && !(await setDailyReminder(next.time))) {
      setDenied(true)
      next = { ...next, enabled: false }
      setR(next)
    } else if (!next.enabled) {
      await clearDailyReminder()
    }
    await setValue(REMINDER_KEY, next)
  }

  if (!canNotify()) {
    return <p className="muted small">Daily reminders work in the Android app.</p>
  }
  if (!r) return null
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={r.enabled} onChange={(e) => void update({ ...r, enabled: e.target.checked })} />
        Remind me to study every day
      </label>
      {r.enabled && (
        <input className="input" type="time" value={r.time} onChange={(e) => e.target.value && void update({ ...r, time: e.target.value })} />
      )}
      {denied && <span className="muted small">Notifications are turned off for this app. Allow them in Android settings, then try again.</span>}
    </div>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const xp = useXp(0)
  const level = levelFromXp(xp?.total ?? 0).level
  const accent = activeAccent(s.accent, level)
  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <div className="panel stack">
        <label className="field">
          <span>Theme</span>
          <select className="input" value={s.theme} onChange={(e) => void saveSettings({ theme: e.target.value as Theme })}>
            <option value="system">Same as system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="field">
          <span>Accent colour</span>
          <div className="accent-grid" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => {
              const open = isUnlocked(a, level)
              const on = accent === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!open}
                  className={`accent-swatch${on ? ' is-on' : ''}`}
                  onClick={() => void saveSettings({ accent: a.id })}
                >
                  <span className="swatch" style={{ background: a.swatch }}>
                    {!open ? <Icon name="lock" size={16} /> : on ? <Icon name="check" size={16} /> : null}
                  </span>
                  <span>{a.name}</span>
                  {!open && <span className="muted small">Level {a.level}</span>}
                </button>
              )
            })}
          </div>
          <span className="muted small">You are level {level}. More colours unlock as you earn XP.</span>
        </div>
        <label className="field">
          <span>New cards per day (Flashcards)</span>
          <input
            className="input"
            type="number"
            min={0}
            max={999}
            value={s.dailyNewLimit}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n) && n >= 0) void saveSettings({ dailyNewLimit: Math.min(999, n) })
            }}
          />
        </label>
        <label className="field">
          <span>Default direction</span>
          <select className="input" value={s.defaultDirection} onChange={(e) => void saveSettings({ defaultDirection: e.target.value as Direction })}>
            <option value="front-back">Front → Back</option>
            <option value="back-front">Back → Front</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label className="field">
          <span>Writing strictness</span>
          <select className="input" value={s.strictness} onChange={(e) => void saveSettings({ strictness: e.target.value as Strictness })}>
            <option value="strict">Strict: exact answer only</option>
            <option value="normal">Normal: 1 typo per 6 letters</option>
            <option value="lenient">Lenient: 1 typo per 4 letters</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.ignoreAccents} onChange={(e) => void saveSettings({ ignoreAccents: e.target.checked })} />
          Ignore accents when checking typed answers
        </label>
        <label className="field">
          <span>Scheduler (when cards come back in Flashcards)</span>
          <select
            className="input"
            value={s.scheduler ?? 'classic'}
            onChange={(e) => void saveSettings({ scheduler: e.target.value as 'classic' | 'fsrs' })}
          >
            <option value="classic">Classic: steady, predictable intervals</option>
            <option value="fsrs">FSRS: learns how well you remember each card</option>
          </select>
          <span className="muted small">
            {s.scheduler === 'fsrs'
              ? 'FSRS aims for 90% recall and usually needs fewer reviews. You can switch back any time; cards keep their dates.'
              : 'Switching to FSRS keeps your progress: each card starts from its current interval.'}
          </span>
        </label>
        <ReminderSetting />
      </div>
      <p className="muted small">
        Your cards are stored only on this device, in this browser. Clearing site data deletes them, so export your sets
        as CSV now and then.
      </p>
    </div>
  )
}
