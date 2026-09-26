import { useCallback, useState } from 'react'
import { Modal } from './Modal'

interface ConfirmState {
  message: string
  confirmLabel: string
  resolve: (ok: boolean) => void
}

/** `const [confirmEl, confirm] = useConfirm()`; render confirmEl, then `if (await confirm('...'))`. */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const ask = useCallback(
    (message: string, confirmLabel = 'Delete') =>
      new Promise<boolean>((resolve) => setState({ message, confirmLabel, resolve })),
    [],
  )
  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }
  const element = (
    <Modal open={!!state} onClose={() => close(false)} title="Are you sure?">
      <p>{state?.message}</p>
      <div className="row-end">
        <button type="button" className="btn" onClick={() => close(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={() => close(true)} autoFocus>
          {state?.confirmLabel}
        </button>
      </div>
    </Modal>
  )
  return [element, ask] as const
}
