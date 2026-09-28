import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { getValue, setValue } from '../db/repo'
import { formatDuration } from '../lib/format'
import {
  buildWordSearch,
  findPlacement,
  gridWord,
  lineCells,
  placementCells,
  type Cell,
  type WordSearch as Puzzle,
} from '../lib/wordgrid'
import { useElapsed } from './hooks'
import { resultFrom, type ModeProps } from './types'

const MIN_LETTERS = 3
const MIN_WORDS = 3
const PER_PUZZLE = 12 // offered to the generator; at most 8 are placed

interface Game {
  puzzle: Puzzle
  /** Keys still to come, including any the last puzzle could not fit. */
  rest: string[]
  round: number
}

const cellId = (c: Cell) => `${c[0]},${c[1]}`
const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]

function cellFrom(e: PointerEvent): Cell | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-r]')
  return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null
}

/** Find each answer in a letter grid; the prompts are the clues. Tap the first and last letter, or drag. */
export default function WordSearch({ setId, items, onAnswer, onDone }: ModeProps) {
  const size = useMemo(() => (window.matchMedia('(min-width: 900px)').matches ? 12 : 10), [])
  const words = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of items) {
      const w = gridWord(it.answer)
      if (w && w.length >= MIN_LETTERS && w.length <= size) m.set(it.key, w)
    }
    return m
  }, [items, size])
  const byKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const deal = (keys: string[], round: number): Game => {
    const take = keys.slice(0, PER_PUZZLE)
    const puzzle = buildWordSearch(take.map((key) => ({ key, word: words.get(key)! })), size, Math.random)
    return { puzzle, rest: [...puzzle.skipped, ...keys.slice(PER_PUZZLE)], round }
  }
  const [game, setGame] = useState<Game | null>(() => (words.size >= MIN_WORDS ? deal([...words.keys()], 1) : null))
  const [found, setFound] = useState(() => new Set<string>())
  const [gaveUp, setGaveUp] = useState(false)
  const [first, setFirst] = useState<Cell | null>(null)
  const [path, setPath] = useState<Cell[] | null>(null)
  const [flash, setFlash] = useState<Cell[] | null>(null)
  const [startedAt] = useState(Date.now)
  const [finished, setFinished] = useState(false)
  const pressed = useRef(false)
  const justPicked = useRef(false)
  const anyGiveUp = useRef(false)
  const asked = useRef(new Set<string>())
  const missed = useRef(new Set<string>())
  const elapsed = useElapsed(startedAt, !finished)

  if (!game) {
    return (
      <div className="mode empty">
        <p>
          Word Search needs at least {MIN_WORDS} cards whose answers are {MIN_LETTERS} to {size} letters long.
        </p>
      </div>
    )
  }

  const { puzzle } = game
  const roundOver = gaveUp || puzzle.placed.every((p) => found.has(p.key))
  const colour = new Map<string, number>()
  puzzle.placed.forEach((p, i) => {
    if (found.has(p.key) || gaveUp) for (const c of placementCells(p)) colour.set(cellId(c), found.has(p.key) ? i : -1)
  })
  const pathIds = new Set((path ?? []).map(cellId))
  const flashIds = new Set((flash ?? []).map(cellId))

  function attempt(a: Cell, b: Cell) {
    const cells = lineCells(a, b)
    const p = cells && findPlacement(puzzle.placed, cells)
    if (p && !found.has(p.key)) {
      setFound(new Set(found).add(p.key))
      asked.current.add(p.key)
      void onAnswer(byKey.get(p.key)!, true)
      return
    }
    setFlash(cells ?? [a, b])
    window.setTimeout(() => setFlash(null), 400)
  }

  function giveUp() {
    for (const p of puzzle.placed) {
      if (found.has(p.key)) continue
      const item = byKey.get(p.key)!
      asked.current.add(p.key)
      missed.current.add(item.card.id)
      void onAnswer(item, false)
    }
    anyGiveUp.current = true
    setGaveUp(true)
    setFirst(null)
  }

  function nextPuzzle() {
    setGame(deal(game!.rest, game!.round + 1))
    setFound(new Set())
    setGaveUp(false)
  }

  async function finish() {
    setFinished(true)
    // oxlint-disable-next-line react/purity -- runs from a click handler, not during render
    const ms = Date.now() - startedAt
    let note = `Found ${asked.current.size - missed.current.size} of ${asked.current.size} words in ${formatDuration(ms)}.`
    if (!anyGiveUp.current) {
      const key = `best:wordsearch:${setId}`
      const best = await getValue<number>(key)
      if (best === undefined || ms < best) await setValue(key, ms)
      if (best !== undefined) note += ms < best ? ` New best! Previous best: ${formatDuration(best)}` : ` Best: ${formatDuration(best)}`
    }
    const skipped = items.length - words.size
    if (skipped) note += ` ${skipped} ${skipped === 1 ? 'card was' : 'cards were'} left out: the answer does not fit a word grid.`
    onDone(resultFrom(items.filter((it) => asked.current.has(it.key)), missed.current, startedAt, note))
  }

  const onDown = (e: PointerEvent) => {
    const c = cellFrom(e)
    if (!c || roundOver) return
    pressed.current = true
    justPicked.current = !first
    if (!first) setFirst(c)
  }
  const onMove = (e: PointerEvent) => {
    if (!pressed.current || !first) return
    const c = cellFrom(e)
    setPath(c ? lineCells(first, c) : null)
  }
  const onUp = (e: PointerEvent) => {
    pressed.current = false
    setPath(null)
    const c = cellFrom(e)
    if (!c || !first) return
    if (sameCell(c, first)) {
      if (!justPicked.current) setFirst(null) // a second tap on the first letter unselects it
      return
    }
    attempt(first, c)
    setFirst(null)
  }

  return (
    <div className="mode mode-wide">
      <div className="progress-line">
        <span>
          Puzzle {game.round} · {found.size} / {puzzle.placed.length} found
        </span>
        <span className="timer">{formatDuration(Math.floor(elapsed / 1000) * 1000)}</span>
      </div>
      <div className="wordsearch">
        <div
          className="ws-grid"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            pressed.current = false
            setPath(null)
          }}
        >
          {puzzle.grid.map((row, r) =>
            row.map((ch, c) => {
              const id = cellId([r, c])
              const hue = colour.get(id)
              const cls = [
                'ws-cell',
                hue !== undefined && (hue >= 0 ? 'is-found' : 'is-revealed'),
                pathIds.has(id) && 'is-path',
                first && sameCell(first, [r, c]) && 'is-first',
                flashIds.has(id) && 'is-wrong',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <div key={id} className={cls} data-r={r} data-c={c} style={hue !== undefined && hue >= 0 ? { ['--h' as string]: (hue * 47) % 360 } : undefined}>
                  {ch}
                </div>
              )
            }),
          )}
        </div>
        <ol className="ws-clues">
          {puzzle.placed.map((p) => {
            const item = byKey.get(p.key)!
            const done = found.has(p.key)
            return (
              <li key={p.key} className={done ? 'is-found' : gaveUp ? 'is-revealed' : ''}>
                <span>{item.prompt}</span>
                {(done || gaveUp) && <strong>{item.answer}</strong>}
              </li>
            )
          })}
        </ol>
      </div>
      <div className="row-center">
        {!roundOver && (
          <button type="button" className="btn" onClick={giveUp}>
            Give up
          </button>
        )}
        {roundOver && game.rest.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={nextPuzzle}>
            Next puzzle
          </button>
        )}
        {roundOver && (
          <button type="button" className={game.rest.length ? 'btn' : 'btn btn-primary'} disabled={finished} onClick={() => void finish()}>
            Finish
          </button>
        )}
      </div>
      <p className="muted small center">Tap the first and last letter of an answer, or drag across it.</p>
    </div>
  )
}
