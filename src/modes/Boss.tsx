import { useEffect, useMemo, useRef, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { BOSS_HEARTS, BOSS_QUESTION_MS, bossAnswer, bossOutcome, multiplier, newBoss } from '../lib/boss'
import { itemChoices } from '../lib/choices'
import { formatDuration } from '../lib/format'
import { useElapsed } from './hooks'
import { ChoiceQuestion } from './questions'
import { resultFrom, type ModeProps } from './types'

interface Fx {
  /** Bumped on every answer so the sprite remounts and replays its animation. */
  n: number
  kind: 'hit' | 'attack' | null
  damage: number
  mult: number
}

function BossSprite({ kind }: { kind: Fx['kind'] }) {
  return (
    <svg className={`boss-sprite${kind ? ` is-${kind}` : ''}`} viewBox="0 0 120 100" aria-hidden="true">
      <path d="M22 30 L14 4 L40 22 Z M98 30 L106 4 L80 22 Z" className="boss-horn" />
      <path d="M10 62 C10 30 32 16 60 16 C88 16 110 30 110 62 C110 86 90 96 60 96 C30 96 10 86 10 62 Z" className="boss-body" />
      <path d="M34 48 L52 54 M86 48 L68 54" className="boss-brow" />
      <circle cx="44" cy="60" r="8" className="boss-eye" />
      <circle cx="76" cy="60" r="8" className="boss-eye" />
      <circle cx="46" cy="61" r="3.5" className="boss-pupil" />
      <circle cx="74" cy="61" r="3.5" className="boss-pupil" />
      <path d="M40 80 Q60 70 80 80 L74 84 L68 79 L60 85 L52 79 L46 84 Z" className="boss-mouth" />
    </svg>
  )
}

/** Multiple choice against a boss: streaks multiply damage, misses and timeouts cost hearts. */
export default function Boss({ setId, items, allCards, onAnswer, onDone }: ModeProps) {
  const choices = useMemo(() => items.map((it) => itemChoices(it, allCards, Math.random)), [items, allCards])
  // The ref is for handlers (the question moves on from a timer); the state copy is for rendering.
  const bossRef = useRef(newBoss(items.length))
  const [boss, setBoss] = useState(() => newBoss(items.length))
  const [q, setQ] = useState(0)
  const [qStart, setQStart] = useState(Date.now)
  const [answered, setAnswered] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [fx, setFx] = useState<Fx>({ n: 0, kind: null, damage: 0, mult: 1 })
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null)
  const [startedAt] = useState(Date.now)
  const answeredRef = useRef(false)
  const asked = useRef(new Set<string>())
  const missed = useRef(new Set<string>())
  const elapsed = useElapsed(qStart, !answered && !outcome)
  const idx = q % items.length
  const item = items[idx]

  function answer(ok: boolean) {
    if (answeredRef.current) return
    answeredRef.current = true
    setAnswered(true)
    asked.current.add(item.key)
    if (!ok) missed.current.add(item.card.id)
    const { state, damage } = bossAnswer(bossRef.current, ok)
    bossRef.current = state
    setBoss(state)
    setFx((f) => ({ n: f.n + 1, kind: damage ? 'hit' : 'attack', damage, mult: multiplier(state.streak) }))
    void onAnswer(item, ok)
  }

  function next() {
    const end = bossOutcome(bossRef.current)
    if (end) {
      setOutcome(end)
      return
    }
    answeredRef.current = false
    setAnswered(false)
    setTimeUp(false)
    setQ((n) => n + 1)
    setQStart(Date.now())
  }

  // Too slow counts as a miss; the answer shows for a moment before the next question.
  const onTimeout = useRef(() => {})
  useEffect(() => {
    onTimeout.current = () => {
      if (answeredRef.current) return
      setTimeUp(true)
      answer(false)
      window.setTimeout(next, 1400)
    }
  })
  useEffect(() => {
    if (outcome) return
    const t = window.setTimeout(() => onTimeout.current(), BOSS_QUESTION_MS)
    return () => window.clearTimeout(t)
  }, [q, outcome])

  useEffect(() => {
    if (!outcome) return
    const t = window.setTimeout(async () => {
      const ms = Date.now() - startedAt
      const s = bossRef.current
      let note = `The boss won with ${s.hp} of ${s.maxHp} health left.`
      if (outcome === 'won') {
        const key = `best:boss:${setId}`
        const best = await getValue<number>(key)
        if (best === undefined || ms < best) await setValue(key, ms)
        note = `Boss defeated in ${formatDuration(ms)} with ${s.hearts} ${s.hearts === 1 ? 'heart' : 'hearts'} left.`
        if (best !== undefined) note += ms < best ? ` New best! Previous best: ${formatDuration(best)}` : ` Best: ${formatDuration(best)}`
      }
      onDone(resultFrom(items.filter((it) => asked.current.has(it.key)), missed.current, startedAt, note))
    }, 1500)
    return () => window.clearTimeout(t)
  }, [outcome, items, setId, startedAt, onDone])

  const remaining = Math.max(0, BOSS_QUESTION_MS - elapsed)
  return (
    <div className="mode boss-mode">
      <div className="boss-arena">
        <div className="boss-hp">
          <div className="progress-line">
            <strong>Boss</strong>
            <span className="timer">
              {boss.hp} / {boss.maxHp}
            </span>
          </div>
          <div className="bar boss-hp-bar" aria-hidden="true">
            <span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
          </div>
        </div>
        <div className="boss-stage">
          <BossSprite key={fx.n} kind={fx.kind} />
          {fx.kind === 'hit' && (
            <span key={`d${fx.n}`} className="boss-damage">
              -{fx.damage}
              {fx.mult > 1 && <small> x{fx.mult}</small>}
            </span>
          )}
          {outcome && <div className="boss-banner">{outcome === 'won' ? 'Boss defeated' : 'You were defeated'}</div>}
        </div>
        <div className="progress-line">
          <span className="lives" aria-label={`${boss.hearts} hearts left`}>
            {Array.from({ length: BOSS_HEARTS }, (_, i) => (
              <span key={i} className={i < boss.hearts ? '' : 'is-lost'} />
            ))}
          </span>
          <span>
            Streak <strong className="timer">{boss.streak}</strong>
            {multiplier(boss.streak + 1) > 1 && <span className="boss-mult"> next hit x{multiplier(boss.streak + 1)}</span>}
          </span>
        </div>
      </div>
      <div className="bar timebar" aria-hidden="true">
        <span style={{ width: `${(remaining / BOSS_QUESTION_MS) * 100}%` }} />
      </div>
      {!outcome && (
        <ChoiceQuestion key={q} item={item} options={choices[idx]} onAnswer={answer} onNext={next} autoNext timeUp={timeUp} />
      )}
    </div>
  )
}
