import { answerWords, clearSlot, findTile, placeTile, undoSlot, type Placed } from '../lib/games'
import { useHotkeys } from './hooks'

export type BoardStatus = 'playing' | 'right' | 'revealed'

interface Props {
  answer: string
  tiles: string[]
  placed: Placed
  target: string[]
  status: BoardStatus
  shake?: boolean
  /** false: ignore the keyboard (two boards share one screen in Duel). */
  keys?: boolean
  onChange: (next: Placed) => void
}

/** Answer slots and letter tiles. Tap a tile to place it, tap a placed letter to send it back; typing and Backspace work too. */
export function ScrambleBoard({ answer, tiles, placed, target, status, shake = false, keys = true, onChange }: Props) {
  const playing = status === 'playing'
  useHotkeys({
    Backspace: () => (playing ? onChange(undoSlot(placed)) : false),
    '*': (e) => {
      if (!playing) return false
      const i = findTile(tiles, placed, e.key)
      if (i < 0) return false
      onChange(placeTile(placed, i))
    },
  }, keys)

  const text = (slot: number) => {
    if (status === 'revealed') return target[slot]
    const tile = placed[slot]
    return tile == null ? '' : tiles[tile]
  }

  return (
    <>
      <div
        className={`slots${shake ? ' is-wrong' : ''}${status === 'right' ? ' is-right' : ''}${status === 'revealed' ? ' is-revealed' : ''}`}
        aria-live="polite"
      >
        {answerWords(answer).map((slots, w) => (
          <span key={w} className="slot-word">
            {slots.map(({ slot }) =>
              playing && placed[slot] != null ? (
                <button key={slot} type="button" className="slot is-filled" onClick={() => onChange(clearSlot(placed, slot))} aria-label={`Take back ${text(slot)}`}>
                  {text(slot)}
                </button>
              ) : (
                <span key={slot} className={text(slot) ? 'slot is-filled' : 'slot'}>
                  {text(slot)}
                </span>
              ),
            )}
          </span>
        ))}
      </div>
      {playing && (
        <div className="letter-tiles">
          {tiles.map((t, i) => (
            <button key={i} type="button" className="letter-tile" disabled={placed.includes(i)} onClick={() => onChange(placeTile(placed, i))}>
              {t}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
