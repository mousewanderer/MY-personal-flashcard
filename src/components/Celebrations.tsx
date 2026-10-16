import { useEffect, useMemo, useRef, useState } from 'react'
import { useProfileData, useProfileSettings } from '../db/hooks'
import { getValue, setValue } from '../db/repo'
import { newCelebrations, type Celebration, type Seen } from '../lib/celebrate'
import { buildProfile } from '../lib/profile'
import { UNLOCKABLES } from '../lib/unlocks'
import { LOGGED_MODE_IDS } from '../modes/registry'
import { play } from '../platform/sfx'
import { Icon, type IconName } from './Icon'

const localDay = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function describe(c: Celebration): { icon: IconName; title: string; text: string } {
  switch (c.kind) {
    case 'level':
      return { icon: 'bolt', title: `Level ${c.level}`, text: `Rank: ${c.rank}. Keep going.` }
    case 'achievement':
      return { icon: 'trophy', title: 'Achievement unlocked', text: `${c.name}: ${c.description}` }
    case 'goal':
      return { icon: 'target', title: 'Daily goal met', text: `${c.goal} cards today. Nice work.` }
    case 'unlock':
      return { icon: 'star', title: `New ${c.what} unlocked`, text: `${c.name} is now in Settings.` }
  }
}

const CONFETTI = ['#4f9df5', '#34d399', '#f5c542', '#a78bfa', '#ffffff']

/** A short burst of confetti from the top of the screen, drawn on a canvas (no library). */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || document.documentElement.dataset.motion === 'reduced') return
    const w = (canvas.width = window.innerWidth)
    const h = (canvas.height = window.innerHeight)
    const bits = Array.from({ length: 80 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: 60,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 2,
      spin: (Math.random() - 0.5) * 0.3,
      angle: Math.random() * Math.PI,
      size: 5 + Math.random() * 5,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    }))
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = Math.max(0, 1 - t / 1600)
      for (const b of bits) {
        b.vy += 0.25
        b.x += b.vx
        b.y += b.vy
        b.angle += b.spin
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.angle)
        ctx.fillStyle = b.color
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
        ctx.restore()
      }
      if (t < 1600) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}

/** Watches the profile and celebrates new levels, achievements, unlocks and the daily goal. */
export function Celebrations() {
  const data = useProfileData()
  const { dailyGoal } = useProfileSettings()
  const goal = Math.max(1, dailyGoal)
  const profile = useMemo(() => data && buildProfile(data.logs, data.reviews, data.now, goal, LOGGED_MODE_IDS), [data, goal])
  const [queue, setQueue] = useState<{ id: number; c: Celebration }[]>([])
  // Checks run one after another, so two quick answers can't celebrate the same thing twice.
  const chain = useRef<Promise<Seen | undefined> | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (!profile || !data) return
    const input = {
      level: profile.level.level,
      rank: profile.level.title,
      achievements: profile.achievements,
      today: profile.today,
      goal,
      day: localDay(data.now),
    }
    chain.current = (chain.current ?? getValue<Seen>('celebrated')).then((seen) => {
      const { events, seen: next } = newCelebrations(seen, input, UNLOCKABLES)
      if (JSON.stringify(next) !== JSON.stringify(seen)) void setValue('celebrated', next)
      if (events.length) setQueue((q) => [...q, ...events.map((c) => ({ id: nextId.current++, c }))])
      return next
    })
  }, [profile, data, goal])

  const current = queue[0]
  const dismiss = () => setQueue((q) => q.slice(1))

  useEffect(() => {
    if (!current) return
    play(current.c.kind === 'level' || current.c.kind === 'unlock' ? 'levelup' : 'achievement')
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), 3500)
    return () => window.clearTimeout(t)
  }, [current])

  if (!current) return null
  const { icon, title, text } = describe(current.c)
  return (
    <>
      <Confetti key={`c${current.id}`} />
      <button key={current.id} type="button" className="celebrate" role="status" onClick={dismiss} aria-label={`${title}. ${text} Tap to close.`}>
        <span className={`celebrate-badge is-${current.c.kind}`}>
          <Icon name={icon} size={26} />
        </span>
        <span className="celebrate-text">
          <strong>{title}</strong>
          <span>{text}</span>
        </span>
      </button>
    </>
  )
}
