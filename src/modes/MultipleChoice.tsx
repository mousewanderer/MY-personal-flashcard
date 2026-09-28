import { useMemo, useRef, useState } from 'react'
import { itemChoices } from '../lib/choices'
import { ChoiceQuestion } from './questions'
import { resultFrom, type ModeProps } from './types'

export default function MultipleChoice({ items, allCards, onAnswer, onDone }: ModeProps) {
  const choices = useMemo(() => items.map((it) => itemChoices(it, allCards, Math.random)), [items, allCards])
  const [index, setIndex] = useState(0)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const item = items[index]

  function next() {
    if (index + 1 >= items.length) {
      onDone(resultFrom(items, missed.current, startedAt))
      return
    }
    setIndex(index + 1)
  }

  return (
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <ChoiceQuestion
        key={index}
        item={item}
        options={choices[index]}
        onAnswer={(ok) => {
          if (!ok) missed.current.add(item.card.id)
          void onAnswer(item, ok)
        }}
        onNext={next}
      />
    </div>
  )
}
