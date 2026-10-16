import { useMemo, useRef, useState } from 'react'
import { textSizeClass } from '../lib/format'
import { canScramble, emptySlots, hintStep, isFull, isUnscrambled, scrambleChars, scrambleTiles, undoSlot, type Placed } from '../lib/games'
import { useHotkeys } from './hooks'
import { NotPlayable } from './NotPlayable'
import { ScrambleBoard } from './ScrambleBoard'
import { resultFrom, type ModeProps } from './types'

type Status = 'playing' | 'right' | 'skipped'

export default function WordScramble({ setId, items, onAnswer, onDone }: ModeProps) {
  const playable = useMemo(() => items.filter((it) => canScramble(it.answer)), [items])
  const [index, setIndex] = useState(0)
  const [tiles, setTiles] = useState(() => (playable[0] ? scrambleTiles(playable[0].answer) : []))
  const [placed, setPlaced] = useState<Placed>(() => emptySlots(playable[0] ? scrambleChars(playable[0].answer).length : 0))
  const [status, setStatus] = useState<Status>('playing')
  const [shake, setShake] = useState(false)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())

  const item = playable[index]
  const target = item ? scrambleChars(item.answer) : []
  const playing = !!item && status === 'playing'

  function change(next: Placed) {
    if (!playing) return
    setPlaced(next)
    if (!isFull(next)) return
    if (isUnscrambled(tiles, next, target)) {
      setStatus('right')
      void onAnswer(item, true)
    } else {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
    }
  }

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
    const answer = playable[index + 1].answer
    setIndex(index + 1)
    setTiles(scrambleTiles(answer))
    setPlaced(emptySlots(scrambleChars(answer).length))
    setStatus('playing')
  }

  useHotkeys({ Enter: () => (status !== 'playing' ? next() : false) })

  if (!item) {
    return <NotPlayable setId={setId} message="None of these answers fit this game (it needs answers of 2 to 24 letters). Try the Back → Front direction." />
  }

  const empty = !placed.some((p) => p !== null)

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
      <ScrambleBoard
        answer={item.answer}
        tiles={tiles}
        placed={placed}
        target={target}
        status={status === 'skipped' ? 'revealed' : status}
        shake={shake}
        onChange={change}
      />
      {status === 'playing' ? (
        <>
          <div className="row-center wrap">
            <button type="button" className="btn" onClick={() => change(undoSlot(placed))} disabled={empty}>
              Undo
            </button>
            <button type="button" className="btn" onClick={() => setPlaced(emptySlots(target.length))} disabled={empty}>
              Clear
            </button>
            <button type="button" className="btn" onClick={() => change(hintStep(tiles, placed, target))}>
              Hint
            </button>
            <button type="button" className="btn" onClick={skip}>
              Skip
            </button>
          </div>
          <p className="muted small center">Tap the letters in order, or type them. Tap a placed letter to take it back.</p>
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
