import { useRef, useState, type KeyboardEvent } from 'react'
import { parseCloze, wrapBlank } from '../lib/cloze'
import type { CardInput } from '../types'

interface Props {
  initial?: CardInput
  submitLabel: string
  onSubmit: (card: CardInput) => void | Promise<void>
  onCancel?: () => void
}

export function CardEditor({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [front, setFront] = useState(initial?.front ?? '')
  const [back, setBack] = useState(initial?.back ?? '')
  const [options, setOptions] = useState<string[]>(() => [0, 1, 2].map((i) => initial?.options?.[i] ?? ''))
  const [showOptions, setShowOptions] = useState(!!initial?.options?.length)
  const frontRef = useRef<HTMLTextAreaElement>(null)
  // A front with {{blanks}} makes a fill-in-the-blank card; its back is the hidden words.
  const cloze = parseCloze(front)
  const effectiveBack = cloze ? cloze.answer : back
  const ready = !!front.trim() && !!effectiveBack.trim()

  async function submit() {
    if (!ready) return
    await onSubmit({ front, back: effectiveBack, options: options.filter((o) => o.trim()) })
    if (!initial) {
      setFront('')
      setBack('')
      setOptions(['', '', ''])
      frontRef.current?.focus()
    }
  }

  function makeBlank() {
    const el = frontRef.current
    if (!el) return
    const { text, cursor } = wrapBlank(front, el.selectionStart, el.selectionEnd)
    setFront(text)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const ctrlEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form
      className="card-editor"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="editor-sides">
        <label className="field">
          <span>Front</span>
          <textarea ref={frontRef} className="input" rows={2} value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={ctrlEnter} autoFocus={!!initial} />
        </label>
        <label className="field">
          <span>{cloze ? 'Back (the hidden words)' : 'Back'}</span>
          <textarea
            className="input"
            rows={2}
            value={effectiveBack}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={ctrlEnter}
            readOnly={!!cloze}
          />
        </label>
      </div>
      <div className="blank-hint">
        {/* Keep the front's text selection when this is pressed. */}
        <button type="button" className="btn btn-ghost btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={makeBlank}>
          Make blank
        </button>
        <span className="muted small">
          {cloze ? `Studied as: ${cloze.prompt}` : 'Select words in the front and press Make blank for a fill-in-the-blank card.'}
        </span>
      </div>
      {showOptions ? (
        <div className="field">
          <span>Wrong answers for multiple choice (optional)</span>
          <div className="options-grid">
            {options.map((o, i) => (
              <input
                key={i}
                className="input"
                value={o}
                placeholder={`Wrong answer ${i + 1}`}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="row-between">
        <button type="button" className="btn btn-ghost" onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? 'Hide wrong answers' : 'Add wrong answers'}
        </button>
        <div className="row">
          {onCancel && (
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
