import type { CalendarStatus, Reward, SnowReport, UnlockResult } from './types.ts'
import { isDevPreview, PREVIEW_KEY } from '../lib/devPreview.ts'

/** Leer = gleiche Herkunft (in der Entwicklung leitet Vite /api an das Backend weiter). */
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Ein schlafender Heroku-Dyno braucht ein paar Sekunden zum Aufwachen. */
const TIMEOUT_MS = 20_000

class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    super(`API-Fehler ${status}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE_URL + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body: unknown = await response.json().catch(() => null)
  const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  if (!response.ok) throw new ApiError(response.status, record)
  return record as T
}

const withKey = (key: string): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key }),
})

export function fetchStatus(): Promise<CalendarStatus> {
  return request('/api/status')
}

export function fetchSnow(): Promise<SnowReport> {
  return request('/api/snow')
}

export function fetchReward(day: number, key: string): Promise<Reward> {
  if (isDevPreview()) {
    return Promise.resolve({ day, title: `Türchen ${day}`, message: `Geschafft! Jetzt darfst du Box ${day} öffnen.` })
  }
  return request(`/api/houses/${day}/reward`, withKey(key))
}

/** Prüft einen Türschlüssel. Fehler werden zu Gründen, die die Oberfläche erklären kann. */
export async function unlockHouse(day: number, key: string): Promise<UnlockResult> {
  if (isDevPreview()) return key === PREVIEW_KEY ? { ok: true } : { ok: false, reason: 'invalid_key' }
  try {
    await request(`/api/houses/${day}/unlock`, withKey(key))
    return { ok: true }
  } catch (error) {
    if (!(error instanceof ApiError)) return { ok: false, reason: 'offline' }
    const code = error.body.error
    if (code === 'locked') {
      const opensAt = typeof error.body.opensAt === 'string' ? error.body.opensAt : null
      return { ok: false, reason: 'locked', opensAt }
    }
    if (code === 'invalid_key') return { ok: false, reason: 'invalid_key' }
    if (error.status === 429) return { ok: false, reason: 'rate_limited' }
    return { ok: false, reason: 'offline' }
  }
}
