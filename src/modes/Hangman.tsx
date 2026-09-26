import { useMemo, useRef, useState } from 'react'
import { textSizeClass } from '../lib/format'
import { HANGMAN_LIVES, answerWords, canHangman, fold, isSolved, keyboardFor, lettersOf, maskAnswer, wrongCount } from '../lib/games'
import { useHotkeys } from './hooks'
import { NotPlayable } from './NotPlayable'
import { resultFrom, type ModeProps } from './types'

export default function Hangman({ setId, items, onAnswer, onDone }: ModeProps) {
  const playable = useMemo(() => items.filter((it) => canHangman(it.answer)), [items])
  const [index, setIndex] = useState(0)
  const [guessed, setGuessed] = useState(() => new Set<string>())
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())

  const item = playable[index]
  const answer = item?.answer ?? ''
  const wrong = wrongCount(answer, guessed)
  const solved = !!item && isSolved(answer, guessed)
  const lost = wrong >= HANGMAN_LIVES
  const over = solved || lost

  function guess(letter: string) {
    if (!item || over || guessed.has(letter)) return
    const g = new Set(guessed).add(letter)
    setGuessed(g)
    if (isSolved(answer, g)) void onAnswer(item, true)
    else if (wrongCount(answer, g) >= HANGMAN_LIVES) {
      missed.current.add(item.card.id)
      void onAnswer(item, false)
    }
  }

  function next() {
    if (index + 1 >= playable.length) {
      onDone(resultFrom(playable, missed.current, startedAt))
      return
    }
    setIndex(index + 1)
    setGuessed(new Set())
  }

  useHotkeys({
    Enter: () => (over ? next() : false),
    '*': (e) => {
      const letter = fold(e.key)
      if (over || !/\p{L}/u.test(letter)) return false
      guess(letter)
    },
  })

  if (!item) {
    return <NotPlayable setId={setId} message="None of these answers fit Hangman (it needs answers with letters, up to 40 characters)." />
  }

  const letters = lettersOf(answer)
  const mask = maskAnswer(answer, guessed)

  return (
    <div className="mode">
      <div className="progress-line">
        <span>
          {index + 1} / {playable.length}
        </span>
        <span>
          Lives: <strong>{HANGMAN_LIVES - wrong}</strong> / {HANGMAN_LIVES}
        </span>
      </div>
      <div className="prompt-card">
        <span className={textSizeClass(item.prompt)}>{item.prompt}</span>
      </div>
      <div className="hangman-board">
        <Gallows wrong={wrong} />
        <div className="slots" aria-label="Answer so far">
          {answerWords(answer).map((word, i) => (
            <span key={i} className="slot-word">
              {word.map(({ raw }) => {
                const m = mask[raw]
                const cls = m.shown ? 'slot is-filled' : over ? 'slot is-missing' : 'slot'
                return (
                  <span key={raw} className={cls}>
                    {m.shown || over ? m.ch : ''}
                  </span>
                )
              })}
            </span>
          ))}
        </div>
      </div>
      {over ? (
        <div className={`feedback ${solved ? 'fb-correct' : 'fb-wrong'}`}>
          <strong>{solved ? 'Solved' : 'Out of lives'}</strong>
          {!solved && (
            <p>
              Answer: <strong>{answer}</strong>
            </p>
          )}
          <div className="row-end">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              Next <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      ) : (
        <div className="keyboard">
          {keyboardFor(answer).map((l) => {
            const used = guessed.has(l)
            const cls = !used ? 'key' : letters.has(l) ? 'key is-hit' : 'key is-miss'
            return (
              <button key={l} type="button" className={cls} disabled={used} onClick={() => guess(l)} aria-label={`Guess ${l}`}>
                {l.toLocaleUpperCase()}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Gallows({ wrong }: { wrong: number }) {
  return (
    <svg className="gallows" viewBox="0 0 120 130" role="img" aria-label={`${wrong} of ${HANGMAN_LIVES} wrong guesses`}>
      <path d="M10 125h60M30 125V8h55v14" />
      {wrong > 0 && <circle cx="85" cy="32" r="10" />}
      {wrong > 1 && <path d="M85 42v36" />}
      {wrong > 2 && <path d="M85 52l-16 12" />}
      {wrong > 3 && <path d="M85 52l16 12" />}
      {wrong > 4 && <path d="M85 78l-14 20" />}
      {wrong > 5 && <path d="M85 78l14 20" />}
    </svg>
  )
}
