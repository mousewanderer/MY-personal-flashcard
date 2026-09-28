import { useRef, useState } from 'react'
import { textSizeClass } from '../lib/format'
import { previewWith } from '../lib/fsrs'
import { RATINGS, formatInterval, initialReview } from '../lib/scheduler'
import type { Rating } from '../types'
import { useHotkeys } from './hooks'
import { resultFrom, type ModeProps } from './types'

const LABELS: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

export default function Flashcards({ items, reviews, settings, practiceAhead, onAnswer, onDone }: ModeProps) {
  const [queue, setQueue] = useState(items)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [startedAt] = useState(Date.now)
  const busy = useRef(false)
  const missed = useRef(new Set<string>())
  const item = queue[index]
  // Intervals are relative, so any fixed reference time gives the same labels.
  const preview =
    item && !practiceAhead
      ? previewWith(settings.scheduler, reviews.get(item.card.id) ?? initialReview(item.card.id), startedAt)
      : null

  async function rate(rating: Rating) {
    if (!item || !flipped || busy.current) return
    busy.current = true
    if (rating === 'again') missed.current.add(item.card.id)
    const next = await onAnswer(item, rating !== 'again', rating)
    busy.current = false
    // Cards still in (re)learning come back later in this session.
    const again = next ? next.srsState === 'learning' || next.srsState === 'relearning' : rating === 'again'
    const q = again ? [...queue, { ...item, key: `${item.key}+` }] : queue
    if (index + 1 >= q.length) {
      onDone(resultFrom(items, missed.current, startedAt))
      return
    }
    setQueue(q)
    setIndex(index + 1)
    setFlipped(false)
  }

  useHotkeys({
    ' ': () => setFlipped((f) => !f),
    '1': () => void rate('again'),
    '2': () => void rate('hard'),
    '3': () => void rate('good'),
    '4': () => void rate('easy'),
  })

  if (!item) return null
  return (
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {queue.length}
        </span>
        {practiceAhead && <span className="pill">Practice: your schedule won't change</span>}
      </div>
      <button
        key={item.key}
        type="button"
        className={flipped ? 'flip is-flipped' : 'flip'}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show front' : 'Show answer'}
      >
        <span className="flip-inner">
          <span className="flip-face" aria-hidden={flipped}>
            <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
          </span>
          <span className="flip-face flip-back" aria-hidden={!flipped}>
            <span className={textSizeClass(item.answer)}>{item.answer}</span>
          </span>
        </span>
      </button>
      {flipped ? (
        <div className="rating-row">
          {RATINGS.map((r, i) => (
            <button key={r} type="button" className={`btn rate rate-${r}`} onClick={() => void rate(r)}>
              <span>{LABELS[r]}</span>
              <small>{preview ? formatInterval(preview[r]) : <kbd>{i + 1}</kbd>}</small>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-block" onClick={() => setFlipped(true)}>
          Show answer <kbd>Space</kbd>
        </button>
      )}
    </div>
  )
}
