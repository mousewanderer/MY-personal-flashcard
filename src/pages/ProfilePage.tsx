import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Modal } from '../components/Modal'
import { db } from '../db/db'
import { useProfileSettings } from '../db/hooks'
import { DEFAULT_PROFILE, saveProfile } from '../db/repo'
import { buildProfile, type AchievementKind, type DayCount } from '../lib/profile'
import { MODES } from '../modes/registry'
import type { AvatarColor, ProfileSettings } from '../types'

const COLORS: AvatarColor[] = ['blue', 'green', 'purple', 'orange', 'pink', 'teal']

const KIND_ICON: Record<AchievementKind, IconName> = {
  answers: 'flashcards',
  streak: 'flame',
  mastered: 'star',
  modes: 'compass',
  run: 'target',
  goal: 'trophy',
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w)[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

const percent = (value: number, max: number) => (max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0)

export default function ProfilePage() {
  const settings = useProfileSettings()
  const goal = Math.max(1, settings.dailyGoal)
  const [editing, setEditing] = useState(false)

  const data = useLiveQuery(async () => {
    const [logs, cards, reviews] = await Promise.all([db.logs.toArray(), db.cards.toArray(), db.reviews.toArray()])
    const live = new Set(cards.filter((c) => !c.deleted).map((c) => c.id))
    return { logs, reviews: reviews.filter((r) => live.has(r.cardId)), now: Date.now() }
  }, [])

  const p = useMemo(
    () => data && buildProfile(data.logs, data.reviews, data.now, goal, MODES.map((m) => m.id)),
    [data, goal],
  )

  if (!p) return <p className="muted center">Loading…</p>

  const met = p.today >= goal
  const unlocked = p.achievements.filter((a) => a.unlocked).length
  const { streak, level } = p

  return (
    <div className="page profile">
      <section className="panel profile-hero">
        <Ring value={level.into} max={level.needed} size={112} stroke={6} className="xp-ring" label="Progress to next level">
          <span className="avatar" data-color={settings.color}>
            {initials(settings.name)}
          </span>
        </Ring>
        <div className="profile-id">
          <h1>{settings.name}</h1>
          <div className="row wrap">
            <span className="pill pill-accent">Level {level.level}</span>
            <span className="rank">{level.title}</span>
          </div>
          <p className="small muted">
            {level.into} / {level.needed} XP · {level.needed - level.into} to level {level.level + 1}
          </p>
        </div>
        <button type="button" className="icon-btn profile-edit" aria-label="Edit profile" onClick={() => setEditing(true)}>
          <Icon name="edit" />
        </button>
      </section>

      <section className="tile-grid">
        <StatTile icon="flame" tone="streak" value={streak.current} label="day streak">
          {!streak.studiedToday && streak.current > 0 && <em>Study today to keep it</em>}
        </StatTile>
        <StatTile icon="trophy" tone="goal" value={streak.best} label="best streak" />
        <StatTile icon="bolt" tone="xp" value={p.xp.toLocaleString()} label="total XP" />
        <StatTile icon="star" tone="mastered" value={p.mastered} label="mastered" />
      </section>

      <section className="panel goal-week">
        <div className="goal">
          <Ring value={p.today} max={goal} size={120} stroke={10} className={met ? 'goal-ring is-met' : 'goal-ring'} label="Daily goal">
            <strong>{p.today}</strong>
            <span className="small muted">of {goal}</span>
          </Ring>
          <div>
            <h2 className="h-small">Daily goal</h2>
            <p className="small muted">{met ? 'Goal met for today.' : `${goal - p.today} more answers to go today.`}</p>
          </div>
        </div>
        <div className="week">
          <h2 className="h-small">Last 7 days</h2>
          <WeekChart week={p.week} goal={goal} />
        </div>
      </section>

      <section className="panel">
        <div className="row-between">
          <h2 className="h-small">Achievements</h2>
          <span className="pill">
            {unlocked} / {p.achievements.length}
          </span>
        </div>
        <ul className="badges">
          {p.achievements.map((a) => (
            <li key={a.id} className={a.unlocked ? 'badge is-unlocked' : 'badge'} data-kind={a.kind}>
              <span className="badge-icon">
                <Icon name={a.unlocked ? KIND_ICON[a.kind] : 'lock'} size={22} />
              </span>
              <strong>{a.name}</strong>
              <span className="small muted">{a.description}</span>
              {!a.unlocked && (
                <>
                  <div className="bar">
                    <span style={{ width: `${percent(a.progress, a.target)}%` }} />
                  </div>
                  <span className="small muted">
                    {a.progress.toLocaleString()} / {a.target.toLocaleString()}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="muted small">
        Your profile is built from the answers you give on this device. The laptop and the phone each keep their own.
      </p>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <EditProfile initial={settings} onClose={() => setEditing(false)} />
      </Modal>
    </div>
  )
}

function Ring(props: { value: number; max: number; size: number; stroke: number; className: string; label: string; children: ReactNode }) {
  const { value, max, size, stroke, className, label, children } = props
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = max > 0 ? Math.min(1, value / max) : 0
  const mid = size / 2
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${percent(value, max)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={mid} cy={mid} r={r} strokeWidth={stroke} fill="none" />
        {frac > 0 && (
          <circle
            className="ring-fill"
            cx={mid}
            cy={mid}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

function StatTile(props: { icon: IconName; tone: string; value: ReactNode; label: string; children?: ReactNode }) {
  return (
    <div className="stat-tile" data-tone={props.tone}>
      <span className="stat-tile-icon">
        <Icon name={props.icon} size={22} />
      </span>
      <div>
        <strong>{props.value}</strong>
        <span>{props.label}</span>
        {props.children}
      </div>
    </div>
  )
}

const CHART = { w: 280, top: 18, base: 108, h: 130, slot: 40, bar: 22 }

function WeekChart({ week, goal }: { week: DayCount[]; goal: number }) {
  const max = Math.max(goal, ...week.map((d) => d.count), 1)
  const y = (n: number) => CHART.base - (n / max) * (CHART.base - CHART.top)
  const day = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short' })
  const summary = week.map((d) => `${day(d.day)} ${d.count}`).join(', ')
  return (
    <svg className="week-chart" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label={`Answers per day: ${summary}`}>
      <line className="wk-goal" x1={0} x2={CHART.w} y1={y(goal)} y2={y(goal)} />
      {week.map((d, i) => {
        const x = i * CHART.slot + (CHART.slot - CHART.bar) / 2
        const today = i === week.length - 1
        const top = y(d.count)
        return (
          <g key={d.day} className={today ? 'is-today' : undefined}>
            <rect className="wk-bar" x={x} y={top} width={CHART.bar} height={Math.max(0, CHART.base - top)} rx={4} />
            {d.count > 0 && (
              <text className="wk-count" x={x + CHART.bar / 2} y={top - 5} textAnchor="middle">
                {d.count}
              </text>
            )}
            <text className="wk-day" x={x + CHART.bar / 2} y={CHART.h - 4} textAnchor="middle">
              {day(d.day)}
            </text>
          </g>
        )
      })}
      <line className="wk-base" x1={0} x2={CHART.w} y1={CHART.base} y2={CHART.base} />
    </svg>
  )
}

function EditProfile({ initial, onClose }: { initial: ProfileSettings; onClose: () => void }) {
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState(initial.color)
  const [goal, setGoal] = useState(String(initial.dailyGoal))
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        const n = Math.round(Number(goal))
        await saveProfile({
          name: name.trim() || DEFAULT_PROFILE.name,
          color,
          dailyGoal: Number.isFinite(n) && n >= 1 ? Math.min(999, n) : DEFAULT_PROFILE.dailyGoal,
        })
        onClose()
      }}
    >
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <fieldset className="field">
        <legend>Avatar color</legend>
        <div className="swatches">
          {COLORS.map((c) => (
            <label key={c} className="swatch" data-color={c}>
              <input type="radio" name="avatar-color" checked={color === c} onChange={() => setColor(c)} aria-label={c} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Daily goal (answers per day)</span>
        <input className="input" type="number" min={1} max={999} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <div className="row-end">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  )
}
