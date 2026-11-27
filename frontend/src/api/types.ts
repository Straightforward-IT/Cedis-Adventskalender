/** Antworten des Backends (siehe backend/src/app.ts). */

export interface CalendarStatus {
  serverTime: string
  /** Heutiges Datum in Berlin (JJJJ-MM-TT). */
  today: string
  calendarYear: number
  unlockedDays: number
  nextUnlockAt: string | null
  debug: boolean
}

export interface SnowReport {
  location: string
  date: string
  probability: number
  snowfallCm: number | null
  temperatureMin: number | null
  temperatureMax: number | null
  method: 'ensemble' | 'forecast'
  updatedAt: string
  stale?: boolean
}

export interface Reward {
  day: number
  title: string
  message: string
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_key' | 'rate_limited' | 'offline' }
  | { ok: false; reason: 'locked'; opensAt: string | null }
