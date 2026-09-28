import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { addCards, createSet, getValue, setValue } from '../db/repo'
import { blankFront, termFront, type Span } from '../lib/docCards'
import { CardEditor } from './CardEditor'
import { Modal } from './Modal'

const LAST_SET = 'docCardSet'
const NEW_SET = '__new__'

interface Props {
  open: boolean
  text: string
  span: Span | null
  docTitle: string
  onClose: () => void
  onAdded: (setTitle: string) => void
}

/** Makes a card from a selection in a doc: a fill-in-the-blank sentence, or the selection as a term. */
export function DocCardDialog({ open, text, span, docTitle, onClose, onAdded }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Make a card">
      {span && <DocCardForm text={text} span={span} docTitle={docTitle} onClose={onClose} onAdded={onAdded} />}
    </Modal>
  )
}

function DocCardForm({ text, span, docTitle, onClose, onAdded }: Omit<Props, 'open' | 'span'> & { span: Span }) {
  const sets = useLiveQuery(async () => (await db.sets.toArray()).filter((s) => !s.deleted).sort((a, b) => b.updatedAt - a.updatedAt), [])
  const [setId, setSetId] = useState<string>('')
  const [kind, setKind] = useState<'blank' | 'term'>('blank')

  // Start with the set used last time, else the most recent one, else a new set.
  useEffect(() => {
    if (!sets || setId) return
    void getValue<string>(LAST_SET).then((last) => {
      setSetId(sets.some((s) => s.id === last) ? last! : (sets[0]?.id ?? NEW_SET))
    })
  }, [sets, setId])

  const front = kind === 'blank' ? (blankFront(text, span.start, span.end) ?? '') : termFront(text, span.start, span.end)

  return (
    <div className="stack">
      <label className="field">
        <span>Add to</span>
        <select className="input" value={setId} onChange={(e) => setSetId(e.target.value)}>
          {sets?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          <option value={NEW_SET}>New set: {docTitle}</option>
        </select>
      </label>
      <div className="segmented" role="radiogroup" aria-label="Card type">
        <button type="button" role="radio" aria-checked={kind === 'blank'} className={kind === 'blank' ? 'seg is-active' : 'seg'} onClick={() => setKind('blank')}>
          Fill in the blank
        </button>
        <button type="button" role="radio" aria-checked={kind === 'term'} className={kind === 'term' ? 'seg is-active' : 'seg'} onClick={() => setKind('term')}>
          Term
        </button>
      </div>
      <p className="muted small">
        {kind === 'blank'
          ? 'The sentence you selected from, with your selection hidden.'
          : 'Your selection is the front. Write the answer on the back.'}
      </p>
      <CardEditor
        key={kind}
        initial={{ front, back: '' }}
        submitLabel="Add card"
        onCancel={onClose}
        onSubmit={async (card) => {
          const target = setId === NEW_SET || !setId ? await createSet(docTitle, 'Cards made from a doc') : setId
          await addCards(target, [card])
          await setValue(LAST_SET, target)
          onAdded(sets?.find((s) => s.id === target)?.title ?? docTitle)
          onClose()
        }}
      />
    </div>
  )
}
