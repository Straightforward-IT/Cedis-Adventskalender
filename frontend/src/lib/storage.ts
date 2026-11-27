import { createStore, del, entries, set } from 'idb-keyval'
import { isValidDay } from './calendar.ts'

/** Alles, was sich die App pro Gerät merkt. Es gibt keine Konten und keine Datenbank. */
export interface Progress {
  /** Türschlüssel der bereits aufgeschlossenen Häuser. */
  keys: Record<number, string>
  /** Zeitpunkt, zu dem das Minispiel eines Hauses gelöst wurde. */
  completed: Record<number, string>
  /** Zwischenstände der Minispiele – damit man später weiterspielen kann. */
  games: Record<number, unknown>
  hintSeen: boolean
  /** Eichhörnchen, die nach Haus 6 frei auf der Straße mit Schneebällen getroffen wurden. */
  squirrels: number
}

const STORAGE_KEY = 'weihnachtsstrasse:v1'

export function emptyProgress(): Progress {
  return { keys: {}, completed: {}, games: {}, hintSeen: false, squirrels: 0 }
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readDays<T>(value: unknown, accept: (entry: unknown) => entry is T): Record<number, T> {
  const result: Record<number, T> = {}
  if (value === null || typeof value !== 'object') return result
  for (const [key, entry] of Object.entries(value)) {
    const day = Number(key)
    if (isValidDay(day) && accept(entry)) result[day] = entry
  }
  return result
}

const isString = (entry: unknown): entry is string => typeof entry === 'string'
const isPresent = (entry: unknown): entry is unknown => entry !== undefined

export function loadProgress(storage: Storage | null = defaultStorage()): Progress {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return emptyProgress()
    const data = parsed as Record<string, unknown>
    return {
      keys: readDays(data.keys, isString),
      completed: readDays(data.completed, isString),
      games: readDays(data.games, isPresent),
      hintSeen: data.hintSeen === true,
      squirrels: Number.isInteger(data.squirrels) && (data.squirrels as number) > 0 ? (data.squirrels as number) : 0,
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(progress: Progress, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Speicher voll oder gesperrt (privater Modus) – dann gilt der Fortschritt nur für diese Sitzung.
  }
}

// Selfies sind zu groß für localStorage und liegen deshalb als Data-URL in IndexedDB.
let selfieStore: ReturnType<typeof createStore> | null = null

function selfies() {
  selfieStore ??= createStore('weihnachtsstrasse', 'selfies')
  return selfieStore
}

export async function loadSelfies(): Promise<Record<number, string>> {
  try {
    return readDays(Object.fromEntries(await entries(selfies())), isString)
  } catch {
    return {}
  }
}

export async function storeSelfie(day: number, dataUrl: string): Promise<void> {
  try {
    await set(day, dataUrl, selfies())
  } catch {
    // Ohne IndexedDB bleibt das Selfie bis zum Neuladen sichtbar.
  }
}

export async function removeSelfie(day: number): Promise<void> {
  try {
    await del(day, selfies())
  } catch {
    // siehe oben
  }
}
