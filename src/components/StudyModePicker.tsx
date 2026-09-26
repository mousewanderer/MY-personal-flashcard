import { useState } from 'react'
import { MODES, type ModeGroup, type ModeInfo } from '../modes/registry'
import { navigate } from '../router'
import type { Direction } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  setId: string
  cardCount: number
  starredCount: number
  defaultDirection: Direction
}

const DIRECTIONS: [Direction, string][] = [
  ['front-back', 'Front → Back'],
  ['back-front', 'Back → Front'],
  ['mixed', 'Mixed'],
]
const GROUP_LABELS: Record<ModeGroup, string> = { study: 'Study modes', game: 'Games' }

export function StudyModePicker(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Choose a study mode">
      <Picker {...props} />
    </Modal>
  )
}

function Picker({ setId, cardCount, starredCount, defaultDirection, onClose }: Props) {
  const [tab, setTab] = useState<ModeGroup>('study')
  const [direction, setDirection] = useState(defaultDirection)
  const [shuffle, setShuffle] = useState(true)
  const [starredOnly, setStarredOnly] = useState(false)
  const available = starredOnly ? starredCount : cardCount
  const groups = (Object.keys(GROUP_LABELS) as ModeGroup[]).filter((g) => MODES.some((m) => m.group === g))

  function start(m: ModeInfo) {
    onClose()
    navigate(`/study/${setId}/${m.id}?dir=${direction}&shuffle=${shuffle ? 1 : 0}&starred=${starredOnly ? 1 : 0}`)
  }

  return (
    <div className="stack">
      {groups.length > 1 && (
        <div className="tabs" role="tablist">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={tab === g}
              className={tab === g ? 'tab is-active' : 'tab'}
              onClick={() => setTab(g)}
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      )}
      <div className="segmented" role="radiogroup" aria-label="Direction">
        {DIRECTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            className={direction === value ? 'seg is-active' : 'seg'}
            onClick={() => setDirection(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <label className="check">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Shuffle
        </label>
        <label className="check">
          <input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} />
          Starred only ({starredCount})
        </label>
      </div>
      <ul className="mode-list">
        {MODES.filter((m) => m.group === tab).map((m) => {
          const disabled = available < m.minCards
          return (
            <li key={m.id}>
              <button type="button" className="mode-row" disabled={disabled} onClick={() => start(m)}>
                <span className="mode-icon">
                  <Icon name={m.icon} size={22} />
                </span>
                <span className="mode-text">
                  <strong>{m.name}</strong>
                  <span>{disabled ? `Needs at least ${m.minCards} ${starredOnly ? 'starred ' : ''}cards` : m.description}</span>
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
