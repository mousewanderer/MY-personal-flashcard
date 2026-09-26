import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { db } from '../db/db'
import { addDoc } from '../db/repo'
import { extractPdfText, PdfError } from '../lib/pdf'
import { looksScanned, titleFromFileName } from '../lib/pdfText'
import { navigate } from '../router'

type Status = { kind: 'idle' } | { kind: 'reading'; page: number; total: number; name: string } | { kind: 'error'; message: string }

export default function DocsPage() {
  const docs = useLiveQuery(() => db.docs.orderBy('createdAt').reverse().toArray(), [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const input = useRef<HTMLInputElement>(null)

  async function importPdf(file: File) {
    setStatus({ kind: 'reading', page: 0, total: 0, name: file.name })
    try {
      const { text, pages } = await extractPdfText(file, (page, total) =>
        setStatus({ kind: 'reading', page, total, name: file.name }),
      )
      if (looksScanned(text, pages)) {
        setStatus({
          kind: 'error',
          message: "No text found. This PDF looks scanned (images of pages), which isn't supported.",
        })
        return
      }
      const id = await addDoc({ title: titleFromFileName(file.name), fileName: file.name, text, pages })
      setStatus({ kind: 'idle' })
      navigate(`/doc/${id}`)
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof PdfError ? e.message : "Something went wrong reading this PDF." })
    }
  }

  const q = query.trim().toLowerCase()
  const visible = docs?.filter((d) => d.title.toLowerCase().includes(q)) ?? []
  const busy = status.kind === 'reading'

  return (
    <div className="page">
      <div className="page-head">
        <h1>Docs</h1>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="import" /> Import PDF
        </button>
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importPdf(file)
          }}
        />
      </div>

      {status.kind === 'reading' && (
        <div className="panel" role="status">
          <p className="doc-status">
            Reading {status.name}
            {status.total > 0 && ` · page ${status.page} of ${status.total}`}…
          </p>
          <div className="bar">
            <span style={{ width: `${status.total ? Math.round((status.page / status.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}
      {status.kind === 'error' && (
        <div className="panel row-between" role="alert">
          <span className="error">{status.message}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setStatus({ kind: 'idle' })}>
            Dismiss
          </button>
        </div>
      )}

      {docs && docs.length > 0 && (
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search docs" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search docs" />
        </label>
      )}

      {docs && docs.length === 0 && !busy && (
        <div className="empty">
          <p>No docs yet. Import a PDF to get a plain-text copy you can read, search and paste into your notes.</p>
        </div>
      )}
      {docs && docs.length > 0 && visible.length === 0 && <p className="muted">No docs match "{query}".</p>}

      <ul className="doc-list">
        {visible.map((d) => (
          <li key={d.id}>
            <a className="doc-row" href={`#/doc/${d.id}`}>
              <span className="doc-icon">
                <Icon name="doc" />
              </span>
              <span className="doc-row-text">
                <strong>{d.title}</strong>
                <span className="muted small">
                  {d.pages} {d.pages === 1 ? 'page' : 'pages'} · {d.words.toLocaleString()} words ·{' '}
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </span>
              <Icon name="chevron" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
