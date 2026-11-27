import { useEffect } from 'react'
import { useStore } from '../state/store.ts'

const VISIBLE_MS = 3400

/** Kurze Meldung am oberen Rand, die von selbst wieder verschwindet. */
export function Toast() {
  const toast = useStore((state) => state.toast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      useStore.setState((state) => (state.toast?.id === toast.id ? { toast: null } : {}))
    }, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div className="toast" role="status" aria-live="polite">
      {toast && <p key={toast.id}>{toast.text}</p>}
    </div>
  )
}
