import { useState } from 'react'
import * as focus from '../focus/timer'
import { useFocus } from '../focus/timer'
import { clock } from '../lib/focus'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** The timer icon, with the time left once a focus session has started; opens the focus panel. */
export function FocusButton({ className = '' }: { className?: string }) {
  const { state, settings, left } = useFocus()
  const [open, setOpen] = useState(false)
  // Untouched since the last reset: just the icon. Otherwise the time left, even while paused.
  const idle = !state.running && state.rounds === 0 && state.phase === 'focus' && left === settings.focusMin * 60_000
  return (
    <>
      <button
        type="button"
        className={`focus-btn${state.running ? ' is-running' : ''}${state.phase === 'break' ? ' is-break' : ''} ${className}`}
        aria-label={idle ? 'Focus timer' : `Focus timer, ${clock(left)} left`}
        onClick={() => setOpen(true)}
      >
        <Icon name="timer" />
        {!idle && <span className="focus-left">{clock(left)}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Focus timer">
        <FocusPanel />
      </Modal>
    </>
  )
}

function FocusPanel() {
  const { state, settings, left } = useFocus()
  return (
    <div className="stack focus-panel">
      <div className={`focus-clock${state.phase === 'break' ? ' is-break' : ''}`}>
        <span className="focus-phase">{state.phase === 'focus' ? 'Focus' : 'Break'}</span>
        <strong>{clock(left)}</strong>
        <span className="muted small">
          {state.rounds} focus {state.rounds === 1 ? 'session' : 'sessions'} done
        </span>
      </div>
      <div className="row-center">
        {state.running ? (
          <button type="button" className="btn btn-primary" onClick={focus.pause}>
            <Icon name="pause" /> Pause
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={focus.start}>
            <Icon name="play" /> Start
          </button>
        )}
        <button type="button" className="btn" onClick={focus.skip}>
          <Icon name="next" /> {state.phase === 'focus' ? 'Take a break' : 'Back to focus'}
        </button>
        <button type="button" className="btn" onClick={focus.reset}>
          Reset
        </button>
      </div>
      <div className="focus-settings">
        <label className="field">
          <span>Focus (minutes)</span>
          <input
            className="input"
            type="number"
            min={1}
            max={180}
            value={settings.focusMin}
            onChange={(e) => focus.saveSettings({ focusMin: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Break (minutes)</span>
          <input
            className="input"
            type="number"
            min={1}
            max={180}
            value={settings.breakMin}
            onChange={(e) => focus.saveSettings({ breakMin: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={settings.music} onChange={(e) => focus.saveSettings({ music: e.target.checked })} />
        <span>Play my music during focus and pause it during breaks</span>
      </label>
      <p className="muted small">The timer keeps running while you study. A beep marks the end of each phase.</p>
    </div>
  )
}
