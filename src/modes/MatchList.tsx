import { useMemo, useRef, useState } from 'react'
import { getValue, setValue } from '../db/repo'
import { normalize } from '../lib/answer'
import { formatDuration } from '../lib/format'
import { chunk, shuffle } from '../lib/random'
import { useElapsed } from './hooks'
import { resultFrom, type ModeProps } from './types'

export default function MatchList({ setId, items, onAnswer, onDone }: ModeProps) {
  const perRound = useMemo(() => (window.matchMedia('(min-width: 900px)').matches ? 8 : 6), [])
  const rounds = useMemo(() => chunk(items, perRound), [items, perRound])
  const [round, setRound] = useState(0)
  const current = rounds[round]
  const right = useMemo(() => shuffle(current), [current])
  const [doneLeft, setDoneLeft] = useState(() => new Set<string>())
  const [doneRight, setDoneRight] = useState(() => new Set<string>())
  const [selLeft, setSelLeft] = useState<string | null>(null)
  const [selRight, setSelRight] = useState<string | null>(null)
  const [flash, setFlash] = useState<[string, string] | null>(null)
  const [finished, setFinished] = useState(false)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const elapsed = useElapsed(startedAt, !finished)

  async function finish() {
    setFinished(true)
    // oxlint-disable-next-line react/purity -- runs from a click handler, not during render
    const ms = Date.now() - startedAt
    const key = `best:matchlist:${setId}`
    const best = await getValue<number>(key)
    if (best === undefined || ms < best) await setValue(key, ms)
    const note =
      best === undefined
        ? `Best time: ${formatDuration(ms)}`
        : ms < best
          ? `New best time! Previous best: ${formatDuration(best)}`
          : `Best time: ${formatDuration(best)}`
    onDone(resultFrom(items, missed.current, startedAt, note))
  }

  function tryPair(l: string, r: string) {
    const li = current.find((i) => i.key === l)!
    const ri = current.find((i) => i.key === r)!
    setSelLeft(null)
    setSelRight(null)
    // Two cards with the same answer text are interchangeable.
    const ok = l === r || normalize(li.answer, false) === normalize(ri.answer, false)
    if (!ok) {
      missed.current.add(li.card.id)
      setFlash([l, r])
      window.setTimeout(() => setFlash(null), 450)
      return
    }
    void onAnswer(li, !missed.current.has(li.card.id))
    const nl = new Set(doneLeft).add(l)
    if (nl.size < current.length) {
      setDoneLeft(nl)
      setDoneRight(new Set(doneRight).add(r))
    } else if (round + 1 < rounds.length) {
      setRound(round + 1)
      setDoneLeft(new Set())
      setDoneRight(new Set())
    } else {
      void finish()
    }
  }

  function pickLeft(k: string) {
    if (doneLeft.has(k) || flash) return
    if (selRight) tryPair(k, selRight)
    else setSelLeft(k === selLeft ? null : k)
  }

  function pickRight(k: string) {
    if (doneRight.has(k) || flash) return
    if (selLeft) tryPair(selLeft, k)
    else setSelRight(k === selRight ? null : k)
  }

  const tile = (done: boolean, selected: boolean, wrong: boolean) =>
    `tile${done ? ' is-done' : ''}${selected ? ' is-selected' : ''}${wrong ? ' is-wrong' : ''}`

  return (
    <div className="mode mode-wide">
      <div className="progress-line">
        <span>
          Round {round + 1} / {rounds.length}
        </span>
        <span className="timer">{formatDuration(elapsed)}</span>
      </div>
      <p className="muted small">Tap a term, then its matching definition.</p>
      <div className="match-cols">
        <div className="match-col">
          {current.map((it) => (
            <button
              key={it.key}
              type="button"
              className={tile(doneLeft.has(it.key), selLeft === it.key, flash?.[0] === it.key)}
              onClick={() => pickLeft(it.key)}
              disabled={doneLeft.has(it.key)}
            >
              {it.prompt}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((it) => (
            <button
              key={it.key}
              type="button"
              className={tile(doneRight.has(it.key), selRight === it.key, flash?.[1] === it.key)}
              onClick={() => pickRight(it.key)}
              disabled={doneRight.has(it.key)}
            >
              {it.answer}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
