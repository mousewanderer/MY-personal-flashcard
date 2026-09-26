import { useMemo, useState } from 'react'
import { addCards } from '../db/repo'
import { SEPARATORS, SEPARATOR_LABELS, detectSeparator, parseBulk, type Separator } from '../lib/bulkPaste'
import { Modal } from './Modal'

export function BulkAddDialog({ open, setId, onClose }: { open: boolean; setId: string; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Bulk add cards" wide>
      <BulkAdd setId={setId} onClose={onClose} />
    </Modal>
  )
}

function BulkAdd({ setId, onClose }: { setId: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [choice, setChoice] = useState<'auto' | Separator>('auto')
  const result = useMemo(() => parseBulk(text, choice === 'auto' ? undefined : choice), [text, choice])
  const detected = SEPARATOR_LABELS[detectSeparator(text)]

  return (
    <div className="stack">
      <p className="muted">One card per line: front, separator, back. With tabs you can add up to 3 wrong answers as extra columns.</p>
      <textarea
        className="input mono"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'dog - perro\ncat - gato'}
        autoFocus
      />
      <label className="field inline">
        <span>Separator</span>
        <select className="input" value={choice} onChange={(e) => setChoice(e.target.value as 'auto' | Separator)}>
          <option value="auto">Auto ({detected})</option>
          {SEPARATORS.map((s) => (
            <option key={s} value={s}>
              {SEPARATOR_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {result.cards.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Front</th>
                <th>Back</th>
                <th>Wrong answers</th>
              </tr>
            </thead>
            <tbody>
              {result.cards.slice(0, 50).map((c, i) => (
                <tr key={i}>
                  <td>{c.front}</td>
                  <td>{c.back}</td>
                  <td className="muted">{c.options?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.skipped.length > 0 && (
        <p className="warn">Skipped lines without a front and back: {result.skipped.slice(0, 20).join(', ')}{result.skipped.length > 20 ? '…' : ''}</p>
      )}
      <div className="row-end">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!result.cards.length}
          onClick={async () => {
            await addCards(setId, result.cards)
            onClose()
          }}
        >
          Add {result.cards.length} {result.cards.length === 1 ? 'card' : 'cards'}
        </button>
      </div>
    </div>
  )
}
