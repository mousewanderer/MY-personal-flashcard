import { useEffect, useMemo, useReducer, useState } from 'react'
import { itemChoices } from '../lib/choices'
import { DUEL_QUESTION_MS, DUEL_TARGET, duelReducer, duelWinner, newDuel, type Player } from '../lib/duel'
import { textSizeClass } from '../lib/format'
import { shuffle } from '../lib/random'
import { navigate } from '../router'
import { useElapsed, useHotkeys } from './hooks'
import type { ModeProps } from './types'

const NAMES = ['Blue', 'Orange'] as const
/** Laptop keys: the left player's four options, then the right player's. */
const KEYS = [
  ['a', 's', 'd', 'f'],
  ['h', 'j', 'k', 'l'],
] as const

/**
 * Two players, one device, same question at once. On a phone the top half is turned upside down
 * so the players can sit face to face; on a wide screen the halves sit side by side.
 * Nothing is logged: the review log is the owner's own history.
 */
export default function Duel({ setId, items, allCards }: ModeProps) {
  const [order, setOrder] = useState(() => shuffle(items))
  const choices = useMemo(() => order.map((it) => itemChoices(it, allCards, Math.random)), [order, allCards])
  const [state, dispatch] = useReducer(duelReducer, undefined, newDuel)
  const [q, setQ] = useState(0)
  const [qStart, setQStart] = useState(Date.now)
  const [winner, setWinner] = useState<Player | null>(null)
  const idx = q % order.length
  const item = order[idx]
  const options = choices[idx]
  const correct = options.indexOf(item.answer.trim())
  const { outcome } = state.q
  const elapsed = useElapsed(qStart, outcome === null && winner === null)

  // Each question has its own clock.
  useEffect(() => {
    if (winner !== null) return
    const t = window.setTimeout(() => dispatch({ type: 'timeout' }), DUEL_QUESTION_MS)
    return () => window.clearTimeout(t)
  }, [q, winner])

  // Show the result briefly, then the next question or the winner.
  useEffect(() => {
    if (outcome === null) return
    const t = window.setTimeout(() => {
      const w = duelWinner(state)
      if (w !== null) {
        setWinner(w)
        return
      }
      dispatch({ type: 'next' })
      setQ((n) => n + 1)
      setQStart(Date.now())
    }, 1500)
    return () => window.clearTimeout(t)
  }, [outcome, state])

  const pick = (player: Player, choice: number) => {
    if (winner === null) dispatch({ type: 'pick', player, choice, correct })
  }

  const keyMap: Record<string, () => void> = {}
  KEYS.forEach((keys, p) => keys.forEach((k, i) => (keyMap[k] = () => pick(p as Player, i))))
  useHotkeys(keyMap, winner === null)

  function rematch() {
    setOrder(shuffle(items))
    dispatch({ type: 'reset' })
    setQ(0)
    setQStart(Date.now())
    setWinner(null)
  }

  if (winner !== null) {
    return (
      <div className="mode">
        <div className={`duel-end duel-p${winner}`}>
          <h2>{NAMES[winner]} wins</h2>
          <p className="duel-final">
            <span className="duel-p0">{state.scores[0]}</span> : <span className="duel-p1">{state.scores[1]}</span>
          </p>
          <div className="row-center">
            <button type="button" className="btn btn-primary" onClick={rematch}>
              Rematch
            </button>
            <button type="button" className="btn" onClick={() => navigate(`/set/${setId}`)}>
              Back to set
            </button>
          </div>
        </div>
      </div>
    )
  }

  const remaining = Math.max(0, DUEL_QUESTION_MS - elapsed)
  const side = (p: Player) => {
    const mine = state.q.picks[p]
    const status =
      outcome === p
        ? 'Point!'
        : outcome === 'none'
          ? `Answer: ${item.answer}`
          : outcome !== null
            ? `${state.q.locked[p] ? 'Wrong' : 'Too slow'}. Answer: ${item.answer}`
            : state.q.locked[p]
              ? 'Wrong. Wait for the next one'
              : ''
    return (
      <section className={`duel-side duel-p${p}${p === 1 ? ' is-top' : ''}`} aria-label={`${NAMES[p]} player`}>
        <div className="duel-score">
          <strong>{state.scores[p]}</strong>
          <span>{NAMES[p]}</span>
        </div>
        <div className="duel-prompt">
          <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
        </div>
        <div className="duel-options">
          {options.map((o, i) => {
            const revealed = outcome !== null
            const cls =
              revealed && i === correct
                ? ' is-right'
                : mine === i
                  ? ' is-wrong'
                  : state.q.locked[p] || revealed
                    ? ' is-dim'
                    : ''
            return (
              <button
                key={i}
                type="button"
                className={`choice${cls}`}
                aria-disabled={state.q.locked[p] || revealed}
                onPointerDown={(e) => {
                  e.preventDefault()
                  pick(p, i)
                }}
                onClick={() => pick(p, i)}
              >
                <kbd className="duel-key">{KEYS[p][i].toUpperCase()}</kbd>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
        <p className="duel-status">{status}</p>
      </section>
    )
  }

  return (
    <div className="duel">
      {side(1)}
      <div className="duel-middle">
        <div className="bar timebar" aria-hidden="true">
          <span style={{ width: `${(remaining / DUEL_QUESTION_MS) * 100}%` }} />
        </div>
        <span className="muted small">First to {DUEL_TARGET}</span>
      </div>
      {side(0)}
    </div>
  )
}
