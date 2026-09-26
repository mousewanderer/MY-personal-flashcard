import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useConfirm } from '../components/useConfirm'
import { SessionSummary } from '../components/SessionSummary'
import { db } from '../db/db'
import { useSettings } from '../db/hooks'
import { getSettings, newCardsIntroducedToday, recordAnswer, reviewsFor, setCards } from '../db/repo'
import { buildItems, buildReviewQueue, type SessionOptions, type StudyItem } from '../lib/session'
import { useHotkeys } from '../modes/hooks'
import { modeById } from '../modes/registry'
import type { SessionResult } from '../modes/types'
import { navigate } from '../router'
import type { Card, CardSet, Direction, Rating, ReviewState } from '../types'

interface Props {
  setId: string
  modeId: string
  direction: Direction
  shuffle: boolean
  starredOnly: boolean
}

interface Loaded {
  set: CardSet
  cards: Card[]
  pool: Card[]
}

interface Run {
  id: number
  items: StudyItem[]
  practiceAhead: boolean
}

export default function StudyPage({ setId, modeId, direction, shuffle, starredOnly }: Props) {
  const mode = modeById(modeId)
  const options = useMemo<SessionOptions>(() => ({ direction, shuffle }), [direction, shuffle])
  const settings = useSettings()
  const [loaded, setLoaded] = useState<Loaded | null | 'missing'>(null)
  const [reviews, setReviews] = useState(new Map<string, ReviewState>())
  const [run, setRun] = useState<Run | null>(null)
  const [nothingDue, setNothingDue] = useState(false)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [answered, setAnswered] = useState(0)
  const [confirmEl, confirm] = useConfirm()

  const begin = useCallback(
    async (pool: Card[], practiceAhead: boolean, runId: number) => {
      let cards = pool
      const scheduled = modeId === 'flashcards' && !practiceAhead
      if (scheduled) {
        const s = await getSettings()
        const remaining = s.dailyNewLimit - (await newCardsIntroducedToday())
        cards = buildReviewQueue(pool, await reviewsFor(pool.map((c) => c.id)), Date.now(), remaining)
      }
      setNothingDue(scheduled && cards.length === 0 && pool.length > 0)
      setResult(null)
      setAnswered(0)
      setRun({ id: runId, items: buildItems(cards, options), practiceAhead })
    },
    [modeId, options],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const set = await db.sets.get(setId)
      if (!set || set.deleted) {
        if (!cancelled) setLoaded('missing')
        return
      }
      const cards = await setCards(setId)
      const pool = starredOnly ? cards.filter((c) => c.starred) : cards
      const r = await reviewsFor(cards.map((c) => c.id))
      if (cancelled) return
      setReviews(r)
      setLoaded({ set, cards, pool })
      await begin(pool, false, 1)
    })()
    return () => {
      cancelled = true
    }
  }, [setId, starredOnly, begin])

  const onAnswer = useCallback(
    async (item: StudyItem, correct: boolean, rating?: Rating) => {
      setAnswered((n) => n + 1)
      const next = await recordAnswer({ card: item.card, mode: modeId, correct, rating, practiceAhead: run?.practiceAhead })
      if (next) setReviews((m) => new Map(m).set(next.cardId, next))
      return next
    },
    [modeId, run?.practiceAhead],
  )

  async function leave() {
    const inProgress = answered > 0 && !result
    if (!inProgress || (await confirm('Leave this session? Answers so far are saved.', 'Leave'))) navigate(`/set/${setId}`)
  }

  useHotkeys({ Escape: () => void leave() })

  if (!mode || loaded === 'missing') {
    return (
      <div className="page empty">
        <p>{mode ? 'This set no longer exists.' : 'Unknown study mode.'}</p>
        <a className="btn" href="#/">
          Back to My Sets
        </a>
      </div>
    )
  }

  const Mode = mode.component
  let body
  if (!loaded) body = <p className="muted center">Loading…</p>
  else if (result && run) {
    body = (
      <SessionSummary
        result={result}
        onRetryMissed={() => void begin(result.missed, run.practiceAhead, run.id + 1)}
        onRestart={() => void begin(loaded.pool, run.practiceAhead, run.id + 1)}
        onExit={() => navigate(`/set/${setId}`)}
      />
    )
  } else if (nothingDue) {
    body = (
      <div className="mode empty">
        <h2>Nothing due right now</h2>
        <p className="muted">
          You're done for today. You can still practice every card; that won't change your schedule.
        </p>
        <div className="row-center">
          <button type="button" className="btn btn-primary" onClick={() => void begin(loaded.pool, true, 1)}>
            Practice all cards
          </button>
          <button type="button" className="btn" onClick={() => navigate(`/set/${setId}`)}>
            Back to set
          </button>
        </div>
      </div>
    )
  } else if (run && run.items.length < mode.minCards) {
    body = (
      <div className="mode empty">
        <p>
          {mode.name} needs at least {mode.minCards} cards{starredOnly ? ' (starred only is on)' : ''}.
        </p>
        <button type="button" className="btn" onClick={() => navigate(`/set/${setId}`)}>
          Back to set
        </button>
      </div>
    )
  } else if (run) {
    body = (
      <Mode
        key={run.id}
        setId={setId}
        items={run.items}
        allCards={loaded.cards}
        settings={settings}
        reviews={reviews}
        practiceAhead={run.practiceAhead}
        onAnswer={onAnswer}
        onDone={setResult}
      />
    )
  }

  return (
    <div className="study">
      <header className="study-head">
        <button type="button" className="icon-btn" aria-label="Leave session" onClick={() => void leave()}>
          <Icon name="close" />
        </button>
        <div className="study-title">
          <strong>{mode.name}</strong>
          <span className="muted">{loaded ? loaded.set.title : ''}</span>
        </div>
      </header>
      {body}
      {confirmEl}
    </div>
  )
}
