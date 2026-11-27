import { isValidDay, parseIsoDate } from './calendar.ts'
import type { BerlinDate } from './calendar.ts'

export interface Config {
  port: number
  isProduction: boolean
  qrSecret: string
  usesDevSecret: boolean
  calendarYear: number
  /** Nur zum Testen: ersetzt das heutige Datum. */
  debugDate: BerlinDate | null
  /** Erlaubte Ursprünge – genaue Adressen oder Muster aus CORS_ORIGINS mit `*`. */
  corsOrigins: (string | RegExp)[]
  frontendUrl: string
  /** Eigene Belohnungstexte pro Tag (aus REWARDS_JSON). */
  rewardMessages: Record<number, string>
}

export const DEFAULT_CALENDAR_YEAR = 2026
/** Lokaler Port (24.12.) – auf Heroku gibt die Umgebung den Port vor. */
export const DEFAULT_PORT = 2412
const DEFAULT_FRONTEND_URL = 'https://adventskalender.bleck.it'
const DEV_SECRET = 'nur-fuer-die-lokale-entwicklung'
const DEV_ORIGINS = [
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

type Env = Record<string, string | undefined>

/**
 * Ein Eintrag aus CORS_ORIGINS. Ein `*` steht für genau einen Namensteil ohne Punkt –
 * so passen z. B. die Vorschau-Adressen von Cloudflare Workers
 * (`https://*-cedis-adventskalender.*.workers.dev`), aber keine fremden Domains.
 */
export function originPattern(origin: string): string | RegExp {
  if (!origin.includes('*')) return origin
  const escaped = origin.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\/-]/g, '\\$&'))
  return new RegExp(`^${escaped.join('[a-z0-9-]+')}$`, 'i')
}

function parseRewards(raw: string | undefined): Record<number, string> {
  if (!raw?.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('REWARDS_JSON ist kein gültiges JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('REWARDS_JSON muss ein Objekt der Form {"1": "Text", …} sein.')
  }
  const rewards: Record<number, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    const day = Number(key)
    if (!isValidDay(day) || typeof value !== 'string') {
      throw new Error(`REWARDS_JSON: ungültiger Eintrag für "${key}".`)
    }
    rewards[day] = value
  }
  return rewards
}

export function loadConfig(env: Env = process.env): Config {
  const isProduction = env.NODE_ENV === 'production'

  const secret = env.QR_SECRET?.trim() ?? ''
  if (isProduction && secret.length < 16) {
    throw new Error('QR_SECRET fehlt oder ist zu kurz (mindestens 16 Zeichen).')
  }

  const calendarYear = env.CALENDAR_YEAR ? Number(env.CALENDAR_YEAR) : DEFAULT_CALENDAR_YEAR
  if (!Number.isInteger(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
    throw new Error('CALENDAR_YEAR muss eine Jahreszahl sein, z. B. 2026.')
  }

  let debugDate: BerlinDate | null = null
  if (env.DEBUG_DATE?.trim()) {
    debugDate = parseIsoDate(env.DEBUG_DATE)
    if (!debugDate) throw new Error('DEBUG_DATE muss das Format JJJJ-MM-TT haben.')
  }

  const frontendUrl = (env.FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL).replace(/\/+$/, '')
  const configuredOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map(originPattern)
  const corsOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : isProduction
        ? [frontendUrl]
        : [frontendUrl, ...DEV_ORIGINS]

  const port = env.PORT ? Number(env.PORT) : DEFAULT_PORT
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT ist keine gültige Portnummer.')
  }

  return {
    port,
    isProduction,
    qrSecret: secret || DEV_SECRET,
    usesDevSecret: secret === '',
    calendarYear,
    debugDate,
    corsOrigins,
    frontendUrl,
    rewardMessages: parseRewards(env.REWARDS_JSON),
  }
}
