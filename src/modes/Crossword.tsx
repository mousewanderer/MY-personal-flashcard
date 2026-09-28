import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { getValue, setValue } from '../db/repo'
import { formatDuration } from '../lib/format'
import { fold } from '../lib/games'
import { buildCrossword, gridWord, wordCells, type Crossword as Puzzle } from '../lib/wordgrid'
import { useElapsed } from './hooks'
import { resultFrom, type ModeProps } from './types'

const MIN_LETTERS = 3
const MAX_LETTERS = 12
const PER_PUZZLE = 14 // offered to the generator; at most 10 are placed
/** The hidden input keeps one character so phone keyboards always have something to delete. */
const SENTINEL = ' '

interface Game {
  puzzle: Puzzle
  rest: string[]
  round: number
}

interface Cursor {
  /** Index into puzzle.words. */
  word: number
  /** Letter position inside that word. */
  pos: number
}

const id = (r: number, c: number) => `${r},${c}`
const letterOf = (typed: string) => fold(typed).toUpperCase().replace(/[^\p{L}]/gu, '').slice(0, 1)

/** A crossword built from the set: prompts are the clues, answers the words. */
export default function Crossword({ setId, items, onAnswer, onDone }: ModeProps) {
  const words = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of items) {
      const w = gridWord(it.answer)
      if (w && w.length >= MIN_LETTERS && w.length <= MAX_LETTERS) m.set(it.key, w)
    }
    return m
  }, [items])
  const byKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const deal = (keys: string[], round: number): Game => {
    const take = keys.slice(0, PER_PUZZLE)
    const puzzle = buildCrossword(take.map((key) => ({ key, word: words.get(key)! })), Math.random)
    return { puzzle, rest: [...puzzle.leftover, ...keys.slice(PER_PUZZLE)], round }
  }
  const [game, setGame] = useState<Game | null>(() => (words.size >= 2 ? deal([...words.keys()], 1) : null))
  const [entries, setEntries] = useState(() => new Map<string, string>())
  const [cursor, setCursor] = useState<Cursor>({ word: 0, pos: 0 })
  const [solved, setSolved] = useState(() => new Set<string>())
  const [revealed, setRevealed] = useState(() => new Set<string>())
  const [wrong, setWrong] = useState(() => new Set<string>())
  const [startedAt] = useState(Date.now)
  const [finished, setFinished] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const anyReveal = useRef(false)
  const asked = useRef(new Set<string>())
  const missed = useRef(new Set<string>())
  const elapsed = useElapsed(startedAt, !finished)

  if (!game) {
    return (
      <div className="mode empty">
        <p>
          Crossword needs at least 2 cards whose answers are {MIN_LETTERS} to {MAX_LETTERS} letters long.
        </p>
      </div>
    )
  }

  const { puzzle } = game
  const cellWords = new Map<string, number[]>()
  puzzle.words.forEach((w, i) => wordCells(w).forEach(([r, c]) => cellWords.set(id(r, c), [...(cellWords.get(id(r, c)) ?? []), i])))
  const current = puzzle.words[cursor.word]
  const currentCells = wordCells(current)
  const [cr, cc] = currentCells[cursor.pos]
  const done = (key: string) => solved.has(key) || revealed.has(key)
  const roundOver = puzzle.words.every((w) => done(w.key))
  // Letters of finished words are locked: typing and erasing skip over them.
  const lockedCells = new Set(puzzle.words.filter((w) => done(w.key)).flatMap((w) => wordCells(w).map(([r, c]) => id(r, c))))
  const lockedAt = (pos: number) => lockedCells.has(id(...currentCells[pos]))
  const numberAt = new Map(puzzle.words.map((w) => [id(w.row, w.col), w.number]))

  const focusInput = () => input.current?.focus({ preventScroll: true })

  /** Marks words that are now complete and right; each card is logged once. */
  function settle(next: Map<string, string>, touched: string) {
    const newly: string[] = []
    for (const wi of cellWords.get(touched) ?? []) {
      const w = puzzle.words[wi]
      if (done(w.key)) continue
      if (wordCells(w).every(([r, c], i) => next.get(id(r, c)) === w.word[i])) newly.push(w.key)
    }
    if (!newly.length) return
    setSolved((s) => new Set([...s, ...newly]))
    for (const key of newly) {
      asked.current.add(key)
      void onAnswer(byKey.get(key)!, true)
    }
  }

  function type(ch: string) {
    const L = letterOf(ch)
    if (!L || roundOver) return
    const len = current.word.length
    let pos = cursor.pos
    // On a locked letter, typing that same letter steps over it (so whole words can be typed);
    // any other letter goes into the next open square.
    if (lockedAt(pos) && current.word[pos] !== L) {
      while (pos < len && lockedAt(pos)) pos++
      if (pos >= len) return
    }
    const cell = id(...currentCells[pos])
    if (!lockedCells.has(cell)) {
      const next = new Map(entries).set(cell, L)
      setEntries(next)
      if (wrong.has(cell)) setWrong((w) => new Set([...w].filter((x) => x !== cell)))
      settle(next, cell)
    }
    setCursor({ ...cursor, pos: Math.min(pos + 1, len - 1) })
  }

  function erase() {
    const cell = id(cr, cc)
    if (entries.get(cell) && !lockedCells.has(cell)) {
      const next = new Map(entries)
      next.delete(cell)
      setEntries(next)
      return
    }
    let pos = cursor.pos - 1
    while (pos >= 0 && lockedAt(pos)) pos--
    if (pos < 0) return
    const next = new Map(entries)
    next.delete(id(...currentCells[pos]))
    setEntries(next)
    setCursor({ ...cursor, pos })
  }

  function selectCell(r: number, c: number) {
    const options = cellWords.get(id(r, c)) ?? []
    if (!options.length) return
    // Tapping the current cell again switches between its across and down word.
    const same = r === cr && c === cc
    const wi = same && options.length > 1 ? options.find((o) => o !== cursor.word)! : options.includes(cursor.word) ? cursor.word : options[0]
    const pos = wordCells(puzzle.words[wi]).findIndex(([wr, wc]) => wr === r && wc === c)
    setCursor({ word: wi, pos })
    focusInput()
  }

  function selectWord(wi: number) {
    setCursor({ word: wi, pos: 0 })
    focusInput()
  }

  function moveBy(dr: number, dc: number) {
    const r = cr + dr
    const c = cc + dc
    const options = cellWords.get(id(r, c))
    if (!options) return
    const across = dc !== 0
    const wi = options.find((o) => puzzle.words[o].across === across) ?? options[0]
    setCursor({ word: wi, pos: wordCells(puzzle.words[wi]).findIndex(([wr, wc]) => wr === r && wc === c) })
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (moves[e.key]) {
      e.preventDefault()
      moveBy(...moves[e.key])
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      erase()
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectWord((cursor.word + (e.shiftKey ? puzzle.words.length - 1 : 1)) % puzzle.words.length)
    }
  }

  // Phone keyboards often report letters only through input events, so read the text that arrived.
  function onInput(e: FormEvent<HTMLInputElement>) {
    const value = e.currentTarget.value
    e.currentTarget.value = SENTINEL
    if (value.length < SENTINEL.length) erase()
    else if (value.length > SENTINEL.length) type(value.slice(-1))
  }

  function check() {
    const bad = new Set<string>()
    for (const w of puzzle.words) {
      wordCells(w).forEach(([r, c], i) => {
        const v = entries.get(id(r, c))
        if (v && v !== w.word[i]) bad.add(id(r, c))
      })
    }
    setWrong(bad)
  }

  function revealWord() {
    if (done(current.key)) return
    const next = new Map(entries)
    currentCells.forEach(([r, c], i) => next.set(id(r, c), current.word[i]))
    setEntries(next)
    const shown = new Set(currentCells.map(([r, c]) => id(r, c)))
    setWrong((w) => new Set([...w].filter((x) => !shown.has(x))))
    setRevealed((s) => new Set(s).add(current.key))
    anyReveal.current = true
    const item = byKey.get(current.key)!
    asked.current.add(current.key)
    missed.current.add(item.card.id)
    void onAnswer(item, false)
  }

  function nextPuzzle() {
    setGame(deal(game!.rest, game!.round + 1))
    setEntries(new Map())
    setSolved(new Set())
    setRevealed(new Set())
    setWrong(new Set())
    setCursor({ word: 0, pos: 0 })
  }

  async function finish() {
    setFinished(true)
    // oxlint-disable-next-line react/purity -- runs from a click handler, not during render
    const ms = Date.now() - startedAt
    let note = `Solved ${asked.current.size - missed.current.size} of ${asked.current.size} words in ${formatDuration(ms)}.`
    if (!anyReveal.current) {
      const key = `best:crossword:${setId}`
      const best = await getValue<number>(key)
      if (best === undefined || ms < best) await setValue(key, ms)
      if (best !== undefined) note += ms < best ? ` New best! Previous best: ${formatDuration(best)}` : ` Best: ${formatDuration(best)}`
    }
    const skipped = items.length - words.size
    if (skipped) note += ` ${skipped} ${skipped === 1 ? 'card was' : 'cards were'} left out: the answer does not fit a crossword.`
    onDone(resultFrom(items.filter((it) => asked.current.has(it.key)), missed.current, startedAt, note))
  }

  const inWord = new Set(currentCells.map(([r, c]) => id(r, c)))
  const clue = (across: boolean) =>
    puzzle.words.map((w, i) => ({ w, i })).filter(({ w }) => w.across === across)

  return (
    <div className="mode mode-wide">
      <div className="progress-line">
        <span>
          Puzzle {game.round} · {solved.size + revealed.size} / {puzzle.words.length} done
        </span>
        <span className="timer">{formatDuration(Math.floor(elapsed / 1000) * 1000)}</span>
      </div>
      <p className="cw-current">
        <strong>
          {current.number} {current.across ? 'Across' : 'Down'}
        </strong>{' '}
        {byKey.get(current.key)!.prompt}
      </p>
      <div className="crossword">
        <div className="cw-grid" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`, ['--cols' as string]: puzzle.cols }}>
          {puzzle.cells.map((row, r) =>
            row.map((ch, c) => {
              const cell = id(r, c)
              if (ch === null) return <div key={cell} className="cw-block" />
              const cls = [
                'cw-cell',
                inWord.has(cell) && 'is-word',
                r === cr && c === cc && 'is-cursor',
                lockedCells.has(cell) && 'is-solved',
                wrong.has(cell) && 'is-wrong',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button key={cell} type="button" className={cls} onClick={() => selectCell(r, c)} aria-label={`Row ${r + 1}, column ${c + 1}`}>
                  {numberAt.has(cell) && <span className="cw-num">{numberAt.get(cell)}</span>}
                  {entries.get(cell) ?? ''}
                </button>
              )
            }),
          )}
        </div>
        <div className="cw-clues">
          {[true, false].map((across) => (
            <div key={String(across)}>
              <h3>{across ? 'Across' : 'Down'}</h3>
              <ol>
                {clue(across).map(({ w, i }) => (
                  <li key={w.key}>
                    <button
                      type="button"
                      className={`cw-clue${i === cursor.word ? ' is-active' : ''}${done(w.key) ? ' is-done' : ''}`}
                      onClick={() => selectWord(i)}
                    >
                      <strong>{w.number}</strong> {byKey.get(w.key)!.prompt}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
      <input
        ref={input}
        className="cw-input"
        defaultValue={SENTINEL}
        onInput={onInput}
        onKeyDown={onKeyDown}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Type letters for the selected word"
      />
      <div className="row-center">
        {!roundOver && (
          <>
            <button type="button" className="btn" onClick={check}>
              Check
            </button>
            <button type="button" className="btn" onClick={revealWord}>
              Reveal word
            </button>
          </>
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
    </div>
  )
}
