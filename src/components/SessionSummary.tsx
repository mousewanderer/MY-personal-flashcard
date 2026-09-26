import { useXp } from '../db/hooks'
import { formatDuration } from '../lib/format'
import { levelFromXp } from '../lib/profile'
import type { SessionResult } from '../modes/types'
import { Icon } from './Icon'

interface Props {
  result: SessionResult
  /** When this run started; answers logged since then count as this session's XP. */
  since: number
  onRetryMissed: () => void
  onRestart: () => void
  onExit: () => void
}

export function SessionSummary({ result, since, onRetryMissed, onRestart, onExit }: Props) {
  return (
    <div className="mode summary">
      <h2>Session complete</h2>
      <XpGain since={since} />
      <div className="stat-grid">
        <div className="stat stat-ok">
          <strong>{result.correct}</strong>
          <span>Correct</span>
        </div>
        <div className="stat stat-bad">
          <strong>{result.wrong}</strong>
          <span>Wrong</span>
        </div>
        <div className="stat">
          <strong>{formatDuration(result.ms)}</strong>
          <span>Time</span>
        </div>
      </div>
      {result.note && <p className="center muted">{result.note}</p>}
      {result.missed.length > 0 && (
        <>
          <h3>Missed cards</h3>
          <ul className="missed">
            {result.missed.map((c) => (
              <li key={c.id}>
                <span>{c.front}</span>
                <span className="muted">{c.back}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="row-center wrap">
        {result.missed.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={onRetryMissed}>
            Study missed cards again
          </button>
        )}
        <button type="button" className="btn" onClick={onRestart}>
          Start over
        </button>
        <button type="button" className="btn" onClick={onExit}>
          Back to set
        </button>
      </div>
    </div>
  )
}

function XpGain({ since }: { since: number }) {
  const xp = useXp(since)
  if (!xp || xp.earned === 0) return null
  const now = levelFromXp(xp.total)
  const leveledUp = levelFromXp(xp.total - xp.earned).level < now.level
  return (
    <div className="panel xp-gain">
      <div className="row-between">
        <strong className="xp-earned">
          <Icon name="bolt" /> +{xp.earned} XP
        </strong>
        <span className="small muted">
          Level {now.level} · {now.into} / {now.needed}
        </span>
      </div>
      <div className="bar xp-bar">
        <span style={{ width: `${Math.round((now.into / now.needed) * 100)}%` }} />
      </div>
      {leveledUp && (
        <p className="level-up">
          Level up: you reached level {now.level}, {now.title}.
        </p>
      )}
    </div>
  )
}
