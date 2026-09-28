import { useState } from 'react'
import { parseTags, tagsText } from '../lib/tags'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  submitLabel: string
  initialTitle?: string
  initialDescription?: string
  initialTags?: string[]
  onClose: () => void
  onSubmit: (title: string, description: string, tags: string[]) => void | Promise<void>
}

export function SetFormDialog(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      <SetForm {...props} />
    </Modal>
  )
}

function SetForm({ submitLabel, initialTitle = '', initialDescription = '', initialTags, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [tags, setTags] = useState(tagsText(initialTags))
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        await onSubmit(title.trim(), description.trim(), parseTags(tags))
        onClose()
      }}
    >
      <label className="field">
        <span>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span>Description (optional)</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span>Tags (optional, separated by commas)</span>
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Spanish, exam" />
      </label>
      <div className="row-end">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
