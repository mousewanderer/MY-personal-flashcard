import { useState } from 'react'

/** A one-field title form for use inside a Modal. */
export function RenameForm(props: { initial: string; onClose: () => void; onSave: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState(props.initial)
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        await props.onSave(title.trim())
        props.onClose()
      }}
    >
      <label className="field">
        <span>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <div className="row-end">
        <button type="button" className="btn" onClick={props.onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  )
}
