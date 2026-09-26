import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import { addTracks, deleteTrack, renameTrack } from '../db/repo'
import { formatSize, formatTime, songTitle } from '../lib/queue'
import * as player from '../music/player'
import { usePlayer, usePlayerTime } from '../music/player'
import type { Track } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { RenameForm } from './RenameForm'
import { useConfirm } from './useConfirm'

/** Android pickers report audio MIME types inconsistently, so list extensions too. */
const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.flac,.weba,.webm'

type Status = { kind: 'busy' | 'done' | 'error'; text: string }

export function MusicSection() {
  const p = usePlayer()
  const tracks = useLiveQuery(() => db.tracks.orderBy('position').toArray(), [])
  const byId = useMemo(() => new Map((tracks ?? []).map((t) => [t.id, t])), [tracks])
  const queued = new Set(p.queue.ids)
  const [status, setStatus] = useState<Status | null>(null)
  const [renaming, setRenaming] = useState<Track | null>(null)
  const [confirmEl, confirm] = useConfirm()
  const input = useRef<HTMLInputElement>(null)

  async function importFiles(files: File[]) {
    setStatus({ kind: 'busy', text: `Adding ${files.length} ${files.length === 1 ? 'song' : 'songs'}…` })
    const ok: Parameters<typeof addTracks>[0] = []
    const bad: string[] = []
    for (const f of files) {
      const duration = await player.probeDuration(f)
      if (duration === null) bad.push(f.name)
      else ok.push({ title: songTitle(f.name), fileName: f.name, type: f.type, size: f.size, duration, blob: f })
    }
    try {
      if (ok.length) await addTracks(ok)
    } catch (e) {
      const full = (e as Error)?.name === 'QuotaExceededError' || (e as Error)?.name === 'AbortError'
      setStatus({ kind: 'error', text: full ? 'Not enough storage space for these songs.' : "Couldn't save these songs." })
      return
    }
    const added = `${ok.length} ${ok.length === 1 ? 'song' : 'songs'} added.`
    setStatus(
      bad.length
        ? { kind: 'error', text: `${added} This device can't play: ${bad.join(', ')}` }
        : { kind: 'done', text: added },
    )
  }

  const total = (tracks ?? []).reduce((sum, t) => sum + t.size, 0)
  const qlen = p.queue.ids.length

  return (
    <section className="panel music" aria-labelledby="music-title">
      <div className="row-between">
        <h2 className="h-small music-heading" id="music-title">
          <Icon name="music" /> Music
        </h2>
        <button type="button" className="btn" disabled={status?.kind === 'busy'} onClick={() => input.current?.click()}>
          <Icon name="import" /> Import music
        </button>
        <input
          ref={input}
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) void importFiles(files)
          }}
        />
      </div>
      {status && (
        <p className={status.kind === 'error' ? 'error small' : 'muted small'} role="status">
          {status.text}
        </p>
      )}

      {qlen > 0 && <NowPlaying />}

      {qlen > 0 && (
        <div className="music-block">
          <div className="row-between">
            <h3 className="music-sub">Queue · {qlen}</h3>
            <button type="button" className="btn btn-ghost" onClick={player.clearQueue}>
              Clear queue
            </button>
          </div>
          <ol className="track-list">
            {p.queue.ids.map((id, i) => {
              const t = byId.get(id)
              if (!t) return null
              const current = i === p.queue.index
              return (
                <li key={id} className={current ? 'track is-current' : 'track'}>
                  <button type="button" className="track-main" onClick={() => void player.playNow(id)}>
                    <span className="track-title">{t.title}</span>
                    <span className="muted small">{current ? (p.playing ? 'Playing' : 'Paused') : formatTime(t.duration)}</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => player.moveInQueue(i, -1)}>
                    <Icon name="up" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${t.title} down`} disabled={i === qlen - 1} onClick={() => player.moveInQueue(i, 1)}>
                    <Icon name="down" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${t.title} from queue`} onClick={() => player.removeFromQueue(i)}>
                    <Icon name="close" />
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className="music-block">
        <div className="row-between">
          <h3 className="music-sub">
            Library{tracks && tracks.length > 0 && ` · ${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'} · ${formatSize(total)}`}
          </h3>
          {tracks && tracks.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => void player.playAll(tracks.map((t) => t.id))}>
              <Icon name="play" filled /> Play all
            </button>
          )}
        </div>
        {tracks && tracks.length === 0 && (
          <p className="muted small">
            No songs yet. Import audio files from your device; they are saved in the app so you can listen while you study.
          </p>
        )}
        <ul className="track-list">
          {tracks?.map((t) => (
            <li key={t.id} className={t.id === p.currentId ? 'track is-current' : 'track'}>
              <button type="button" className="track-main" aria-label={`Play ${t.title}`} onClick={() => void player.playNow(t.id)}>
                <span className="track-title">{t.title}</span>
                <span className="muted small">{formatTime(t.duration)}</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={queued.has(t.id) ? `${t.title} is in the queue` : `Add ${t.title} to queue`}
                disabled={queued.has(t.id)}
                onClick={() => player.addToQueue([t.id])}
              >
                <Icon name={queued.has(t.id) ? 'check' : 'plus'} />
              </button>
              <button type="button" className="icon-btn" aria-label={`Rename ${t.title}`} onClick={() => setRenaming(t)}>
                <Icon name="edit" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete ${t.title}`}
                onClick={async () => {
                  if (await confirm(`Delete "${t.title}" from this device?`)) {
                    player.forgetTrack(t.id)
                    await deleteTrack(t.id)
                  }
                }}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title="Rename song">
        {renaming && (
          <RenameForm
            initial={renaming.title}
            onClose={() => setRenaming(null)}
            onSave={async (title) => {
              await renameTrack(renaming.id, title)
              player.trackRenamed(renaming.id, title)
            }}
          />
        )}
      </Modal>
      {confirmEl}
    </section>
  )
}

function NowPlaying() {
  const p = usePlayer()
  return (
    <div className="now-playing">
      <div className="np-title">
        <span className="muted small">{p.currentId ? (p.playing ? 'Now playing' : 'Paused') : 'Ready'}</span>
        <strong>{p.title || 'Press play to start the queue'}</strong>
        {p.error && <span className="error small">{p.error}</span>}
      </div>
      <SeekBar />
      <div className="np-controls">
        <button
          type="button"
          className={p.shuffle ? 'icon-btn is-on' : 'icon-btn'}
          aria-label="Shuffle"
          aria-pressed={p.shuffle}
          onClick={player.toggleShuffle}
        >
          <Icon name="shuffle" />
        </button>
        <button type="button" className="icon-btn" aria-label="Previous song" onClick={() => void player.prev()}>
          <Icon name="prev" filled />
        </button>
        <button type="button" className="play-btn" aria-label={p.playing ? 'Pause' : 'Play'} onClick={player.toggle}>
          <Icon name={p.playing ? 'pause' : 'play'} filled size={26} />
        </button>
        <button type="button" className="icon-btn" aria-label="Next song" onClick={() => void player.next()}>
          <Icon name="next" filled />
        </button>
        <button
          type="button"
          className={p.repeat === 'off' ? 'icon-btn repeat-btn' : 'icon-btn repeat-btn is-on'}
          aria-label={`Repeat: ${p.repeat === 'one' ? 'this song' : p.repeat === 'all' ? 'queue' : 'off'}`}
          onClick={player.cycleRepeat}
        >
          <Icon name="repeat" />
          {p.repeat === 'one' && <span className="repeat-one">1</span>}
        </button>
      </div>
      <label className="volume">
        <Icon name="volume" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.volume}
          aria-label="Volume"
          onChange={(e) => player.setVolume(Number(e.target.value))}
        />
      </label>
    </div>
  )
}

function SeekBar() {
  const { time, duration } = usePlayerTime()
  return (
    <div className="seek">
      <span>{formatTime(time)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step="any"
        value={Math.min(time, duration || 0)}
        disabled={!duration}
        aria-label="Seek"
        onChange={(e) => player.seek(Number(e.target.value))}
      />
      <span>{formatTime(duration)}</span>
    </div>
  )
}
