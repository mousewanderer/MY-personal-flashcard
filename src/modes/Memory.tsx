import { useEffect, useMemo, useRef, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { formatDuration } from '../lib/format'
import { dealMemory, isPair, type MemoryTile } from '../lib/memory'
import { chunk } from '../lib/random'
import { useElapsed } from './hooks'
import { resultFrom, type ModeProps } from './types'

/** Face-down tiles: flip a term and its answer to keep them open. Rounds of 6 pairs (8 on wide screens). */
export default function Memory({ setId, items, onAnswer, onDone }: ModeProps) {
  const perRound = useMemo(() => (window.matchMedia('(min-width: 900px)').matches ? 8 : 6), [])
  const rounds = useMemo(() => chunk(items, perRound), [items, perRound])
  const [round, setRound] = useState(0)
  const [tiles, setTiles] = useState(() => dealMemory(rounds[0], 0))
  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState(() => new Set<string>())
  const [moves, setMoves] = useState(0)
  const [finished, setFinished] = useState(false)
  const [startedAt] = useState(Date.now)
  const flipBack = useRef(0)
  const elapsed = useElapsed(startedAt, !finished)
  useEffect(() => () => window.clearTimeout(flipBack.current), [])

  async function finish(totalMoves: number) {
    setFinished(true)
    // oxlint-disable-next-line react/purity -- runs from a click handler, not during render
    const ms = Date.now() - startedAt
    const key = `best:memory:${setId}`
    const best = await getValue<number>(key)
    if (best === undefined || ms < best) await setValue(key, ms)
    const head = `${totalMoves} moves in ${formatDuration(ms)}.`
    const note =
      best === undefined ? head : ms < best ? `${head} New best time! Previous best: ${formatDuration(best)}` : `${head} Best time: ${formatDuration(best)}`
    onDone(resultFrom(items, new Set(), startedAt, note))
  }

  function flip(t: MemoryTile) {
    if (finished || matched.has(t.id) || open.includes(t.id) || open.length >= 2) return
    if (open.length === 0) {
      setOpen([t.id])
      return
    }
    const first = tiles.find((x) => x.id === open[0])!
    const move = moves + 1
    setMoves(move)
    if (!isPair(first, t)) {
      setOpen([first.id, t.id])
      flipBack.current = window.setTimeout(() => setOpen([]), 1000)
      return
    }
    setOpen([])
    const q = first.side === 'q' ? first : t
    const item = rounds[round].find((it) => it.key === q.key)!
    void onAnswer(item, true)
    const next = new Set(matched).add(first.id).add(t.id)
    if (next.size < tiles.length) {
      setMatched(next)
    } else if (round + 1 < rounds.length) {
      setRound(round + 1)
      setTiles(dealMemory(rounds[round + 1], round + 1))
      setMatched(new Set())
    } else {
      setMatched(next)
      void finish(move)
    }
  }

  return (
    <div className="mode mode-wide">
      <div className="progress-line">
        <span>
          Round {round + 1} / {rounds.length} · {moves} moves
        </span>
        <span className="timer">{formatDuration(Math.floor(elapsed / 1000) * 1000)}</span>
      </div>
      <div className={`memory-grid${perRound === 8 ? ' is-wide' : ''}`}>
        {tiles.map((t) => {
          const shown = open.includes(t.id) || matched.has(t.id)
          const wrong = open.length === 2 && open.includes(t.id)
          const cls = `tile mem-tile${shown ? ' is-open' : ''}${t.side === 'a' ? ' is-answer' : ''}${matched.has(t.id) ? ' is-matched' : ''}${wrong ? ' is-wrong' : ''}`
          return (
            <button
              key={`${t.id}:${shown ? 1 : 0}`}
              type="button"
              className={cls}
              onClick={() => flip(t)}
              aria-label={shown ? t.text : 'Hidden tile'}
            >
              {shown ? t.text : null}
            </button>
          )
        })}
      </div>
      <p className="muted small center">Flip two tiles. A term and its answer stay open.</p>
    </div>
  )
}
