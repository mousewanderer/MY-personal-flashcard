import { useEffect, useRef, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { normalize } from '../lib/answer'
import { formatDuration } from '../lib/format'
import { TIME_ATTACK_MS, TIME_ATTACK_PAIRS, TIME_ATTACK_PENALTY_MS, takeCyclic } from '../lib/games'
import { shuffle } from '../lib/random'
import type { StudyItem } from '../lib/session'
import { useElapsed } from './hooks'
import { resultFrom, type ModeProps } from './types'

interface Tile {
  id: string
  item: StudyItem
  side: 'q' | 'a'
  text: string
}

interface Board {
  round: number
  cursor: number
  drawn: number
  tiles: Tile[]
}

function deal(items: StudyItem[], cursor: number, round: number, drawn: number): Board {
  const { batch, cursor: next } = takeCyclic(items, cursor, TIME_ATTACK_PAIRS)
  const tiles = batch.flatMap((it): Tile[] => [
    { id: `${round}:${it.key}:q`, item: it, side: 'q', text: it.prompt },
    { id: `${round}:${it.key}:a`, item: it, side: 'a', text: it.answer },
  ])
  return { round, cursor: next, drawn: drawn + batch.length, tiles: shuffle(tiles) }
}

export default function TimeAttack({ setId, items, onAnswer, onDone }: ModeProps) {
  const [board, setBoard] = useState(() => deal(items, 0, 0, 0))
  const [cleared, setCleared] = useState(() => new Set<string>())
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<[string, string] | null>(null)
  const [score, setScore] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const roundWrong = useRef(new Set<string>())
  const finishing = useRef(false)
  const elapsed = useElapsed(startedAt)
  const remaining = Math.max(0, TIME_ATTACK_MS - penalty - elapsed)
  const timeUp = remaining <= 0

  async function finish() {
    const key = `best:timeattack:${setId}`
    const best = await getValue<number>(key)
    if (best === undefined || score > best) await setValue(key, score)
    const note =
      best === undefined
        ? `Score: ${score} pairs`
        : score > best
          ? `Score: ${score} pairs. New best! Previous best: ${best}`
          : `Score: ${score} pairs. Best: ${best}`
    const seen = items.slice(0, Math.min(items.length, board.drawn))
    onDone({ ...resultFrom(seen, missed.current, startedAt, note), ms: TIME_ATTACK_MS - penalty })
  }

  // No dependency list: the ref guard makes it run once, with the latest score.
  useEffect(() => {
    if (!timeUp || finishing.current) return
    finishing.current = true
    void finish()
  })

  function tap(t: Tile) {
    if (timeUp || cleared.has(t.id) || flash) return
    if (!selected || selected === t.id) {
      setSelected(selected === t.id ? null : t.id)
      return
    }
    const s = board.tiles.find((x) => x.id === selected)!
    if (s.side === t.side) {
      setSelected(t.id)
      return
    }
    setSelected(null)
    const [q, a] = s.side === 'q' ? [s, t] : [t, s]
    // Two cards with the same answer text are interchangeable.
    const ok = q.item.key === a.item.key || normalize(q.item.answer, false) === normalize(a.item.answer, false)
    if (!ok) {
      missed.current.add(q.item.card.id)
      roundWrong.current.add(q.item.key)
      setPenalty((p) => p + TIME_ATTACK_PENALTY_MS)
      setFlash([s.id, t.id])
      window.setTimeout(() => setFlash(null), 400)
      return
    }
    void onAnswer(q.item, !roundWrong.current.has(q.item.key))
    setScore(score + 1)
    const next = new Set(cleared).add(q.id).add(a.id)
    if (next.size < board.tiles.length) {
      setCleared(next)
      return
    }
    roundWrong.current = new Set()
    setBoard(deal(items, board.cursor, board.round + 1, board.drawn))
    setCleared(new Set())
  }

  const shownRemaining = Math.ceil(remaining / 1000) * 1000
  return (
    <div className="mode mode-wide">
      <div className="progress-line">
        <span>
          Score: <strong>{score}</strong>
        </span>
        <span className={remaining < 10_000 ? 'timer is-low' : 'timer'}>{formatDuration(shownRemaining)}</span>
      </div>
      <div className="bar timebar" aria-hidden="true">
        <span style={{ width: `${(remaining / TIME_ATTACK_MS) * 100}%` }} />
      </div>
      <div className="attack-grid">
        {board.tiles.map((t) => {
          const gone = cleared.has(t.id)
          const cls = `tile${gone ? ' is-gone' : ''}${selected === t.id ? ' is-selected' : ''}${flash?.includes(t.id) ? ' is-wrong' : ''}`
          return (
            <button key={t.id} type="button" className={cls} disabled={gone || timeUp} onClick={() => tap(t)}>
              {t.text}
            </button>
          )
        })}
      </div>
      <p className="muted small center">Tap a term and its match. A wrong pair costs 2 seconds.</p>
    </div>
  )
}
