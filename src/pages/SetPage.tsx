import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BulkAddDialog } from '../components/BulkAddDialog'
import { CardEditor } from '../components/CardEditor'
import { Icon } from '../components/Icon'
import { useConfirm } from '../components/useConfirm'
import { SetFormDialog } from '../components/SetFormDialog'
import { StudyModePicker } from '../components/StudyModePicker'
import { db } from '../db/db'
import { useSettings } from '../db/hooks'
import { addCards, deleteCard, moveCard, reviewsFor, setCards, updateCard, updateSet } from '../db/repo'
import { csvFileName, toSimpleCsv } from '../lib/csv'
import { examLabel } from '../lib/exam'
import { computeStats } from '../lib/stats'
import { exportTextFile } from '../platform/files'

export default function SetPage({ id }: { id: string }) {
  const settings = useSettings()
  const data = useLiveQuery(async () => {
    const set = await db.sets.get(id)
    if (!set || set.deleted) return null
    const cards = await setCards(id)
    const reviews = await reviewsFor(cards.map((c) => c.id))
    const now = Date.now()
    return { set, cards, stats: computeStats(cards, reviews, now), exam: examLabel(set.examDate, now) }
  }, [id])

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [bulk, setBulk] = useState(false)
  const [picker, setPicker] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmEl, confirm] = useConfirm()

  if (data === undefined) return <p className="muted page">Loading…</p>
  if (data === null) {
    return (
      <div className="page empty">
        <p>This set no longer exists.</p>
        <a className="btn" href="#/">
          Back to My Sets
        </a>
      </div>
    )
  }

  const { set, cards, stats } = data
  const q = query.trim().toLowerCase()
  const visible = q
    ? cards.filter((c) => [c.front, c.back, ...c.options].some((t) => t.toLowerCase().includes(q)))
    : cards

  return (
    <div className="page">
      <a className="back-link" href="#/">
        <Icon name="back" /> My Sets
      </a>
      <div className="page-head">
        <div>
          <h1>{set.title}</h1>
          {set.description && <p className="muted">{set.description}</p>}
          {(!!set.tags?.length || data.exam) && (
            <div className="tag-row">
              {data.exam && <span className="pill pill-exam">{data.exam}</span>}
              {set.tags?.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="row wrap">
          <button type="button" className="btn btn-primary" disabled={!cards.length} onClick={() => setPicker(true)}>
            Study
          </button>
          <button type="button" className="btn" onClick={() => setBulk(true)}>
            <Icon name="bulk" /> Bulk add
          </button>
          <button
            type="button"
            className="btn"
            disabled={!cards.length}
            onClick={() => void exportTextFile(csvFileName(set.title), toSimpleCsv(cards))}
          >
            <Icon name="export" /> Export CSV
          </button>
          <button type="button" className="icon-btn" aria-label="Edit set details" onClick={() => setRenaming(true)}>
            <Icon name="edit" />
          </button>
        </div>
      </div>

      <p className="stat-strip">
        <span>{stats.total} cards</span>
        <span>{stats.newCount} new</span>
        <span>{stats.learning} learning</span>
        <span>{stats.mastered} mastered</span>
        <span>{stats.dueToday} due today</span>
        <span>{stats.dueTomorrow} due tomorrow</span>
      </p>

      <section className="panel">
        <h2 className="h-small">Add a card</h2>
        <CardEditor submitLabel="Add card" onSubmit={(c) => addCards(id, [c])} />
      </section>

      {cards.length > 0 && (
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search cards" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search cards" />
        </label>
      )}

      <ol className="card-list">
        {visible.map((c, i) =>
          editing === c.id ? (
            <li key={c.id} className="card-row is-editing">
              <CardEditor
                initial={c}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (v) => {
                  await updateCard(c.id, { front: v.front.trim(), back: v.back.trim(), options: (v.options ?? []).map((o) => o.trim()) })
                  setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={c.id} className="card-row">
              <div className="card-text">
                <div>{c.front}</div>
                <div className="muted">{c.back}</div>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className={c.starred ? 'icon-btn is-starred' : 'icon-btn'}
                  aria-label={c.starred ? 'Unstar' : 'Star'}
                  aria-pressed={c.starred}
                  onClick={() => void updateCard(c.id, { starred: !c.starred })}
                >
                  <Icon name="star" filled={c.starred} />
                </button>
                {!q && (
                  <>
                    <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => void moveCard(id, c.id, -1)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" className="icon-btn" aria-label="Move down" disabled={i === cards.length - 1} onClick={() => void moveCard(id, c.id, 1)}>
                      <Icon name="down" />
                    </button>
                  </>
                )}
                <button type="button" className="icon-btn" aria-label="Edit" onClick={() => setEditing(c.id)}>
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Delete"
                  onClick={async () => {
                    if (await confirm(`Delete the card "${c.front}"?`)) await deleteCard(c.id)
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          ),
        )}
      </ol>
      {q && visible.length === 0 && <p className="muted">No cards match "{query}".</p>}

      <BulkAddDialog open={bulk} setId={id} onClose={() => setBulk(false)} />
      <StudyModePicker
        open={picker}
        onClose={() => setPicker(false)}
        setId={id}
        cardCount={cards.length}
        starredCount={cards.filter((c) => c.starred).length}
        defaultDirection={settings.defaultDirection}
      />
      <SetFormDialog
        open={renaming}
        title="Edit set"
        submitLabel="Save"
        initialTitle={set.title}
        initialDescription={set.description}
        initialTags={set.tags}
        initialExamDate={set.examDate}
        onClose={() => setRenaming(false)}
        onSubmit={(v) => updateSet(id, v)}
      />
      {confirmEl}
    </div>
  )
}
