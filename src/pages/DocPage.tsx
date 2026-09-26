import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { RenameForm } from '../components/RenameForm'
import { useConfirm } from '../components/useConfirm'
import { db } from '../db/db'
import { deleteDoc, renameDoc } from '../db/repo'
import { txtFileName } from '../lib/pdfText'
import { exportTextFile } from '../platform/files'
import { navigate } from '../router'

const MAX_MARKS = 2000

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older WebViews without the async clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Start offsets of each case-insensitive match, capped so huge docs stay responsive. */
function findMatches(text: string, query: string): number[] {
  const q = query.toLowerCase()
  if (!q) return []
  const hay = text.toLowerCase()
  const out: number[] = []
  for (let i = hay.indexOf(q); i !== -1 && out.length < MAX_MARKS; i = hay.indexOf(q, i + q.length)) out.push(i)
  return out
}

export default function DocPage({ id }: { id: string }) {
  const doc = useLiveQuery(async () => (await db.docs.get(id)) ?? null, [id])
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [confirmEl, confirm] = useConfirm()
  const body = useRef<HTMLDivElement>(null)

  const text = doc?.text ?? ''
  const matches = useMemo(() => findMatches(text, query.trim()), [text, query])

  useEffect(() => {
    body.current?.querySelector('mark.is-current')?.scrollIntoView({ block: 'center' })
  }, [current, matches])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(t)
  }, [copied])

  if (doc === undefined) return <p className="muted center">Loading…</p>
  if (doc === null) {
    return (
      <div className="page empty">
        <p>This doc no longer exists.</p>
        <a className="btn" href="#/docs">
          Back to Docs
        </a>
      </div>
    )
  }

  const step = (delta: number) => matches.length && setCurrent((c) => (c + delta + matches.length) % matches.length)
  const q = query.trim()

  let content: ReactNode = text
  if (matches.length) {
    const parts: ReactNode[] = []
    let last = 0
    matches.forEach((start, i) => {
      parts.push(text.slice(last, start))
      parts.push(
        <mark key={start} className={i === current ? 'is-current' : undefined}>
          {text.slice(start, start + q.length)}
        </mark>,
      )
      last = start + q.length
    })
    parts.push(text.slice(last))
    content = parts
  }

  return (
    <div className="page doc-page">
      <a className="back-link" href="#/docs">
        <Icon name="back" /> Docs
      </a>
      <div className="page-head">
        <div>
          <h1>{doc.title}</h1>
          <p className="muted small">
            {doc.fileName} · {doc.pages} {doc.pages === 1 ? 'page' : 'pages'} · {doc.words.toLocaleString()} words
          </p>
        </div>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Rename" onClick={() => setRenaming(true)}>
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete"
            onClick={async () => {
              if (await confirm(`Delete "${doc.title}"? Its text will be gone from this device.`)) {
                await deleteDoc(doc.id)
                navigate('/docs', true)
              }
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="doc-toolbar">
        <button type="button" className="btn btn-primary" onClick={async () => setCopied((await copyText(text)) ? 'ok' : 'failed')}>
          <Icon name="copy" /> {copied === 'ok' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy all text'}
        </button>
        <button type="button" className="btn" onClick={() => void exportTextFile(txtFileName(doc.title), text, 'text/plain')}>
          <Icon name="export" /> Export .txt
        </button>
        <div className="doc-search">
          <label className="search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Find in text"
              value={query}
              aria-label="Find in text"
              onChange={(e) => {
                setQuery(e.target.value)
                setCurrent(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
              }}
            />
          </label>
          {q && (
            <div className="row">
              <span className="muted small doc-count" aria-live="polite">
                {matches.length ? `${current + 1} of ${matches.length}${matches.length === MAX_MARKS ? '+' : ''}` : 'No matches'}
              </span>
              <button type="button" className="icon-btn" aria-label="Previous match" disabled={!matches.length} onClick={() => step(-1)}>
                <Icon name="up" />
              </button>
              <button type="button" className="icon-btn" aria-label="Next match" disabled={!matches.length} onClick={() => step(1)}>
                <Icon name="down" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="panel doc-text" ref={body}>
        {content}
      </div>

      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename doc">
        <RenameForm initial={doc.title} onClose={() => setRenaming(false)} onSave={(t) => renameDoc(doc.id, t)} />
      </Modal>
      {confirmEl}
    </div>
  )
}
