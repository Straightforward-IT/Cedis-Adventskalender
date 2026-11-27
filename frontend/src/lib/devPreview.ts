import { useSyncExternalStore } from 'react'

/** Gemeinsamer Testschlüssel für alle Boxen in der Vorschau. */
export const PREVIEW_KEY = 'ABCDEFGHJK'

/** Nur der Dev-Server oder ein ausdrücklich als Vorschau gebautes Frontend aktiviert /dev. */
export function isDevPreview(
  pathname = globalThis.location?.pathname ?? '',
  enabled = import.meta.env.DEV || import.meta.env.VITE_DEV_PREVIEW === 'true',
): boolean {
  return enabled && (pathname === '/dev' || pathname.startsWith('/dev/'))
}

type GameSkip = (() => void) | null
let gameSkip: GameSkip = null
const skipListeners = new Set<() => void>()

/**
 * Nur für die Dev-Vorschau: Das gerade laufende Minispiel meldet hier, wie man es sofort als
 * gelöst abschließt (oder `null`, wenn keins läuft). Die Vorschau-Leiste bietet dann „Überspringen“.
 */
export function setGameSkip(skip: GameSkip): void {
  gameSkip = skip
  for (const listener of skipListeners) listener()
}

export function useGameSkip(): GameSkip {
  return useSyncExternalStore(
    (listener) => {
      skipListeners.add(listener)
      return () => skipListeners.delete(listener)
    },
    () => gameSkip,
  )
}
