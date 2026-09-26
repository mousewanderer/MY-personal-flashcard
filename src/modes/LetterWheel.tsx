import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { checkAnswer, type Verdict } from '../lib/answer'
import { textSizeClass } from '../lib/format'
import { initialOf, nextPending, pickWheel, type WheelStatus } from '../lib/games'
import { useHotkeys } from './hooks'
import { resultFrom, type ModeProps } from './types'

export default function LetterWheel({ items, settings, onAnswer, onDone }: ModeProps) {
  const ring = useMemo(() => pickWheel(items, (it) => it.answer), [items])
  const [statuses, setStatuses] = useState<WheelStatus[]>(() => ring.map(() => 'pending'))
  const [current, setCurrent] = useState(0)
  const [lap, setLap] = useState(1)
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [current])

  const item = ring[current]
  const right = statuses.filter((s) => s === 'right').length
  const wrong = statuses.filter((s) => s === 'wrong').length

  function finish(final: WheelStatus[]) {
    final.forEach((s, i) => s === 'pending' && missed.current.add(ring[i].card.id))
    const right = final.filter((s) => s === 'right').length
    onDone(resultFrom(ring, missed.current, startedAt, `${right} of ${ring.length} letters right in ${lap} ${lap === 1 ? 'lap' : 'laps'}`))
  }

  function moveOn(st: WheelStatus[]) {
    const n = nextPending(st, current)
    if (n < 0) {
      finish(st)
      return
    }
    if (n <= current) setLap(lap + 1)
    setCurrent(n)
    setInput('')
    setVerdict(null)
  }

  function submit() {
    if (verdict) {
      moveOn(statuses)
      return
    }
    const v = checkAnswer(input, item.answer, settings)
    const ok = v !== 'wrong'
    setVerdict(v)
    if (!ok) missed.current.add(item.card.id)
    void onAnswer(item, ok)
    setStatuses(statuses.map((s, i) => (i === current ? (ok ? 'right' : 'wrong') : s)))
  }

  useHotkeys({ Enter: () => (verdict ? moveOn(statuses) : false) })

  return (
    <div className="mode">
      <div className="progress-line">
        <span>Lap {lap}</span>
        <span>
          <span className="ok-text">{right} right</span> · <span className="bad-text">{wrong} wrong</span> · {ring.length - right - wrong} left
        </span>
      </div>
      <div className="wheel" style={{ '--n': ring.length } as CSSProperties} aria-hidden="true">
        {ring.map((it, i) => (
          <span
            key={it.key}
            className={`wheel-letter is-${statuses[i]}${i === current ? ' is-current' : ''}`}
            style={{ '--i': i } as CSSProperties}
          >
            {initialOf(it.answer)}
          </span>
        ))}
        <div className="wheel-center">
          <strong>{initialOf(item.answer)}</strong>
        </div>
      </div>
      <div className="prompt-card">
        <div>
          <p className="muted small">Starts with {initialOf(item.answer)}</p>
          <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
        </div>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          ref={inputRef}
          className={`input input-lg${verdict ? ` fb-border-${verdict}` : ''}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          readOnly={!!verdict}
          placeholder="Type the answer"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your answer"
        />
        {!verdict && (
          <div className="row-between">
            <button type="button" className="btn btn-ghost" onClick={() => finish(statuses)}>
              End game
            </button>
            <div className="row">
              <button type="button" className="btn" onClick={() => moveOn(statuses)} disabled={nextPending(statuses, current) === current}>
                Pass
              </button>
              <button type="submit" className="btn btn-primary">
                Check <kbd>Enter</kbd>
              </button>
            </div>
          </div>
        )}
      </form>
      {verdict && (
        <div className={`feedback fb-${verdict}`}>
          <strong>{verdict === 'correct' ? 'Correct' : verdict === 'almost' ? 'Almost. Counted as correct.' : 'Not quite'}</strong>
          {verdict !== 'correct' && (
            <p>
              Answer: <strong>{item.answer}</strong>
            </p>
          )}
          <div className="row-end">
            <button type="button" className="btn btn-primary" onClick={() => moveOn(statuses)}>
              Next <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
