import { formatDuration } from '../lib/format'
import type { SessionResult } from '../modes/types'

interface Props {
  result: SessionResult
  onRetryMissed: () => void
  onRestart: () => void
  onExit: () => void
}

export function SessionSummary({ result, onRetryMissed, onRestart, onExit }: Props) {
  return (
    <div className="mode summary">
      <h2>Session complete</h2>
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
