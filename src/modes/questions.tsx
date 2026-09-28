import { useEffect, useRef, useState } from 'react'
import { checkAnswer, type Verdict } from '../lib/answer'
import { textSizeClass } from '../lib/format'
import type { StudyItem } from '../lib/session'
import type { Settings } from '../types'
import { useHotkeys } from './hooks'

// One question each, shared by Multiple Choice, Writing and Learn.
// Mount with a fresh `key` per question. `onAnswer` records the result; `onNext` moves on.

interface QuestionProps {
  item: StudyItem
  onAnswer: (correct: boolean) => void
  onNext: () => void
}

export function PromptCard({ text }: { text: string }) {
  return (
    <div className="prompt-card">
      <span className={textSizeClass(text)}>{text}</span>
    </div>
  )
}

/** Four options; a right pick moves on by itself, a wrong one waits for Next. */
export function ChoiceQuestion({ item, options, onAnswer, onNext }: QuestionProps & { options: string[] }) {
  const [picked, setPicked] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const correctIndex = options.indexOf(item.answer.trim())

  function next() {
    window.clearTimeout(timer.current)
    onNext()
  }

  function pick(n: number) {
    if (picked !== null || n >= options.length) return
    setPicked(n)
    const ok = n === correctIndex
    onAnswer(ok)
    if (ok) timer.current = window.setTimeout(onNext, 800)
  }

  useHotkeys({
    '1': () => pick(0),
    '2': () => pick(1),
    '3': () => pick(2),
    '4': () => pick(3),
    Enter: () => (picked !== null ? next() : false),
    ' ': () => (picked !== null ? next() : false),
  })

  return (
    <>
      <PromptCard text={item.prompt} />
      <div className="choices">
        {options.map((o, n) => {
          const state =
            picked === null ? '' : n === correctIndex ? ' is-right' : n === picked ? ' is-wrong' : ' is-dim'
          return (
            <button key={n} type="button" className={`choice${state}`} onClick={() => pick(n)} aria-disabled={picked !== null}>
              <kbd>{n + 1}</kbd>
              <span>{o}</span>
            </button>
          )
        })}
      </div>
      {picked !== null && picked !== correctIndex && (
        <button type="button" className="btn btn-primary btn-block" onClick={next}>
          Next <kbd>Enter</kbd>
        </button>
      )}
    </>
  )
}

/** Type the answer. The result is recorded on Next, so "I was right" can still change it. */
export function WriteQuestion({ item, settings, onAnswer, onNext }: QuestionProps & { settings: Settings }) {
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [override, setOverride] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  function next() {
    onAnswer(override || verdict !== 'wrong')
    onNext()
  }

  function submit() {
    if (verdict) next()
    else setVerdict(checkAnswer(input, item.answer, settings))
  }

  // Enter inside the input submits the form; this covers focus elsewhere (e.g. after "I was right").
  useHotkeys({ Enter: () => (verdict ? next() : false) })

  const shown = override ? 'correct' : verdict
  return (
    <>
      <PromptCard text={item.prompt} />
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
    </>
  )
}
