import { useMemo, useState, type ReactNode } from 'react'
import { DUEL_HP, isBattle, usesScramble, type DuelGame } from '../lib/duel'
import { textSizeClass } from '../lib/format'
import { emptySlots, isFull, isUnscrambled, scrambleChars, type Placed } from '../lib/games'
import { PARTY_TARGET, type PartyPlayer, type PartyQuestion, type PartyResult, type Tally } from '../lib/party'
import { useElapsed } from '../modes/hooks'
import { ScrambleBoard } from '../modes/ScrambleBoard'

/** Answer time, read when the player answers. */
const msSince = (start: number) => Date.now() - start

const nameOf = (players: PartyPlayer[], id: number) => players.find((p) => p.id === id)?.name ?? 'Someone'

/** Everyone's score, or health in a battle. */
export function PartyBoard({ me, game, players, scores, hp }: { me: number; game: DuelGame; players: PartyPlayer[]; scores: Tally; hp: Tally }) {
  const battle = isBattle(game)
  return (
    <div className="party-board">
      {players.map((p) => {
        const out = p.left || (battle && (hp[p.id] ?? 0) <= 0)
        return (
          <div key={p.id} className={`party-chip${p.id === me ? ' is-me' : ''}${out ? ' is-out' : ''}`}>
            <span className="party-name">
              {p.name}
              {p.left ? ' (left)' : ''}
            </span>
            {battle ? (
              <>
                <div className="bar party-hp" aria-hidden="true">
                  <span style={{ width: `${((hp[p.id] ?? 0) / DUEL_HP) * 100}%` }} />
                </div>
                <strong>{hp[p.id] ?? 0}</strong>
              </>
            ) : (
              <strong>{scores[p.id] ?? 0}</strong>
            )}
          </div>
        )
      })}
    </div>
  )
}

function resultText(r: PartyResult, players: PartyPlayer[], me: number, game: DuelGame): string {
  if (!r.right.length) return 'Nobody got it.'
  const names = r.right.map((id, i) => `${id === me ? 'You' : nameOf(players, id)}${i === 0 ? ' (fastest)' : ''}`)
  const hits = r.hits.map((h) => `${h.from === me ? 'You' : nameOf(players, h.from)} hit ${h.to === me ? 'you' : nameOf(players, h.to)} for ${h.damage}`)
  return isBattle(game) && hits.length ? `${hits.join('. ')}.` : `Right: ${names.join(', ')}.`
}

interface PlayProps {
  me: number
  game: DuelGame
  players: PartyPlayer[]
  scores: Tally
  hp: Tally
  q: PartyQuestion
  /** The result of this question, once the host has scored it. */
  result: PartyResult | null
  onAnswer: (ok: boolean, ms: number) => void
}

/** One question on this phone. Everyone answers; the host scores when all have answered or time is up. */
function PartyQuestionView({ me, game, players, hp, q, result, onAnswer }: Omit<PlayProps, 'scores'>) {
  const [start] = useState(Date.now)
  const [answered, setAnswered] = useState<{ ok: boolean; choice?: number } | null>(null)
  const target = useMemo(() => scrambleChars(q.answer), [q])
  const [placed, setPlaced] = useState<Placed>(() => emptySlots(target.length))
  const [shake, setShake] = useState(false)
  const elapsed = useElapsed(start, !answered && !result)
  const timeUp = elapsed >= q.ms
  const out = players.find((p) => p.id === me)?.left || (isBattle(game) && (hp[me] ?? 0) <= 0)
  const open = !answered && !result && !timeUp && !out

  function answer(ok: boolean, choice?: number) {
    if (!open) return
    setAnswered({ ok, choice })
    onAnswer(ok, msSince(start))
  }

  function change(next: Placed) {
    if (!open) return
    setPlaced(next)
    if (!isFull(next)) return
    if (isUnscrambled(q.tiles ?? [], next, target)) answer(true)
    else {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
    }
  }

  const status = result
    ? `Answer: ${q.answer}. ${resultText(result, players, me, game)}`
    : out
      ? "You're out. Watching the rest."
      : answered
        ? 'Locked in. Waiting for the others…'
        : timeUp
          ? "Time's up."
          : ''

  return (
    <>
      <div className="bar timebar" aria-hidden="true">
        <span style={{ width: `${result ? 0 : Math.max(0, 1 - elapsed / q.ms) * 100}%` }} />
      </div>
      <div className="prompt-card">
        <span className={textSizeClass(q.prompt)}>{q.prompt}</span>
      </div>
      {usesScramble(game) ? (
        <>
          <ScrambleBoard
            answer={q.answer}
            tiles={q.tiles ?? []}
            placed={placed}
            target={target}
            status={result ? (answered?.ok ? 'right' : 'revealed') : 'playing'}
            shake={shake}
            onChange={change}
          />
          {open && (
            <div className="row-center">
              <button type="button" className="btn" onClick={() => answer(false)}>
                Give up
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="choices">
          {(q.options ?? []).map((o, i) => {
            const cls = result ? (i === q.correct ? ' is-right' : answered?.choice === i ? ' is-wrong' : ' is-dim') : answered?.choice === i ? ' is-picked' : answered ? ' is-dim' : ''
            return (
              <button key={i} type="button" className={`choice${cls}`} aria-disabled={!open} onClick={() => answer(i === q.correct, i)}>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="party-status" aria-live="polite">
        {status}
      </p>
    </>
  )
}

export function PartyPlay(props: PlayProps) {
  const { me, game, players, scores, hp, q } = props
  return (
    <div className="mode party">
      <PartyBoard me={me} game={game} players={players} scores={scores} hp={hp} />
      <PartyQuestionView key={q.n} {...props} result={props.result?.n === q.n ? props.result : null} />
    </div>
  )
}

/** Final standings: the winner first, then by health (battle) and score. */
export function PartyEnd({ me, game, winner, players, scores, hp, children }: { me: number; game: DuelGame; winner: number | null; players: PartyPlayer[]; scores: Tally; hp: Tally; children?: ReactNode }) {
  const rank = (p: PartyPlayer) => (p.id === winner ? 1e9 : 0) + (isBattle(game) ? (hp[p.id] ?? 0) * 1000 : 0) + (scores[p.id] ?? 0)
  const sorted = [...players].sort((a, b) => rank(b) - rank(a))
  const title = winner === null ? 'Game over' : winner === me ? 'You win' : `${nameOf(players, winner)} wins`
  return (
    <div className="mode">
      <div className="duel-end">
        <h2>{title}</h2>
        <ol className="party-standings">
          {sorted.map((p) => (
            <li key={p.id} className={p.id === me ? 'is-me' : ''}>
              <span>{p.name}</span>
              <strong>{isBattle(game) ? `${hp[p.id] ?? 0} HP` : `${scores[p.id] ?? 0} / ${PARTY_TARGET}`}</strong>
            </li>
          ))}
        </ol>
        <div className="row-center wrap">{children}</div>
      </div>
    </div>
  )
}
