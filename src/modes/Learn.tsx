import { useMemo, useRef, useState } from 'react'
import { itemChoices } from '../lib/choices'
import { advance, learnProgress, nextRound, questionKind, type LearnStage, type QuestionKind } from '../lib/learn'
import type { StudyItem } from '../lib/session'
import { useHotkeys } from './hooks'
import { ChoiceQuestion, WriteQuestion } from './questions'
import { resultFrom, type ModeProps } from './types'

interface Question {
  item: StudyItem
  kind: QuestionKind
}

function LearnBar({ learned, familiar, total }: { learned: number; familiar: number; total: number }) {
  return (
    <div className="bar learn-bar" aria-hidden="true">
      <span style={{ width: `${(learned / total) * 100}%` }} />
      <span className="is-familiar" style={{ width: `${(familiar / total) * 100}%` }} />
    </div>
  )
}

/** Rounds of up to 7 cards: multiple choice first, then typed, until every card is learned. */
export default function Learn({ items, allCards, settings, onAnswer, onDone }: ModeProps) {
  const choices = useMemo(
    () => new Map(items.map((it) => [it.key, itemChoices(it, allCards, Math.random)])),
    [items, allCards],
  )
  const keys = useMemo(() => items.map((it) => it.key), [items])
  // Handlers read the ref (Writing answers and moves on in the same click); rendering reads the state copy.
  const stages = useRef(new Map<string, LearnStage>())
  const [shown, setShown] = useState(() => new Map<string, LearnStage>())
  // Each question's kind is fixed when the round starts, so a right pick does not turn it into typing.
  const buildRound = (s: Map<string, LearnStage>): Question[] =>
    nextRound(items, s).map((item) => ({ item, kind: questionKind(s.get(item.key) ?? 0, choices.get(item.key)!.length) }))
  const [round, setRound] = useState(() => buildRound(new Map()))
  const [roundNo, setRoundNo] = useState(1)
  const [pos, setPos] = useState(0)
  const [between, setBetween] = useState(false)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())

  const progress = learnProgress(keys, shown)
  const { item, kind } = round[pos]

  function answer(ok: boolean) {
    if (!ok) missed.current.add(item.card.id)
    stages.current.set(item.key, advance(stages.current.get(item.key) ?? 0, ok))
    setShown(new Map(stages.current))
    void onAnswer(item, ok)
  }

  function next() {
    if (pos + 1 < round.length) {
      setPos(pos + 1)
      return
    }
    if (learnProgress(keys, stages.current).learned === keys.length) {
      onDone(resultFrom(items, missed.current, startedAt))
      return
    }
    setBetween(true)
  }

  function nextRoundNow() {
    setRound(buildRound(stages.current))
    setRoundNo(roundNo + 1)
    setPos(0)
    setBetween(false)
  }

  useHotkeys({ Enter: nextRoundNow, ' ': nextRoundNow }, between)

  if (between) {
    return (
      <div className="mode">
        <div className="learn-round">
          <h2>Round {roundNo} done</h2>
          <p className="learn-count">
            <strong>{progress.learned}</strong> of {progress.total} learned
          </p>
          <LearnBar {...progress} />
          <p className="muted small">
            {progress.familiar > 0 && `${progress.familiar} more ${progress.familiar === 1 ? 'is' : 'are'} halfway: next you type them. `}
            Cards you missed come back first.
          </p>
          <button type="button" className="btn btn-primary" onClick={nextRoundNow}>
            Continue <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mode">
      <div className="progress-line">
        <span>Round {roundNo}</span>
        <span>
          {progress.learned} / {progress.total} learned
        </span>
      </div>
      <LearnBar {...progress} />
      <p className="learn-kind">{kind === 'choice' ? 'Pick the answer' : 'Type the answer'}</p>
      {kind === 'choice' ? (
        <ChoiceQuestion key={`${roundNo}:${pos}`} item={item} options={choices.get(item.key)!} onAnswer={answer} onNext={next} />
      ) : (
        <WriteQuestion key={`${roundNo}:${pos}`} item={item} settings={settings} onAnswer={answer} onNext={next} />
      )}
    </div>
  )
}
