import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { getValue, setValue } from '../db/repo'
import {
  fallSeconds,
  levelFor,
  matchMeteor,
  MAX_STEP,
  METEOR_LIVES,
  pickNext,
  pointsFor,
  shouldSpawn,
  spawnX,
  step,
  type Meteor as Rock,
} from '../lib/meteor'
import type { StudyItem } from '../lib/session'
import { useHotkeys } from './hooks'
import { resultFrom, type ModeProps } from './types'

type Phase = 'ready' | 'playing' | 'paused' | 'over'

interface Game {
  meteors: Rock<StudyItem>[]
  bursts: { id: number; x: number; y: number; text: string; until: number }[]
  sinceSpawn: number
  cursor: number
  nextId: number
  hits: number
  score: number
  lives: number
  levelUntil: number
  landed: { prompt: string; answer: string; until: number } | null
}

/** What the screen shows; the loop keeps the live game in a ref and copies it here each frame. */
type View = Omit<Game, 'sinceSpawn' | 'cursor' | 'nextId'> & { now: number }

const snapshot = (g: Game, now: number): View => ({
  meteors: [...g.meteors],
  bursts: [...g.bursts],
  hits: g.hits,
  score: g.score,
  lives: g.lives,
  levelUntil: g.levelUntil,
  landed: g.landed,
  now,
})

const newGame = (): Game => ({
  meteors: [],
  bursts: [],
  sinceSpawn: 0,
  cursor: 0,
  nextId: 1,
  hits: 0,
  score: 0,
  lives: METEOR_LIVES,
  levelUntil: 0,
  landed: null,
})

/** Terms fall; type the answer before they land. Three lives, faster every 8 hits. */
export default function Meteor({ setId, items, settings, onAnswer, onDone }: ModeProps) {
  const game = useRef(newGame())
  const [view, setView] = useState(() => snapshot(newGame(), 0))
  const [phase, setPhase] = useState<Phase>('ready')
  const [input, setInput] = useState('')
  const [wrong, setWrong] = useState(false)
  const [best, setBest] = useState<number>()
  const inputRef = useRef<HTMLInputElement>(null)
  const startedAt = useRef(0)
  const seen = useRef(new Set<string>())
  const missed = useRef(new Set<string>())

  useEffect(() => {
    void getValue<number>(`best:meteor:${setId}`).then(setBest)
  }, [setId])

  function play() {
    if (phase === 'ready') startedAt.current = Date.now()
    setPhase('playing')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  useHotkeys({ Enter: play, ' ': play }, phase === 'ready' || phase === 'paused')

  // The game loop. Time only runs while playing and while no dialog (e.g. "Leave?") is open.
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const g = game.current
      if (!document.querySelector('dialog[open]')) {
        const level = levelFor(g.hits)
        const { flying, landed } = step(g.meteors, dt)
        g.meteors = flying
        g.sinceSpawn += Math.min(dt, MAX_STEP)
        for (const m of landed) {
          g.lives--
          g.landed = { prompt: m.item.prompt, answer: m.item.answer, until: now + 2500 }
          missed.current.add(m.item.card.id)
          void onAnswer(m.item, false)
        }
        if (g.lives <= 0) {
          setView(snapshot(g, now))
          setPhase('over')
          return
        }
        if (shouldSpawn(g.meteors.length, g.sinceSpawn, level, items.length)) {
          const idx = pickNext(items, g.cursor, new Set(g.meteors.map((m) => m.item.key)))
          const item = items[idx]
          g.cursor = (idx + 1) % items.length
          seen.current.add(item.key)
          g.meteors.push({
            id: g.nextId++,
            item,
            answer: item.answer,
            x: spawnX(g.meteors, Math.random),
            y: 0,
            speed: 1 / fallSeconds(level),
          })
          g.sinceSpawn = 0
        }
        g.bursts = g.bursts.filter((b) => b.until > now)
        setView(snapshot(g, now))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, items, onAnswer])

  // Pause when the window loses focus or the app goes to the background.
  useEffect(() => {
    if (phase !== 'playing') return
    const pause = () => setPhase('paused')
    const onVisibility = () => document.hidden && pause()
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase])

  // Game over: a moment to see it, then save the best score and show the summary.
  useEffect(() => {
    if (phase !== 'over') return
    const timer = window.setTimeout(async () => {
      const g = game.current
      const key = `best:meteor:${setId}`
      const prev = await getValue<number>(key)
      if (prev === undefined || g.score > prev) await setValue(key, g.score)
      const head = `Score: ${g.score} (level ${levelFor(g.hits)}, ${g.hits} ${g.hits === 1 ? 'hit' : 'hits'})`
      const note =
        prev === undefined ? head : g.score > prev ? `${head}. New best! Previous best: ${prev}` : `${head}. Best: ${prev}`
      const played = items.filter((it) => seen.current.has(it.key))
      onDone(resultFrom(played, missed.current, startedAt.current, note))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [phase, items, setId, onDone])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (phase !== 'playing' || !input.trim()) return
    const g = game.current
    const hit = matchMeteor(g.meteors, input, settings)
    if (!hit) {
      setWrong(true)
      window.setTimeout(() => setWrong(false), 400)
      inputRef.current?.select()
      return
    }
    const now = performance.now()
    const level = levelFor(g.hits)
    g.meteors = g.meteors.filter((m) => m.id !== hit.id)
    g.bursts.push({ id: hit.id, x: hit.x, y: hit.y, text: hit.item.prompt, until: now + 450 })
    g.score += pointsFor(level)
    g.hits++
    if (levelFor(g.hits) > level) g.levelUntil = now + 1500
    void onAnswer(hit.item, true)
    setView(snapshot(g, now))
    setInput('')
  }

  const g = view
  const now = view.now
  const level = levelFor(g.hits)
  const showRocks = phase === 'playing' || phase === 'over'
  const longText = (s: string) => (s.length > 40 ? ' is-long' : '')

  return (
    <div className="mode mode-wide meteor-mode">
      <div className="progress-line">
        <span className="meteor-stats">
          <span>
            Score <strong className="timer">{g.score}</strong>
          </span>
          <span>
            Level <strong className="timer">{level}</strong>
          </span>
        </span>
        <span className="meteor-stats">
          <span className="lives" aria-label={`${g.lives} lives left`}>
            {Array.from({ length: METEOR_LIVES }, (_, i) => (
              <span key={i} className={i < g.lives ? '' : 'is-lost'} />
            ))}
          </span>
          <button
          type="button"
          className="icon-btn"
          aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
          disabled={phase !== 'playing' && phase !== 'paused'}
          onClick={() => (phase === 'paused' ? play() : setPhase('paused'))}
        >
          <Icon name={phase === 'paused' ? 'play' : 'pause'} />
          </button>
        </span>
      </div>

      <div className="meteor-field">
        {showRocks &&
          g.meteors.map((m) => (
            <div key={m.id} className={`meteor${longText(m.item.prompt)}`} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
              {m.item.prompt}
            </div>
          ))}
        {showRocks &&
          g.bursts.map((b) => (
            <div key={`b${b.id}`} className={`meteor is-hit${longText(b.text)}`} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}>
              {b.text}
            </div>
          ))}
        {phase === 'playing' && g.levelUntil > now && <div className="meteor-banner">Level {level}</div>}
        {showRocks && g.landed && g.landed.until > now && (
          <div className="meteor-landed">
            {g.landed.prompt} = <strong>{g.landed.answer}</strong>
          </div>
        )}
        <div className="meteor-ground" />

        {phase === 'ready' && (
          <div className="meteor-overlay">
            <h2>Meteor</h2>
            <p className="muted">
              Type the answer to a falling term and press Enter to destroy it. Each one that lands costs a life. Every{' '}
              8 hits they fall faster.
            </p>
            {best !== undefined && <p className="muted small">Best score: {best}</p>}
            <button type="button" className="btn btn-primary" onClick={play}>
              Start <kbd>Enter</kbd>
            </button>
          </div>
        )}
        {phase === 'paused' && (
          <div className="meteor-overlay">
            <h2>Paused</h2>
            <button type="button" className="btn btn-primary" onClick={play}>
              Resume <kbd>Enter</kbd>
            </button>
          </div>
        )}
        {phase === 'over' && (
          <div className="meteor-overlay is-clear">
            <h2>Game over</h2>
          </div>
        )}
      </div>

      <form className="meteor-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className={`input input-lg${wrong ? ' is-wrong' : ''}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={phase !== 'playing'}
          placeholder="Type an answer"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your answer"
        />
        <button type="submit" className="btn btn-primary" disabled={phase !== 'playing'}>
          Fire
        </button>
      </form>
    </div>
  )
}
