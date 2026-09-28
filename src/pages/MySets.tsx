import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FocusButton } from '../components/FocusButton'
import { Icon } from '../components/Icon'
import { ImportDialog } from '../components/ImportDialog'
import { Modal } from '../components/Modal'
import { useConfirm } from '../components/useConfirm'
import { SetFormDialog } from '../components/SetFormDialog'
import { StudyModePicker } from '../components/StudyModePicker'
import { db } from '../db/db'
import { useSettings } from '../db/hooks'
import { createSet, dailyLogs, deleteSet, duplicateSet, setCards, updateSet } from '../db/repo'
import { csvFileName, toSimpleCsv } from '../lib/csv'
import { DAILY_MIN_CARDS, DAILY_SIZE, dailyStatus } from '../lib/daily'
import { computeStats, masteredPercent, type SetStats } from '../lib/stats'
import { allTags, hasTag } from '../lib/tags'
import { exportTextFile } from '../platform/files'
import { navigate } from '../router'
import { ALL_SETS } from './StudyPage'
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

  const daily = useLiveQuery(async () => dailyStatus(await dailyLogs(), Date.now()), [])

  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [menuFor, setMenuFor] = useState<Row | null>(null)
  const [renaming, setRenaming] = useState<CardSet | null>(null)
  const [studyFor, setStudyFor] = useState<Row | null>(null)
  const [confirmEl, confirm] = useConfirm()

  const q = query.trim().toLowerCase()
  const tags = allTags((rows ?? []).map((r) => r.set))
  const tagged = (rows ?? []).filter((r) => hasTag(r.set, tag))
  const visible = tagged.filter(
    (r) => !q || r.set.title.toLowerCase().includes(q) || r.set.description.toLowerCase().includes(q),
  )
  const due = tagged.reduce((n, r) => n + r.stats.dueToday, 0)
  const fresh = tagged.reduce((n, r) => n + r.stats.newCount, 0)
  const totalCards = (rows ?? []).reduce((n, r) => n + r.stats.total, 0)

  function reviewAll() {
    const params = new URLSearchParams({ dir: settings.defaultDirection, shuffle: '1', starred: '0' })
    if (tag) params.set('tag', tag)
    navigate(`/study/${ALL_SETS}/flashcards?${params}`)
  }

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
          <FocusButton />
          <button type="button" className="btn" onClick={() => setImporting(true)}>
            <Icon name="import" /> Import CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New set
          </button>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div className="today-row">
          <div className="today-card">
            <div>
              <strong>
                {due} {due === 1 ? 'card' : 'cards'} due
              </strong>
              <span className="muted small">
                {tag ? `in sets tagged ${tag}` : 'across your sets'}
                {fresh > 0 && ` · ${fresh} new`}
              </span>
            </div>
            <button type="button" className="btn btn-primary" disabled={due + fresh === 0} onClick={reviewAll}>
              Review all
            </button>
          </div>
          <div className="today-card">
            <div>
              <strong>Daily challenge</strong>
              <span className="muted small">
                {daily?.doneToday
                  ? `Done today: ${daily.scoreToday} / ${DAILY_SIZE}`
                  : `${DAILY_SIZE} questions from all your sets`}
                {daily && daily.streak > 0 && ` · ${daily.streak} ${daily.streak === 1 ? 'day' : 'days'} in a row`}
              </span>
            </div>
            <button
              type="button"
              className={daily?.doneToday ? 'btn' : 'btn btn-primary'}
              disabled={totalCards < DAILY_MIN_CARDS}
              onClick={() => navigate('/daily')}
            >
              {daily?.doneToday ? 'View' : daily?.answeredToday ? 'Continue' : 'Start'}
            </button>
          </div>
        </div>
      )}

      <label className="search">
        <Icon name="search" />
        <input type="search" placeholder="Search sets" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search sets" />
      </label>

      {tags.length > 0 && (
        <div className="tag-row" role="group" aria-label="Filter by tag">
          <button type="button" className={tag ? 'tag tag-btn' : 'tag tag-btn is-active'} aria-pressed={!tag} onClick={() => setTag(null)}>
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={tag === t ? 'tag tag-btn is-active' : 'tag tag-btn'}
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

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
                {!!set.tags?.length && (
                  <div className="tag-row">
                    {set.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
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
        onSubmit={async (title, description, tags) => navigate(`/set/${await createSet(title, description, tags)}`)}
      />
      <SetFormDialog
        open={!!renaming}
        title="Edit set"
        submitLabel="Save"
        initialTitle={renaming?.title}
        initialDescription={renaming?.description}
        initialTags={renaming?.tags}
        onClose={() => setRenaming(null)}
        onSubmit={async (title, description, tags) => {
          if (renaming) await updateSet(renaming.id, { title, description, tags })
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
              <Icon name="edit" /> Edit details
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
