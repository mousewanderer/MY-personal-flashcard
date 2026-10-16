import { useEffect, useMemo, useReducer, useState } from 'react'
import { itemChoices } from '../lib/choices'
import {
  DUEL_GAMES,
  DUEL_HP,
  DUEL_MAX_LETTERS,
  DUEL_QUESTION_MS,
  DUEL_SCRAMBLE_MS,
  DUEL_TARGET,
  duelDamage,
  duelReducer,
  duelScrambleable,
  duelWinner,
  isBattle,
  newDuel,
  usesScramble,
  type DuelGame,
} from '../lib/duel'
import { textSizeClass } from '../lib/format'
import { emptySlots, isFull, isUnscrambled, scrambleChars, scrambleTiles, type Placed } from '../lib/games'
import { shuffle } from '../lib/random'
import type { StudyItem } from '../lib/session'
import { navigate } from '../router'
import { HeroSprite } from './Boss'
import { useElapsed, useHotkeys } from './hooks'
import { ScrambleBoard } from './ScrambleBoard'
import type { ModeProps } from './types'

const NAMES = ['Blue', 'Orange'] as const
/** Laptop keys: the left player's four options, then the right player's. */
const KEYS = [
  ['a', 's', 'd', 'f'],
  ['h', 'j', 'k', 'l'],
] as const

/** Picks the game: the first screen of Duel. */
function DuelSetup({ items, onPick }: { items: StudyItem[]; onPick: (g: DuelGame) => void }) {
  const scrambles = useMemo(() => items.filter(duelScrambleable).length, [items])
  return (
    <div className="mode">
      <h2 className="center">Pick a duel</h2>
      <p className="muted small center">Two players, one phone: sit face to face, and each takes a half of the screen.</p>
      <div className="enemy-pick">
        {DUEL_GAMES.map((g) => {
          const off = usesScramble(g.id) && scrambles === 0
          return (
            <button key={g.id} type="button" className="enemy-card" disabled={off} onClick={() => onPick(g.id)}>
              <strong>{g.name}</strong>
              <span className="small">{g.text}</span>
              {off && <span className="small muted">No answers fit a scramble (2 to {DUEL_MAX_LETTERS} letters).</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One player's scramble board for the current word. */
function ScrambleHalf({ item, tiles, result, onSolve }: { item: StudyItem; tiles: string[]; result: 'right' | 'revealed' | null; onSolve: () => void }) {
  const target = useMemo(() => scrambleChars(item.answer), [item])
  const [placed, setPlaced] = useState<Placed>(() => emptySlots(target.length))
  const [shake, setShake] = useState(false)

  function change(next: Placed) {
    if (result) return
    setPlaced(next)
    if (!isFull(next)) return
    if (isUnscrambled(tiles, next, target)) onSolve()
    else {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
    }
  }

  return (
    <div className="duel-scramble">
      <ScrambleBoard answer={item.answer} tiles={tiles} placed={placed} target={target} status={result ?? 'playing'} shake={shake} keys={false} onChange={change} />
    </div>
  )
}

/**
 * Two players, one device, same question at once. On a phone the top half is turned upside down
 * so the players can sit face to face; on a wide screen the halves sit side by side.
 * Nothing is logged: the review log is the owner's own history.
 */
function LocalDuel({ setId, items, allCards, game, onChangeGame }: ModeProps & { game: DuelGame; onChangeGame: () => void }) {
  const scramble = usesScramble(game)
  const battle = isBattle(game)
  const pool = useMemo(() => (scramble ? items.filter(duelScrambleable) : items), [scramble, items])
  const [order, setOrder] = useState(() => shuffle(pool))
  const choices = useMemo(() => (scramble ? [] : order.map((it) => itemChoices(it, allCards, Math.random))), [scramble, order, allCards])
  const [state, dispatch] = useReducer(duelReducer, undefined, () => newDuel(2, battle))
  const [q, setQ] = useState(0)
  const [qStart, setQStart] = useState(Date.now)
  const [tiles, setTiles] = useState(() => (scramble ? scrambleTiles(order[0].answer) : []))
  const [winner, setWinner] = useState<number | null>(null)
  const idx = q % order.length
  const item = order[idx]
  const options = choices[idx] ?? []
  const correct = options.indexOf(item.answer.trim())
  const limit = scramble ? DUEL_SCRAMBLE_MS : DUEL_QUESTION_MS
  const damage = duelDamage(game, item.answer)
  const { outcome } = state.q
  const elapsed = useElapsed(qStart, outcome === null && winner === null)

  // Each question has its own clock.
  useEffect(() => {
    if (winner !== null) return
    const t = window.setTimeout(() => dispatch({ type: 'timeout' }), limit)
    return () => window.clearTimeout(t)
  }, [q, winner, limit])

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
      if (scramble) setTiles(scrambleTiles(order[(q + 1) % order.length].answer))
      setQ((n) => n + 1)
      setQStart(Date.now())
    }, 1600)
    return () => window.clearTimeout(t)
  }, [outcome, state, scramble, order, q])

  const pick = (player: number, choice: number) => {
    if (winner === null) dispatch({ type: 'pick', player, choice, correct, damage })
  }

  const keyMap: Record<string, () => void> = {}
  KEYS.forEach((keys, p) => keys.forEach((k, i) => (keyMap[k] = () => pick(p, i))))
  useHotkeys(keyMap, winner === null && !scramble)

  function rematch() {
    const next = shuffle(pool)
    setOrder(next)
    if (scramble) setTiles(scrambleTiles(next[0].answer))
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
            {battle ? (
              <span className={`duel-p${winner}`}>{state.hp[winner]} HP left</span>
            ) : (
              <>
                <span className="duel-p0">{state.scores[0]}</span> : <span className="duel-p1">{state.scores[1]}</span>
              </>
            )}
          </p>
          <div className="row-center wrap">
            <button type="button" className="btn btn-primary" onClick={rematch}>
              Rematch
            </button>
            <button type="button" className="btn" onClick={onChangeGame}>
              Change game
            </button>
            <button type="button" className="btn" onClick={() => navigate(`/set/${setId}`)}>
              Back to set
            </button>
          </div>
        </div>
      </div>
    )
  }

  const remaining = Math.max(0, limit - elapsed)
  const hitBy = battle && typeof outcome === 'number' ? outcome : null

  const side = (p: number) => {
    const mine = state.q.picks[p]
    const won = outcome === p ? (battle ? `Hit! -${damage}` : 'Point!') : ''
    const status =
      won ||
      (outcome === 'none'
        ? `Answer: ${item.answer}`
        : outcome !== null
          ? `${scramble ? `${NAMES[outcome]} got it` : state.q.locked[p] ? 'Wrong' : 'Too slow'}. Answer: ${item.answer}`
          : state.q.locked[p]
            ? 'Wrong. Wait for the next one'
            : '')
    return (
      <section className={`duel-side duel-p${p}${p === 1 ? ' is-top' : ''}`} aria-label={`${NAMES[p]} player`}>
        <div className="duel-score">
          {battle ? (
            <>
              <div className="bar duel-hp" aria-hidden="true">
                <span style={{ width: `${(state.hp[p] / DUEL_HP) * 100}%` }} />
              </div>
              <strong>{state.hp[p]}</strong>
            </>
          ) : (
            <strong>{state.scores[p]}</strong>
          )}
          <span>{NAMES[p]}</span>
        </div>
        <div className="duel-prompt">
          <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
        </div>
        {scramble ? (
          <ScrambleHalf
            key={q}
            item={item}
            tiles={tiles}
            result={outcome === null ? null : outcome === p ? 'right' : 'revealed'}
            onSolve={() => winner === null && dispatch({ type: 'solve', player: p, damage })}
          />
        ) : (
          <div className="duel-options">
            {options.map((o, i) => {
              const revealed = outcome !== null
              const cls = revealed && i === correct ? ' is-right' : mine === i ? ' is-wrong' : state.q.locked[p] || revealed ? ' is-dim' : ''
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
        )}
        <p className="duel-status">{status}</p>
      </section>
    )
  }

  const hero = (p: number) => (
    <span className={`duel-hero duel-p${p}`}>
      <HeroSprite key={`${p}-${q}`} kind={hitBy === null ? null : hitBy === p ? 'hit' : 'attack'} />
      {hitBy !== null && hitBy !== p && (
        <span key={`d${q}`} className="boss-damage">
          -{damage}
        </span>
      )}
    </span>
  )

  return (
    <div className="duel">
      {side(1)}
      <div className="duel-middle">
        {battle && hero(0)}
        <div className="bar timebar" aria-hidden="true">
          <span style={{ width: `${(remaining / limit) * 100}%` }} />
        </div>
        {!battle && <span className="muted small">First to {DUEL_TARGET}</span>}
        {battle && hero(1)}
      </div>
      {side(0)}
    </div>
  )
}

export default function Duel(props: ModeProps) {
  const [game, setGame] = useState<DuelGame | null>(null)
  if (!game) return <DuelSetup items={props.items} onPick={setGame} />
  return <LocalDuel key={game} {...props} game={game} onChangeGame={() => setGame(null)} />
}
