import { Icon } from '../components/Icon'
import { useSettings, useXp } from '../db/hooks'
import { saveSettings } from '../db/repo'
import { levelFromXp } from '../lib/profile'
import { ACCENTS, activeAccent, isUnlocked } from '../lib/unlocks'
import type { Direction, Strictness, Theme } from '../types'

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
      </div>
      <p className="muted small">
        Your cards are stored only on this device, in this browser. Clearing site data deletes them, so export your sets
        as CSV now and then.
      </p>
    </div>
  )
}
