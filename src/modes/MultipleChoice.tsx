import { useEffect, useMemo, useRef, useState } from 'react'
import { buildChoices } from '../lib/choices'
import { textSizeClass } from '../lib/format'
import { useHotkeys } from './hooks'
import { resultFrom, type ModeProps } from './types'

export default function MultipleChoice({ items, allCards, onAnswer, onDone }: ModeProps) {
  const choices = useMemo(
    () =>
      items.map((it) =>
        buildChoices(
          it.answer,
          it.reversed ? [] : it.card.options, // own wrong options are written for the back
          allCards.filter((c) => c.id !== it.card.id).map((c) => (it.reversed ? c.front : c.back)),
          Math.random,
        ),
      ),
    [items, allCards],
  )
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const item = items[index]
  const options = choices[index]
  const correctIndex = options.indexOf(item.answer.trim())

  function next() {
    window.clearTimeout(timer.current)
    if (index + 1 >= items.length) {
      onDone(resultFrom(items, missed.current, startedAt))
      return
    }
    setIndex(index + 1)
    setPicked(null)
  }

  function pick(n: number) {
    if (picked !== null || n >= options.length) return
    setPicked(n)
    const ok = n === correctIndex
    if (!ok) missed.current.add(item.card.id)
    void onAnswer(item, ok)
    if (ok) timer.current = window.setTimeout(next, 800)
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
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="prompt-card">
        <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
      </div>
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
    </div>
  )
}
