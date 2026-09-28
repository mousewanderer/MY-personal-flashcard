import { useEffect, useRef, useState } from 'react'
import { FocusButton } from '../components/FocusButton'
import { Icon } from '../components/Icon'
import { MusicButton } from '../components/MiniPlayer'
import { SessionSummary } from '../components/SessionSummary'
import { cardsForTag, dailyLogs, getSettings, recordAnswer, reviewsFor } from '../db/repo'
import { itemChoices } from '../lib/choices'
import { DAILY_MIN_CARDS, DAILY_MODE, DAILY_SIZE, dailySeed, dailyStatus, pickDaily, seededRng, type DailyStatus } from '../lib/daily'
import { questionKind, type QuestionKind } from '../lib/learn'
import { buildItems, type StudyItem } from '../lib/session'
import { useHotkeys } from '../modes/hooks'
import { ChoiceQuestion, WriteQuestion } from '../modes/questions'
import { resultFrom, type SessionResult } from '../modes/types'
import { setBackHandler } from '../platform/backButton'
import { navigate } from '../router'
import type { Card, Settings } from '../types'

interface Question {
  item: StudyItem
  kind: QuestionKind
  options: string[]
}

interface Loaded {
  questions: Question[]
  settings: Settings
  status: DailyStatus
}

const streakText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Ten questions a day from every set: multiple choice and typed answers take turns. */
export default function DailyPage() {
  const [loaded, setLoaded] = useState<Loaded | 'few' | null>(null)
  const [pos, setPos] = useState(0)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [startedAt] = useState(Date.now)
  const missed = useRef(new Set<string>())
  const asked = useRef<StudyItem[]>([])
  // Answers are saved in order; the summary waits for the last one so its score counts every answer.
  const saving = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const now = Date.now()
      const cards: Card[] = await cardsForTag(null)
      if (cards.length < DAILY_MIN_CARDS) {
        if (!cancelled) setLoaded('few')
        return
      }
      const [settings, reviews, logs] = await Promise.all([getSettings(), reviewsFor(cards.map((c) => c.id)), dailyLogs()])
      const rng = seededRng(`${dailySeed(now)}:questions`)
      const items = buildItems(pickDaily(cards, reviews, now), { direction: settings.defaultDirection, shuffle: false }, rng)
      const questions = items.map((item, i): Question => {
        const options = itemChoices(item, cards, rng)
        return { item, options, kind: i % 2 === 0 ? questionKind(0, options.length) : 'write' }
      })
      const status = dailyStatus(logs, now)
      if (cancelled) return
      setLoaded({ questions, settings, status })
      // Pick up where an unfinished challenge left off.
      setPos(Math.min(status.answeredToday, questions.length))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const leave = () => navigate('/')
  useHotkeys({ Escape: leave })
  useEffect(() => {
    setBackHandler(leave)
    return () => setBackHandler(null)
  }, [])

  async function finish() {
    await saving.current
    const status = dailyStatus(await dailyLogs(), Date.now())
    const note = `Daily challenge: ${status.scoreToday} / ${DAILY_SIZE}. Streak: ${streakText(status.streak)}.`
    setResult(resultFrom(asked.current, missed.current, startedAt, note))
  }

  let body
  if (!loaded) body = <p className="muted center">Loading…</p>
  else if (loaded === 'few') {
    body = (
      <div className="mode empty">
        <p>The daily challenge needs at least {DAILY_MIN_CARDS} cards across your sets.</p>
        <button type="button" className="btn" onClick={leave}>
          Back to My Sets
        </button>
      </div>
    )
  } else if (result) {
    body = <SessionSummary result={result} since={startedAt} onExit={leave} exitLabel="Back to My Sets" />
  } else if (pos >= loaded.questions.length) {
    const { status } = loaded
    body = (
      <div className="mode">
        <div className="learn-round">
          <h2>Done for today</h2>
          <p className="learn-count">
            <strong>{status.scoreToday}</strong> of {DAILY_SIZE} right
          </p>
          <p className="muted">
            Streak: {streakText(status.streak)}. A new challenge is ready tomorrow.
          </p>
          <button type="button" className="btn btn-primary" onClick={leave}>
            Back to My Sets
          </button>
        </div>
      </div>
    )
  } else {
    const { item, kind, options } = loaded.questions[pos]
    const answer = (ok: boolean) => {
      if (!ok) missed.current.add(item.card.id)
      asked.current.push(item)
      saving.current = saving.current.then(() => recordAnswer({ card: item.card, mode: DAILY_MODE, correct: ok }))
    }
    const next = () => {
      if (pos + 1 >= loaded.questions.length) void finish()
      else setPos(pos + 1)
    }
    body = (
      <div className="mode">
        <div className="progress-line">
          <span>
            Question {pos + 1} / {loaded.questions.length}
          </span>
          <span>Streak: {streakText(loaded.status.streak)}</span>
        </div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${(pos / loaded.questions.length) * 100}%` }} />
        </div>
        <p className="learn-kind">{kind === 'choice' ? 'Pick the answer' : 'Type the answer'}</p>
        {kind === 'choice' ? (
          <ChoiceQuestion key={pos} item={item} options={options} onAnswer={answer} onNext={next} />
        ) : (
          <WriteQuestion key={pos} item={item} settings={loaded.settings} onAnswer={answer} onNext={next} />
        )}
      </div>
    )
  }

  return (
    <div className="study">
      <header className="study-head">
        <button type="button" className="icon-btn" aria-label="Leave the daily challenge" onClick={leave}>
          <Icon name="close" />
        </button>
        <div className="study-title">
          <strong>Daily challenge</strong>
          <span className="muted">All your sets</span>
        </div>
        <FocusButton className="study-tools" />
        <MusicButton />
      </header>
      {body}
    </div>
  )
}
