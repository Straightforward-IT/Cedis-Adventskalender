import { create } from 'zustand'
import type { SnowReport } from '../api/types.ts'
import { DEFAULT_CALENDAR_YEAR, TOTAL_DAYS } from '../lib/calendar.ts'
import { emptyProgress } from '../lib/storage.ts'
import type { Progress } from '../lib/storage.ts'
import type { DoorToken } from '../lib/token.ts'
import type { LookDirection } from '../scene/StreetScene.ts'

/** Wo sich der Besucher gerade befindet. */
export type Phase =
  | 'street'
  /** Die Tür schwingt auf, das Bild wird hell. */
  | 'opening'
  | 'inside'
  /** Zurück auf die Straße, wieder durchs Licht. */
  | 'leaving'

export type Modal =
  | { kind: 'scan'; day: number }
  /** `enterAfter`: nach dem Selfie geht es direkt ins Haus. */
  | { kind: 'selfie'; day: number; enterAfter: boolean }
  | null

export interface Notice {
  day: number
  tone: 'info' | 'error'
  text: string
}

export type HouseStatus =
  /** Der Tag ist noch nicht gekommen. */
  | 'locked'
  /** Heute oder früher – aber der Schlüssel (QR-Code) fehlt noch. */
  | 'available'
  /** Aufgeschlossen, Minispiel noch offen. */
  | 'unlocked'
  | 'completed'

export interface AppState {
  /** Heutiges Datum in Berlin (JJJJ-MM-TT) – vom Server, sonst von der Geräteuhr. */
  today: string
  calendarYear: number
  unlockedDays: number
  /** true, sobald der Server das Datum bestätigt hat. */
  synced: boolean

  progress: Progress
  /** Selfies als Data-URL, nach Tag. */
  selfies: Record<number, string>
  snow: SnowReport | null
  /** Nur für die Dev-Vorschau: Datum (JJJJ-MM-TT), dessen Mondphase statt der heutigen gezeigt wird. */
  moonDate: string | null

  phase: Phase
  /** Haus (oder Tor), vor dessen Eingang die Kamera steht. */
  focusedDay: number | null
  insideDay: number | null
  modal: Modal
  /** Schlüssel aus dem Link des QR-Codes, der noch nicht ausprobiert wurde. */
  pendingToken: DoorToken | null
  verifyingDay: number | null
  notice: Notice | null
  toast: { id: number; text: string } | null

  /**
   * Wo die Kamera auf der Straße steht: vor einem Tag (1–24) oder – als
   * `TREE_PLACE` – hinter dem Tor beim Weihnachtsbaum. null, solange die Szene lädt.
   */
  place: number | null
  /** Blickrichtung: 0 = geradeaus, 1 = die Straße entlang zum Baum, −1 = zurück zu ihrem Anfang. */
  look: LookDirection
  /** WebGL steht nicht zur Verfügung – dann gibt es nur die Bedienleiste. */
  sceneFailed: boolean
  /** Name des Easter Eggs, auf das die Kamera gerade zoomt – sonst null. */
  inspecting: string | null
}

export const useStore = create<AppState>()(() => ({
  today: '',
  calendarYear: DEFAULT_CALENDAR_YEAR,
  unlockedDays: 0,
  synced: false,
  progress: emptyProgress(),
  selfies: {},
  snow: null,
  moonDate: null,
  phase: 'street',
  focusedDay: null,
  insideDay: null,
  modal: null,
  pendingToken: null,
  verifyingDay: null,
  notice: null,
  toast: null,
  place: null,
  look: 0,
  sceneFailed: false,
  inspecting: null,
}))

type CalendarSlice = Pick<AppState, 'unlockedDays' | 'progress'>

export function houseStatus(state: CalendarSlice, day: number): HouseStatus {
  if (day > state.unlockedDays) return 'locked'
  if (!state.progress.keys[day]) return 'available'
  return state.progress.completed[day] ? 'completed' : 'unlocked'
}

/**
 * Der Tag, der heute dran ist: der jüngste freigeschaltete, solange er noch
 * nicht gelöst wurde. Über seinem Haus (oder dem Tor) schwebt ein Stern.
 */
export function highlightedDay(state: CalendarSlice): number | null {
  const day = Math.min(state.unlockedDays, TOTAL_DAYS)
  return day >= 1 && houseStatus(state, day) !== 'completed' ? day : null
}
