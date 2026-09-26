import { useMemo, useRef, useState } from 'react'
import { textSizeClass } from '../lib/format'
import { answerWords, canScramble, findTile, hintStep, isUnscrambled, scrambleChars, scrambleTiles } from '../lib/games'
import { useHotkeys } from './hooks'
import { NotPlayable } from './NotPlayable'
import { resultFrom, type ModeProps } from './types'

type Status = 'playing' | 'right' | 'skipped'

export default function WordScramble({ setId, items, onAnswer, onDone }: ModeProps) {
  const playable = useMemo(() => items.filter((it) => canScramble(it.answer)), [items])
  const [index, setIndex] = useState(0)
  const [tiles, setTiles] = useState(() => (playable[0] ? scrambleTiles(playable[0].answer) : []))
  const [placed, setPlaced] = useState<number[]>([])
  const [status, setStatus] = useState<Status>('playing')
  const [shake, setShake] = useState(false)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())

  const item = playable[index]
  const target = item ? scrambleChars(item.answer) : []
  const playing = !!item && status === 'playing'

  function place(next: number[]) {
    if (!item) return
    setPlaced(next)
    if (next.length < target.length) return
    if (isUnscrambled(tiles, next, target)) {
      setStatus('right')
      void onAnswer(item, true)
    } else {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
    }
  }

  const tap = (i: number) => playing && !placed.includes(i) && place([...placed, i])
  const undo = () => playing && setPlaced(placed.slice(0, -1))

  function skip() {
    if (!playing) return
    missed.current.add(item.card.id)
    void onAnswer(item, false)
    setStatus('skipped')
  }

  function next() {
    if (index + 1 >= playable.length) {
      onDone(resultFrom(playable, missed.current, startedAt))
      return
    }
    setIndex(index + 1)
    setTiles(scrambleTiles(playable[index + 1].answer))
    setPlaced([])
    setStatus('playing')
  }

  useHotkeys({
    Backspace: () => undo(),
    Enter: () => (status !== 'playing' ? next() : false),
    '*': (e) => {
      if (!playing) return false
      const i = findTile(tiles, placed, e.key)
      if (i < 0) return false
      tap(i)
    },
  })

  if (!item) {
    return <NotPlayable setId={setId} message="None of these answers fit this game (it needs answers of 2 to 24 letters). Try the Back → Front direction." />
  }

  const words = answerWords(item.answer)
  const slotText = (slot: number) =>
    status === 'skipped' ? target[slot] : placed[slot] !== undefined ? tiles[placed[slot]] : ''

  return (
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {playable.length}
        </span>
      </div>
      <div className="prompt-card">
        <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
      </div>
      <div className={`slots${shake ? ' is-wrong' : ''}${status === 'right' ? ' is-right' : ''}${status === 'skipped' ? ' is-revealed' : ''}`} aria-live="polite">
        {words.map((slots, w) => (
          <span key={w} className="slot-word">
            {slots.map(({ slot }) => (
              <span key={slot} className={slotText(slot) ? 'slot is-filled' : 'slot'}>
                {slotText(slot)}
              </span>
            ))}
          </span>
        ))}
      </div>
      {status === 'playing' ? (
        <>
          <div className="letter-tiles">
            {tiles.map((t, i) => (
              <button key={i} type="button" className="letter-tile" disabled={placed.includes(i)} onClick={() => tap(i)}>
                {t}
              </button>
            ))}
          </div>
          <div className="row-center wrap">
            <button type="button" className="btn" onClick={undo} disabled={!placed.length}>
              Undo
            </button>
            <button type="button" className="btn" onClick={() => setPlaced([])} disabled={!placed.length}>
              Clear
            </button>
            <button type="button" className="btn" onClick={() => place(hintStep(tiles, placed, target))}>
              Hint
            </button>
            <button type="button" className="btn" onClick={skip}>
              Skip
            </button>
          </div>
          <p className="muted small center">Tap the letters in order, or type them. Backspace undoes.</p>
        </>
      ) : (
        <div className={`feedback ${status === 'right' ? 'fb-correct' : 'fb-wrong'}`}>
          <strong>{status === 'right' ? 'Correct' : 'Skipped'}</strong>
          {status === 'skipped' && (
            <p>
              Answer: <strong>{item.answer}</strong>
            </p>
          )}
          <div className="row-end">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              Next <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
