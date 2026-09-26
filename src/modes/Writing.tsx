import { useEffect, useRef, useState } from 'react'
import { checkAnswer, type Verdict } from '../lib/answer'
import { textSizeClass } from '../lib/format'
import { useHotkeys } from './hooks'
import { resultFrom, type ModeProps } from './types'

export default function Writing({ items, settings, onAnswer, onDone }: ModeProps) {
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [override, setOverride] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const item = items[index]

  useEffect(() => inputRef.current?.focus(), [index])

  // The answer is recorded on Next, so "I was right" can still change it.
  function next() {
    const ok = override || verdict !== 'wrong'
    if (!ok) missed.current.add(item.card.id)
    void onAnswer(item, ok)
    if (index + 1 >= items.length) {
      onDone(resultFrom(items, missed.current, startedAt))
      return
    }
    setIndex(index + 1)
    setInput('')
    setVerdict(null)
    setOverride(false)
  }

  function submit() {
    if (verdict) next()
    else setVerdict(checkAnswer(input, item.answer, settings))
  }

  // Enter inside the input submits the form; this covers focus elsewhere (e.g. after "I was right").
  useHotkeys({ Enter: () => (verdict ? next() : false) })

  const shown = override ? 'correct' : verdict
  return (
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="prompt-card">
        <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
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
          className={`input input-lg${shown ? ` fb-border-${shown}` : ''}`}
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
          <div className="row-end">
            <button type="button" className="btn" onClick={() => setVerdict('wrong')}>
              I don't know
            </button>
            <button type="submit" className="btn btn-primary">
              Check <kbd>Enter</kbd>
            </button>
          </div>
        )}
      </form>
      {verdict && shown && (
        <div className={`feedback fb-${shown}`}>
          <strong>
            {override ? 'Marked correct' : verdict === 'correct' ? 'Correct' : verdict === 'almost' ? 'Almost. Counted as correct.' : 'Not quite'}
          </strong>
          {verdict !== 'correct' && (
            <p>
              Answer: <strong>{item.answer}</strong>
            </p>
          )}
          <div className="row-end">
            {verdict === 'wrong' && !override && (
              <button type="button" className="btn" onClick={() => setOverride(true)}>
                I was right
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={next}>
              Next <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
