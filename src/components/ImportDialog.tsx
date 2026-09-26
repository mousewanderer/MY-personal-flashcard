import { useMemo, useState } from 'react'
import { addCards, createSet } from '../db/repo'
import { parseSimpleCsv, rowsToCards, titleFromFileName, type SimpleCsv } from '../lib/csv'
import { IMPORT_ACCEPT } from '../platform/files'
import { navigate } from '../router'
import type { CardSet } from '../types'
import { Modal } from './Modal'

interface Props {
  open: boolean
  sets: CardSet[]
  onClose: () => void
}

export function ImportDialog({ open, sets, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Import CSV" wide>
      <Importer sets={sets} onClose={onClose} />
    </Modal>
  )
}

function Importer({ sets, onClose }: { sets: CardSet[]; onClose: () => void }) {
  const [parsed, setParsed] = useState<SimpleCsv | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('new')
  const [skipHeader, setSkipHeader] = useState(false)

  const result = useMemo(() => {
    if (!parsed) return null
    const rows = skipHeader ? parsed.rows.slice(1) : parsed.rows
    return rowsToCards(rows, skipHeader ? 2 : 1)
  }, [parsed, skipHeader])

  async function onFile(file: File | undefined) {
    setError('')
    setParsed(null)
    if (!file) return
    const text = await file.text()
    const p = parseSimpleCsv(text)
    const cards = rowsToCards(p.rows).cards
    if (!cards.length) {
      setError('No cards found. The file needs at least two columns: front and back.')
      return
    }
    setParsed(p)
    setSkipHeader(p.headerLikely)
    setName(titleFromFileName(file.name))
  }

  async function doImport() {
    if (!result?.cards.length) return
    const setId = target === 'new' ? await createSet(name) : target
    await addCards(setId, result.cards)
    onClose()
    navigate(`/set/${setId}`)
  }

  return (
    <div className="stack">
      <p className="muted">
        A simple CSV has no header: column A is the front, B is the back, and C to E are optional wrong answers.
        Comma, tab and semicolon files all work.
      </p>
      <input type="file" accept={IMPORT_ACCEPT} onChange={(e) => void onFile(e.target.files?.[0])} />
      {error && <p className="error">{error}</p>}
      {parsed && result && (
        <>
          <div className="editor-sides">
            <label className="field">
              <span>Import into</span>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">New set</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    Add to: {s.title}
                  </option>
                ))}
              </select>
            </label>
            {target === 'new' && (
              <label className="field">
                <span>Set name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
          </div>
          <label className="check">
            <input type="checkbox" checked={skipHeader} onChange={(e) => setSkipHeader(e.target.checked)} />
            First row is a header, skip it
          </label>
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
                {result.cards.slice(0, 10).map((c, i) => (
                  <tr key={i}>
                    <td>{c.front}</td>
                    <td>{c.back}</td>
                    <td className="muted">{c.options?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            {result.cards.length} cards
            {result.skipped.length > 0 && `, ${result.skipped.length} rows skipped (missing front or back: row ${result.skipped.slice(0, 10).join(', ')})`}
          </p>
        </>
      )}
      <div className="row-end">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!result?.cards.length} onClick={() => void doImport()}>
          Import
        </button>
      </div>
    </div>
  )
}
