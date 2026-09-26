import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { ImportDialog } from '../components/ImportDialog'
import { Modal } from '../components/Modal'
import { useConfirm } from '../components/useConfirm'
import { SetFormDialog } from '../components/SetFormDialog'
import { StudyModePicker } from '../components/StudyModePicker'
import { db } from '../db/db'
import { useSettings } from '../db/hooks'
import { createSet, deleteSet, duplicateSet, setCards, updateSet } from '../db/repo'
import { csvFileName, toSimpleCsv } from '../lib/csv'
import { computeStats, masteredPercent, type SetStats } from '../lib/stats'
import { exportTextFile } from '../platform/files'
import { navigate } from '../router'
import type { Card, CardSet } from '../types'

interface Row {
  set: CardSet
  cards: Card[]
  stats: SetStats
}

export default function MySets() {
  const settings = useSettings()
  const rows = useLiveQuery(async () => {
    const [sets, cards, reviews] = await Promise.all([db.sets.toArray(), db.cards.toArray(), db.reviews.toArray()])
    const reviewMap = new Map(reviews.map((r) => [r.cardId, r]))
    const bySet = new Map<string, Card[]>()
    for (const c of cards) {
      if (c.deleted) continue
      const list = bySet.get(c.setId)
      if (list) list.push(c)
      else bySet.set(c.setId, [c])
    }
    const now = Date.now()
    return sets
      .filter((s) => !s.deleted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((set): Row => {
        const list = bySet.get(set.id) ?? []
        return { set, cards: list, stats: computeStats(list, reviewMap, now) }
      })
  }, [])

  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [menuFor, setMenuFor] = useState<Row | null>(null)
  const [renaming, setRenaming] = useState<CardSet | null>(null)
  const [studyFor, setStudyFor] = useState<Row | null>(null)
  const [confirmEl, confirm] = useConfirm()

  const q = query.trim().toLowerCase()
  const visible = (rows ?? []).filter(
    (r) => !q || r.set.title.toLowerCase().includes(q) || r.set.description.toLowerCase().includes(q),
  )

  async function exportSet(set: CardSet) {
    await exportTextFile(csvFileName(set.title), toSimpleCsv(await setCards(set.id)))
  }

  async function remove(row: Row) {
    if (await confirm(`Delete "${row.set.title}" and its ${row.stats.total} cards?`)) await deleteSet(row.set.id)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>My Sets</h1>
        <div className="row">
          <button type="button" className="btn" onClick={() => setImporting(true)}>
            <Icon name="import" /> Import CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New set
          </button>
        </div>
      </div>

      <label className="search">
        <Icon name="search" />
        <input type="search" placeholder="Search sets" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search sets" />
      </label>

      {rows && rows.length === 0 && (
        <div className="empty">
          <p>No sets yet. Create one or import a CSV file.</p>
        </div>
      )}
      {rows && rows.length > 0 && visible.length === 0 && <p className="muted">No sets match "{query}".</p>}

      <div className="set-grid">
        {visible.map((row) => {
          const { set, stats } = row
          const pct = masteredPercent(stats)
          return (
            <article key={set.id} className="set-tile">
              <a className="set-tile-main" href={`#/set/${set.id}`}>
                <h3>{set.title}</h3>
                {set.description && <p className="muted clamp">{set.description}</p>}
                <div className="set-meta">
                  <span>
                    {stats.total} {stats.total === 1 ? 'card' : 'cards'}
                  </span>
                  {stats.dueToday > 0 && <span className="pill pill-accent">{stats.dueToday} due</span>}
                  {stats.newCount > 0 && <span className="pill">{stats.newCount} new</span>}
                </div>
                <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Mastered">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="muted small">{pct}% mastered</span>
              </a>
              <div className="set-tile-actions">
                <button type="button" className="btn btn-primary" disabled={!stats.total} onClick={() => setStudyFor(row)}>
                  Study
                </button>
                <button type="button" className="icon-btn" aria-label={`More actions for ${set.title}`} onClick={() => setMenuFor(row)}>
                  <Icon name="more" />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <SetFormDialog
        open={creating}
        title="New set"
        submitLabel="Create"
        onClose={() => setCreating(false)}
        onSubmit={async (title, description) => navigate(`/set/${await createSet(title, description)}`)}
      />
      <SetFormDialog
        open={!!renaming}
        title="Rename set"
        submitLabel="Save"
        initialTitle={renaming?.title}
        initialDescription={renaming?.description}
        onClose={() => setRenaming(null)}
        onSubmit={async (title, description) => {
          if (renaming) await updateSet(renaming.id, { title, description })
        }}
      />
      <ImportDialog open={importing} sets={(rows ?? []).map((r) => r.set)} onClose={() => setImporting(false)} />
      <StudyModePicker
        open={!!studyFor}
        onClose={() => setStudyFor(null)}
        setId={studyFor?.set.id ?? ''}
        cardCount={studyFor?.stats.total ?? 0}
        starredCount={studyFor?.cards.filter((c) => c.starred).length ?? 0}
        defaultDirection={settings.defaultDirection}
      />
      <Modal open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.set.title ?? ''}>
        {menuFor && (
          <div className="action-list">
            <button type="button" className="btn btn-block" onClick={() => navigate(`/set/${menuFor.set.id}`)}>
              <Icon name="edit" /> Edit cards
            </button>
            <button type="button" className="btn btn-block" onClick={() => { setRenaming(menuFor.set); setMenuFor(null) }}>
              <Icon name="edit" /> Rename
            </button>
            <button type="button" className="btn btn-block" onClick={() => { void duplicateSet(menuFor.set.id); setMenuFor(null) }}>
              <Icon name="sets" /> Duplicate
            </button>
            <button type="button" className="btn btn-block" disabled={!menuFor.stats.total} onClick={() => { void exportSet(menuFor.set); setMenuFor(null) }}>
              <Icon name="export" /> Export CSV
            </button>
            <button type="button" className="btn btn-block btn-danger-soft" onClick={() => { const r = menuFor; setMenuFor(null); void remove(r) }}>
              <Icon name="trash" /> Delete
            </button>
          </div>
        )}
      </Modal>
      {confirmEl}
    </div>
  )
}
