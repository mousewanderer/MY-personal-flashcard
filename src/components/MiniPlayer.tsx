import { useEffect } from 'react'
import * as player from '../music/player'
import { usePlayer, usePlayerTime } from '../music/player'
import { Icon } from './Icon'

/** Slim player shown on every main screen while something is queued. */
export function MiniPlayer() {
  const p = usePlayer()
  const visible = p.queue.ids.length > 0

  // Lets the page leave room for the bar above the phone's bottom tabs.
  useEffect(() => {
    document.body.classList.toggle('has-mini', visible)
    return () => document.body.classList.remove('has-mini')
  }, [visible])

  if (!visible) return null
  return (
    <div className="mini-player" role="region" aria-label="Music player">
      <MiniProgress />
      <a className="mini-title" href="#/profile">
        <Icon name="music" />
        <span>{p.title || 'Queue ready'}</span>
      </a>
      <button type="button" className="icon-btn" aria-label={p.playing ? 'Pause' : 'Play'} onClick={player.toggle}>
        <Icon name={p.playing ? 'pause' : 'play'} filled />
      </button>
      <button type="button" className="icon-btn" aria-label="Next song" onClick={() => void player.next()}>
        <Icon name="next" filled />
      </button>
    </div>
  )
}

function MiniProgress() {
  const { time, duration } = usePlayerTime()
  return <span className="mini-progress" style={{ width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%` }} />
}

/** Play/pause in the study session header, where the main navigation is hidden. */
export function MusicButton() {
  const p = usePlayer()
  if (!p.queue.ids.length) return null
  return (
    <button type="button" className="icon-btn study-music" aria-label={p.playing ? 'Pause music' : 'Play music'} onClick={player.toggle}>
      <Icon name={p.playing ? 'pause' : 'music'} filled={p.playing} />
    </button>
  )
}
