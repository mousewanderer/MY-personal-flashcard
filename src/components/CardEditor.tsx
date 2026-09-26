import { useRef, useState, type KeyboardEvent } from 'react'
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

  async function submit() {
    if (!front.trim() || !back.trim()) return
    await onSubmit({ front, back, options: options.filter((o) => o.trim()) })
    if (!initial) {
      setFront('')
      setBack('')
      setOptions(['', '', ''])
      frontRef.current?.focus()
    }
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
          <span>Back</span>
          <textarea className="input" rows={2} value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={ctrlEnter} />
        </label>
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
          <button type="submit" className="btn btn-primary" disabled={!front.trim() || !back.trim()}>
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
