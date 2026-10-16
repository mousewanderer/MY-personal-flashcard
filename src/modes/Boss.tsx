import { useEffect, useMemo, useRef, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { bossAnswer, bossMaxHp, bossOutcome, ENEMIES, multiplier, newBoss, nextQueue, type BossLevel, type Enemy } from '../lib/boss'
import { itemChoices } from '../lib/choices'
import { formatDuration, textSizeClass } from '../lib/format'
import { canScramble, emptySlots, isFull, isUnscrambled, scrambleChars, scrambleTiles, undoSlot, type Placed } from '../lib/games'
import type { StudyItem } from '../lib/session'
import { useElapsed, useHotkeys } from './hooks'
import { buzz, play } from '../platform/sfx'
import { ChoiceQuestion } from './questions'
import { ScrambleBoard } from './ScrambleBoard'
import { resultFrom, type ModeProps } from './types'

const LEVEL_LABEL: Record<BossLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function enemyRule(e: Enemy): string {
  const q = e.question === 'choice' ? 'Multiple choice' : 'Unscramble the answer'
  const time = e.timeMs ? `, ${e.timeMs / 1000} s per word` : ', no timer'
  return `${q}${time}${e.combos ? '' : ', no combos'}.`
}

function EnemySprite({ level, kind }: { level: BossLevel; kind?: Fx['kind'] }) {
  const cls = `boss-sprite enemy-${level}${kind ? ` is-${kind}` : ''}`
  if (level === 'easy') {
    return (
      <svg className={cls} viewBox="0 0 120 100" aria-hidden="true">
        <path d="M14 92 C8 60 26 22 60 22 C94 22 112 60 106 92 C96 86 90 96 80 90 C70 98 62 88 52 94 C42 88 34 98 26 90 C22 94 18 94 14 92 Z" className="e-body" />
        <circle cx="46" cy="56" r="9" className="e-eye" />
        <circle cx="76" cy="56" r="9" className="e-eye" />
        <circle cx="48" cy="58" r="4" className="e-pupil" />
        <circle cx="74" cy="58" r="4" className="e-pupil" />
        <path d="M48 76 Q61 84 74 76" className="e-line" />
      </svg>
    )
  }
  if (level === 'medium') {
    return (
      <svg className={cls} viewBox="0 0 120 100" aria-hidden="true">
        <path d="M8 58 L24 44 L30 78 L12 84 Z M112 58 L96 44 L90 78 L108 84 Z" className="e-dark" />
        <path d="M28 24 L92 20 L98 92 L22 94 Z" className="e-body" />
        <path d="M40 34 L56 30 M80 34 L66 30 M34 70 L50 74 M60 82 L84 78" className="e-line" />
        <rect x="40" y="44" width="14" height="8" className="e-glow" />
        <rect x="68" y="44" width="14" height="8" className="e-glow" />
      </svg>
    )
  }
  return (
    <svg className={cls} viewBox="0 0 120 100" aria-hidden="true">
      <path d="M22 30 L14 4 L40 22 Z M98 30 L106 4 L80 22 Z" className="e-dark" />
      <path d="M10 62 C10 30 32 16 60 16 C88 16 110 30 110 62 C110 86 90 96 60 96 C30 96 10 86 10 62 Z" className="e-body" />
      <path d="M34 48 L52 54 M86 48 L68 54" className="e-line" />
      <circle cx="44" cy="60" r="8" className="e-eye" />
      <circle cx="76" cy="60" r="8" className="e-eye" />
      <circle cx="46" cy="61" r="3.5" className="e-pupil" />
      <circle cx="74" cy="61" r="3.5" className="e-pupil" />
      <path d="M40 80 Q60 70 80 80 L74 84 L68 79 L60 85 L52 79 L46 84 Z" className="e-dark" />
    </svg>
  )
}

export function HeroSprite({ kind }: { kind: Fx['kind'] }) {
  return (
    <svg className={`hero-sprite${kind ? ` is-${kind}` : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M78 14 L84 18 L58 66 L52 62 Z" className="h-blade" />
      <path d="M48 58 L62 66" className="h-line" />
      <path d="M30 52 L66 52 L70 94 L26 94 Z" className="h-body" />
      <circle cx="48" cy="34" r="17" className="h-head" />
      <path d="M31 32 C31 18 65 18 65 32 L65 36 L31 36 Z" className="h-helm" />
      <path d="M14 56 C14 50 34 50 34 56 L32 80 C28 86 20 86 16 80 Z" className="h-shield" />
    </svg>
  )
}

interface Fx {
  /** Bumped on every answer so the sprites remount and replay their animation. */
  n: number
  kind: 'hit' | 'attack' | null
  damage: number
  mult: number
}

/** One scramble question. Right answers move on by themselves; a miss shows the answer and waits for Next. */
function ScrambleTurn({ item, timeUp, onAnswer, onNext }: { item: StudyItem; timeUp: boolean; onAnswer: (ok: boolean) => void; onNext: () => void }) {
  const target = useMemo(() => scrambleChars(item.answer), [item])
  const [tiles] = useState(() => scrambleTiles(item.answer))
  const [placed, setPlaced] = useState<Placed>(() => emptySlots(target.length))
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const done = result ?? (timeUp ? 'wrong' : null)

  function change(next: Placed) {
    if (done) return
    setPlaced(next)
    if (!isFull(next)) return
    const ok = isUnscrambled(tiles, next, target)
    setResult(ok ? 'right' : 'wrong')
    onAnswer(ok)
    if (ok) timer.current = window.setTimeout(onNext, 900)
  }

  function giveUp() {
    if (done) return
    setResult('wrong')
    onAnswer(false)
  }

  useHotkeys({ Enter: () => (done === 'wrong' ? onNext() : false) })

  return (
    <>
      <div className="prompt-card">
        <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
      </div>
      <ScrambleBoard
        answer={item.answer}
        tiles={tiles}
        placed={placed}
        target={target}
        status={done === 'right' ? 'right' : done === 'wrong' ? 'revealed' : 'playing'}
        onChange={change}
      />
      {!done && (
        <div className="row-center wrap">
          <button type="button" className="btn" onClick={() => change(undoSlot(placed))} disabled={!placed.some((p) => p !== null)}>
            Undo
          </button>
          <button type="button" className="btn" onClick={giveUp}>
            Give up
          </button>
        </div>
      )}
      {done === 'wrong' && (
        <div className="feedback fb-wrong">
          <strong>{timeUp && !result ? "Time's up" : 'Missed'}</strong>
          <p>
            Answer: <strong>{item.answer}</strong>. It comes back soon.
          </p>
          <div className="row-end">
            <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
              Next <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Battle({ enemy, setId, items, allCards, onAnswer, onDone }: ModeProps & { enemy: Enemy }) {
  const pool = useMemo(() => (enemy.question === 'scramble' ? items.filter((it) => canScramble(it.answer)) : items), [enemy, items])
  const choices = useMemo(
    () => (enemy.question === 'choice' ? pool.map((it) => itemChoices(it, allCards, Math.random)) : []),
    [enemy, pool, allCards],
  )
  // The ref is for handlers (the timer can answer); the state copy is for rendering.
  const bossRef = useRef(newBoss(pool.length, enemy))
  const [boss, setBoss] = useState(() => newBoss(pool.length, enemy))
  const [queue, setQueue] = useState(() => pool.map((_, i) => i))
  const [turn, setTurn] = useState(0)
  const [qStart, setQStart] = useState(Date.now)
  const [answered, setAnswered] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [fx, setFx] = useState<Fx>({ n: 0, kind: null, damage: 0, mult: 1 })
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null)
  const [startedAt] = useState(Date.now)
  const answeredRef = useRef(false)
  const lastRight = useRef(false)
  const asked = useRef(new Set<string>())
  const missed = useRef(new Set<string>())
  const elapsed = useElapsed(qStart, enemy.timeMs > 0 && !answered && !outcome)
  const idx = queue[0]
  const item = pool[idx]

  function answer(ok: boolean) {
    if (answeredRef.current) return
    answeredRef.current = true
    lastRight.current = ok
    setAnswered(true)
    asked.current.add(item.key)
    if (!ok) missed.current.add(item.card.id)
    const { state, damage, mult } = bossAnswer(bossRef.current, enemy, ok, scrambleChars(item.answer).length)
    bossRef.current = state
    setBoss(state)
    setFx((f) => ({ n: f.n + 1, kind: ok ? 'hit' : 'attack', damage, mult }))
    play(ok ? 'hit' : 'hurt')
    buzz(ok ? 'hit' : 'wrong')
    void onAnswer(item, ok)
  }

  function next() {
    const end = bossOutcome(bossRef.current)
    if (end) {
      setOutcome(end)
      return
    }
    setQueue((q) => nextQueue(q, lastRight.current))
    answeredRef.current = false
    setAnswered(false)
    setTimeUp(false)
    setTurn((n) => n + 1)
    setQStart(Date.now())
  }

  // Hard only: running out of time is a mistake.
  const onTimeout = useRef(() => {})
  useEffect(() => {
    onTimeout.current = () => {
      if (answeredRef.current) return
      setTimeUp(true)
      answer(false)
    }
  })
  useEffect(() => {
    if (outcome || !enemy.timeMs) return
    const t = window.setTimeout(() => onTimeout.current(), enemy.timeMs)
    return () => window.clearTimeout(t)
  }, [turn, outcome, enemy.timeMs])

  useEffect(() => {
    if (!outcome) return
    const t = window.setTimeout(async () => {
      const ms = Date.now() - startedAt
      const s = bossRef.current
      let note = `The ${enemy.name} won with ${s.hp} of ${s.maxHp} health left.`
      if (outcome === 'won') {
        const key = `best:boss:${setId}:${enemy.level}`
        const best = await getValue<number>(key)
        if (best === undefined || ms < best) await setValue(key, ms)
        note = `${enemy.name} defeated in ${formatDuration(ms)} with ${s.hearts} ${s.hearts === 1 ? 'heart' : 'hearts'} left.`
        if (best !== undefined) note += ms < best ? ` New best! Previous best: ${formatDuration(best)}` : ` Best: ${formatDuration(best)}`
      }
      onDone(resultFrom(pool.filter((it) => asked.current.has(it.key)), missed.current, startedAt, note))
    }, 1500)
    return () => window.clearTimeout(t)
  }, [outcome, pool, enemy, setId, startedAt, onDone])

  const remaining = Math.max(0, enemy.timeMs - elapsed)
  const nextMult = enemy.combos ? multiplier(boss.streak + 1) : 1
  return (
    <div className="mode boss-mode">
      <div className="boss-arena">
        <div className="battle-stage">
          <div className="fighter">
            <span className="lives" aria-label={`${boss.hearts} hearts left`}>
              {Array.from({ length: enemy.hearts }, (_, i) => (
                <span key={i} className={i < boss.hearts ? '' : 'is-lost'} />
              ))}
            </span>
            <HeroSprite key={`h${fx.n}`} kind={fx.kind} />
            {fx.kind === 'attack' && (
              <span key={`a${fx.n}`} className="boss-damage is-hero">
                -1
              </span>
            )}
          </div>
          <div className="fighter">
            <div className="fighter-hp">
              <div className="progress-line">
                <strong>{enemy.name}</strong>
                <span className="timer">
                  {boss.hp} / {boss.maxHp}
                </span>
              </div>
              <div className="bar boss-hp-bar" aria-hidden="true">
                <span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
              </div>
            </div>
            <EnemySprite key={`e${fx.n}`} level={enemy.level} kind={fx.kind} />
            {fx.kind === 'hit' && (
              <span key={`d${fx.n}`} className="boss-damage">
                -{fx.damage}
                {fx.mult > 1 && <small> x{fx.mult}</small>}
              </span>
            )}
          </div>
          {outcome && <div className="boss-banner">{outcome === 'won' ? `${enemy.name} defeated` : 'You were defeated'}</div>}
        </div>
        {enemy.combos && (
          <div className="progress-line">
            <span>
              Streak <strong className="timer">{boss.streak}</strong>
            </span>
            {nextMult > 1 && <span className="boss-mult">next hit x{nextMult}</span>}
          </div>
        )}
      </div>
      {enemy.timeMs > 0 && (
        <div className="bar timebar" aria-hidden="true">
          <span style={{ width: `${(remaining / enemy.timeMs) * 100}%` }} />
        </div>
      )}
      {!outcome &&
        (enemy.question === 'choice' ? (
          <ChoiceQuestion key={turn} item={item} options={choices[idx]} onAnswer={answer} onNext={next} timeUp={timeUp} />
        ) : (
          <ScrambleTurn key={turn} item={item} timeUp={timeUp} onAnswer={answer} onNext={next} />
        ))}
    </div>
  )
}

/** Pick an enemy, then battle it: easy is multiple choice, medium and hard are word scrambles. */
export default function Boss(props: ModeProps) {
  const { setId, items } = props
  const [enemy, setEnemy] = useState<Enemy | null>(null)
  const [best, setBest] = useState<Partial<Record<BossLevel, number>>>({})
  const scrambleCount = useMemo(() => items.filter((it) => canScramble(it.answer)).length, [items])

  useEffect(() => {
    let live = true
    void Promise.all(ENEMIES.map((e) => getValue<number>(`best:boss:${setId}:${e.level}`))).then((times) => {
      if (live) setBest(Object.fromEntries(ENEMIES.map((e, i) => [e.level, times[i]])))
    })
    return () => {
      live = false
    }
  }, [setId])

  if (enemy) return <Battle {...props} enemy={enemy} />

  return (
    <div className="mode">
      <h2 className="center">Choose your enemy</h2>
      <div className="enemy-pick">
        {ENEMIES.map((e) => {
          const cards = e.question === 'scramble' ? scrambleCount : items.length
          const ms = best[e.level]
          return (
            <button key={e.level} type="button" className="enemy-card" disabled={cards === 0} onClick={() => setEnemy(e)}>
              <EnemySprite level={e.level} />
              <strong>{e.name}</strong>
              <span className={`enemy-level is-${e.level}`}>{LEVEL_LABEL[e.level]}</span>
              <span className="small">{enemyRule(e)}</span>
              <span className="small muted">
                {cards === 0
                  ? 'No answers fit a scramble (2 to 24 letters).'
                  : `${bossMaxHp(cards, e)} health, you have ${e.hearts} hearts`}
              </span>
              {ms !== undefined && <span className="small muted">Best: {formatDuration(ms)}</span>}
            </button>
          )
        })}
      </div>
      <p className="muted small center">Right answers attack. Each mistake lets the enemy hit back and costs a heart. Missed cards come back soon.</p>
    </div>
  )
}
