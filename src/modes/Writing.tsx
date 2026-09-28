import { useRef, useState } from 'react'
import { WriteQuestion } from './questions'
import { resultFrom, type ModeProps } from './types'

export default function Writing({ items, settings, onAnswer, onDone }: ModeProps) {
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
      <WriteQuestion
        key={index}
        item={item}
        settings={settings}
        onAnswer={(ok) => {
          if (!ok) missed.current.add(item.card.id)
          void onAnswer(item, ok)
        }}
        onNext={next}
      />
    </div>
  )
}
