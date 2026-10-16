import { Capacitor } from '@capacitor/core'
import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { APP_NAME, APP_TAGLINE } from '../config'
import { useSettings, useXp } from '../db/hooks'
import { getValue, saveSettings, setValue } from '../db/repo'
import { levelFromXp, rankTitle } from '../lib/profile'
import { ACCENTS, activeAccent, activeBackdrop, BACKDROPS, isUnlocked } from '../lib/unlocks'
import { canNotify, clearDailyReminder, setDailyReminder } from '../platform/notify'
import { play } from '../platform/sfx'
import type { Direction, Settings, Strictness, Theme } from '../types'

const APK_PAGE = 'https://github.com/mousewanderer/MY-personal-flashcard/actions/workflows/android.yml'
const native = Capacitor.isNativePlatform()

interface Reminder {
  enabled: boolean
  time: string
}
const REMINDER_KEY = 'reminder'
const DEFAULT_REMINDER: Reminder = { enabled: false, time: '19:00' }

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="panel settings-card">
      <h2 className="settings-head">
        <span className="settings-icon">
          <Icon name={icon} size={18} />
        </span>
        {title}
      </h2>
      <div className="stack">{children}</div>
    </section>
  )
}

/** An on/off switch with its label (and an optional hint) on the left. */
function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} className={`switch${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </label>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

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
    <>
      <Switch label="Remind me to study every day" checked={r.enabled} onChange={(on) => void update({ ...r, enabled: on })} />
      {r.enabled && (
        <label className="field">
          <span>Time</span>
          <input className="input" type="time" value={r.time} onChange={(e) => e.target.value && void update({ ...r, time: e.target.value })} />
        </label>
      )}
      {denied && <span className="muted small">Notifications are turned off for this app. Allow them in Android settings, then try again.</span>}
    </>
  )
}

const BASE_THEMES: { id: Theme; name: string; preview: string }[] = [
  { id: 'system', name: 'System', preview: 'linear-gradient(90deg, #f2f6fb 50%, #0a1120 50%)' },
  { id: 'light', name: 'Light', preview: '#f2f6fb' },
  { id: 'dark', name: 'Dark', preview: '#0a1120' },
]

/** Theme cards: the free ones, then the premium themes each rank unlocks. */
function ThemePicker({ s, level }: { s: Settings; level: number }) {
  const premium = activeBackdrop(s.backdrop, level)
  const current = premium ?? s.theme
  const card = (id: string, name: string, preview: string, accent: string, locked: { level: number } | null, pick: () => void) => (
    <button key={id} type="button" role="radio" aria-checked={current === id} disabled={!!locked} className={`theme-card${current === id ? ' is-on' : ''}`} onClick={pick}>
      <span className="theme-preview" style={{ background: preview }}>
        <span className="theme-bar" style={{ background: accent }} />
        <span className="theme-line" />
        <span className="theme-line short" />
        {locked && (
          <span className="theme-lock">
            <Icon name="lock" size={16} />
          </span>
        )}
      </span>
      <span className="theme-name">{name}</span>
      {locked && (
        <span className="muted small">
          Level {locked.level} · {rankTitle(locked.level)}
        </span>
      )}
    </button>
  )
  return (
    <div className="field">
      <span>Theme</span>
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {BASE_THEMES.map((t) => card(t.id, t.name, t.preview, 'linear-gradient(90deg, #4f9df5, #34d399)', null, () => void saveSettings({ theme: t.id, backdrop: '' })))}
        {BACKDROPS.map((b) =>
          card(
            b.id,
            b.name,
            b.bg,
            b.id === 'king' ? 'linear-gradient(90deg, #a855f7, #f5c542)' : b.accent,
            level >= b.level ? null : { level: b.level },
            () => void saveSettings({ theme: 'dark', backdrop: b.id }),
          ),
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const xp = useXp(0)
  const level = levelFromXp(xp?.total ?? 0).level
  const accent = activeAccent(s.accent, level)
  const premium = activeBackdrop(s.backdrop, level)
  const sound = s.sound ?? true
  const motion = s.motion ?? 'system'

  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="settings-grid">
        <Section icon="star" title="Look">
          <ThemePicker s={s} level={level} />
          <div className="field">
            <span>Accent colour</span>
            <div className="accent-grid" role="radiogroup" aria-label="Accent colour">
              {ACCENTS.map((a) => {
                const open = isUnlocked(a, level) && !premium
                const on = !premium && accent === a.id
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
                      {!isUnlocked(a, level) ? <Icon name="lock" size={16} /> : on ? <Icon name="check" size={16} /> : null}
                    </span>
                    <span>{a.name}</span>
                    {!isUnlocked(a, level) && <span className="muted small">Level {a.level}</span>}
                  </button>
                )
              })}
            </div>
            <span className="muted small">
              {premium ? 'Premium themes bring their own colours.' : `You are level ${level}. More colours and themes unlock as you earn XP.`}
            </span>
          </div>
          <Segmented
            label="Text size"
            value={s.textSize ?? 'normal'}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(v) => void saveSettings({ textSize: v })}
          />
        </Section>

        <Section icon="volume" title="Sound & feel">
          <Switch label="Sound effects" checked={sound} onChange={(on) => void saveSettings({ sound: on })} />
          <label className="field">
            <span>Volume</span>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              disabled={!sound}
              value={Math.round((s.volume ?? 0.6) * 100)}
              onChange={(e) => void saveSettings({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => play('right')}
              onKeyUp={() => play('right')}
            />
          </label>
          {native && <Switch label="Vibrate on answers" checked={s.haptics ?? true} onChange={(on) => void saveSettings({ haptics: on })} />}
          <Segmented
            label="Motion"
            value={motion}
            options={[
              { value: 'system', label: 'System' },
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
            ]}
            onChange={(v) => void saveSettings({ motion: v === 'system' ? undefined : v })}
          />
        </Section>

        <Section icon="learn" title="Study">
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
          <Switch label="Ignore accents" hint="When checking typed answers" checked={s.ignoreAccents} onChange={(on) => void saveSettings({ ignoreAccents: on })} />
          <Switch
            label="Keyboard hints"
            hint="Show shortcut keys on buttons"
            checked={s.kbdHints ?? !native}
            onChange={(on) => void saveSettings({ kbdHints: on })}
          />
          <label className="field">
            <span>Scheduler (when cards come back in Flashcards)</span>
            <select className="input" value={s.scheduler ?? 'classic'} onChange={(e) => void saveSettings({ scheduler: e.target.value as 'classic' | 'fsrs' })}>
              <option value="classic">Classic: steady, predictable intervals</option>
              <option value="fsrs">FSRS: learns how well you remember each card</option>
            </select>
            <span className="muted small">
              {s.scheduler === 'fsrs'
                ? 'FSRS aims for 90% recall and usually needs fewer reviews. You can switch back any time; cards keep their dates.'
                : 'Switching to FSRS keeps your progress: each card starts from its current interval.'}
            </span>
          </label>
        </Section>

        <Section icon="timer" title="Reminders">
          <ReminderSetting />
        </Section>

        <Section icon="doc" title="About">
          <p className="settings-brand">
            <strong>{APP_NAME}</strong>
            <span className="muted">{APP_TAGLINE}</span>
          </p>
          <a className="btn" href={APK_PAGE} target={native ? undefined : '_blank'} rel="noreferrer">
            <Icon name="export" /> Get the latest Android app
          </a>
          <p className="muted small">
            Your cards are stored only on this device, in this browser. Clearing site data deletes them, so export your sets as CSV now and
            then.
          </p>
        </Section>
      </div>
    </div>
  )
}
