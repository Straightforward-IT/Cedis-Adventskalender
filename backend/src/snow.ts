import { berlinDate, formatIsoDate } from './calendar.ts'

/** Hamburg (Rathausmarkt). */
const LATITUDE = 53.5511
const LONGITUDE = 9.9937
const LOCATION = 'Hamburg'

const COMMON_QUERY = `latitude=${LATITUDE}&longitude=${LONGITUDE}&timezone=Europe%2FBerlin&forecast_days=1`

/** 40 Modellläufe des DWD-Ensembles – daraus ergibt sich eine echte Wahrscheinlichkeit. */
export const ENSEMBLE_URL = `https://ensemble-api.open-meteo.com/v1/ensemble?${COMMON_QUERY}&hourly=snowfall&models=icon_seamless`
export const FORECAST_URL = `https://api.open-meteo.com/v1/forecast?${COMMON_QUERY}&hourly=snowfall,precipitation_probability,temperature_2m&daily=snowfall_sum,temperature_2m_min,temperature_2m_max`

/** Ab dieser Tagesmenge (cm, entspricht ca. 0,1 mm Niederschlag) zählt ein Modelllauf als „es schneit“. */
export const SNOW_THRESHOLD_CM = 0.07

export interface SnowReport {
  location: string
  /** Tag, für den die Vorhersage gilt (JJJJ-MM-TT, Berliner Zeit). */
  date: string
  /** Wahrscheinlichkeit in Prozent, dass es an diesem Tag schneit. */
  probability: number
  snowfallCm: number | null
  temperatureMin: number | null
  temperatureMax: number | null
  method: 'ensemble' | 'forecast'
  updatedAt: string
  /** Gesetzt, wenn die Wetterdaten gerade nicht aktualisiert werden konnten. */
  stale?: boolean
}

export interface SnowService {
  get(): Promise<SnowReport>
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function seriesSum(values: unknown): number | null {
  if (!Array.isArray(values)) return null
  let sum = 0
  let seen = false
  for (const value of values) {
    const n = asNumber(value)
    if (n !== null) {
      sum += n
      seen = true
    }
  }
  return seen ? sum : null
}

/** Anteil der Ensemble-Läufe, in denen es im Tagesverlauf schneit. */
export function probabilityFromEnsemble(
  hourly: unknown,
): { probability: number; members: number } | null {
  const series = asRecord(hourly)
  if (!series) return null
  let members = 0
  let snowy = 0
  for (const [name, values] of Object.entries(series)) {
    if (!/^snowfall(_member\d+)?$/.test(name)) continue
    const total = seriesSum(values)
    if (total === null) continue
    members += 1
    if (total >= SNOW_THRESHOLD_CM) snowy += 1
  }
  if (members === 0) return null
  return { probability: Math.round((snowy / members) * 100), members }
}

/**
 * Ersatzrechnung ohne Ensemble: Niederschlagswahrscheinlichkeit einer Stunde
 * mal dem Anteil, der bei der Temperatur als Schnee fallen würde.
 */
export function probabilityFromForecast(hourly: unknown): number | null {
  const series = asRecord(hourly)
  if (!series) return null
  const at = (name: string, index: number) => {
    const values = series[name]
    return Array.isArray(values) ? asNumber(values[index]) : null
  }
  const length = Math.max(
    ...['snowfall', 'precipitation_probability', 'temperature_2m'].map((name) => {
      const values = series[name]
      return Array.isArray(values) ? values.length : 0
    }),
  )

  let best = 0
  let seen = false
  for (let hour = 0; hour < length; hour++) {
    const snowfall = at('snowfall', hour)
    const temperature = at('temperature_2m', hour)
    if (snowfall === null && temperature === null) continue
    seen = true
    const snowing = snowfall !== null && snowfall > 0
    const snowShare = snowing
      ? 1
      : temperature === null
        ? 0
        : Math.min(1, Math.max(0, (2 - temperature) / 2.5))
    const chance = at('precipitation_probability', hour) ?? (snowing ? 60 : 0)
    best = Math.max(best, chance * snowShare)
  }
  return seen ? Math.round(best) : null
}

function firstNumber(daily: Record<string, unknown> | null, name: string): number | null {
  const values = daily?.[name]
  return Array.isArray(values) ? asNumber(values[0]) : null
}

function firstDate(daily: Record<string, unknown> | null): string | null {
  const values = daily?.time
  const first = Array.isArray(values) ? values[0] : null
  return typeof first === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(first) ? first : null
}

export interface SnowServiceOptions {
  fetchImpl?: typeof fetch
  now?: () => Date
  /** Wie lange ein Ergebnis wiederverwendet wird. */
  ttlMs?: number
  /** Pause nach einem Fehlschlag, bevor die Wetter-API erneut gefragt wird. */
  retryAfterMs?: number
  timeoutMs?: number
}

export function createSnowService(options: SnowServiceOptions = {}): SnowService {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => new Date())
  const ttlMs = options.ttlMs ?? 30 * 60_000
  const retryAfterMs = options.retryAfterMs ?? 60_000
  const timeoutMs = options.timeoutMs ?? 8000

  let cached: { report: SnowReport; fetchedAt: number } | null = null
  let lastFailureAt = Number.NEGATIVE_INFINITY
  let inflight: Promise<SnowReport> | null = null

  async function fetchJson(url: string): Promise<Record<string, unknown>> {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`Open-Meteo antwortet mit ${response.status}`)
    const body = asRecord(await response.json())
    if (!body) throw new Error('Unerwartete Antwort von Open-Meteo')
    return body
  }

  async function load(): Promise<SnowReport> {
    const [ensembleResult, forecastResult] = await Promise.allSettled([
      fetchJson(ENSEMBLE_URL),
      fetchJson(FORECAST_URL),
    ])
    const ensemble =
      ensembleResult.status === 'fulfilled'
        ? probabilityFromEnsemble(ensembleResult.value.hourly)
        : null
    const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : null
    const probability = ensemble?.probability ?? probabilityFromForecast(forecast?.hourly)
    if (probability === null) throw new Error('Keine Wetterdaten verfügbar')

    const daily = asRecord(forecast?.daily)
    return {
      location: LOCATION,
      date: firstDate(daily) ?? formatIsoDate(berlinDate(now())),
      probability,
      snowfallCm: firstNumber(daily, 'snowfall_sum'),
      temperatureMin: firstNumber(daily, 'temperature_2m_min'),
      temperatureMax: firstNumber(daily, 'temperature_2m_max'),
      method: ensemble ? 'ensemble' : 'forecast',
      updatedAt: now().toISOString(),
    }
  }

  return {
    async get() {
      const time = now().getTime()
      const today = formatIsoDate(berlinDate(now()))
      const usable = cached?.report.date === today ? cached : null
      if (usable && time - usable.fetchedAt < ttlMs) return usable.report

      if (time - lastFailureAt < retryAfterMs) {
        if (usable) return { ...usable.report, stale: true }
        throw new Error('Wetterdaten sind gerade nicht erreichbar')
      }

      inflight ??= load()
        .then((report) => {
          cached = { report, fetchedAt: now().getTime() }
          return report
        })
        .catch((error: unknown) => {
          lastFailureAt = now().getTime()
          throw error
        })
        .finally(() => {
          inflight = null
        })

      try {
        return await inflight
      } catch (error) {
        if (usable) return { ...usable.report, stale: true }
        throw error
      }
    },
  }
}
