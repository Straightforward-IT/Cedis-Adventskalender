import { describe, expect, it, vi } from 'vitest'
import {
  ENSEMBLE_URL,
  FORECAST_URL,
  createSnowService,
  probabilityFromEnsemble,
  probabilityFromForecast,
} from '../src/snow.ts'

const hours = (value: number) => Array.from({ length: 24 }, () => value)

/** Ensemble mit 40 Läufen, von denen `snowy` Schnee bringen. */
function ensembleHourly(snowy: number) {
  const hourly: Record<string, unknown> = { time: hours(0).map((_, h) => `2026-12-05T${h}:00`) }
  for (let member = 0; member < 40; member++) {
    const name = member === 0 ? 'snowfall' : `snowfall_member${String(member).padStart(2, '0')}`
    hourly[name] = member < snowy ? [...hours(0).slice(1), 0.35] : hours(0)
  }
  return hourly
}

const forecastBody = {
  hourly: {
    snowfall: hours(0),
    precipitation_probability: hours(40),
    temperature_2m: hours(-1),
  },
  daily: {
    time: ['2026-12-05'],
    snowfall_sum: [1.4],
    temperature_2m_min: [-3.1],
    temperature_2m_max: [0.6],
  },
}

function fakeFetch(responses: { ensemble?: unknown; forecast?: unknown }) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    const body = url === ENSEMBLE_URL ? responses.ensemble : url === FORECAST_URL ? responses.forecast : undefined
    if (body === undefined) return new Response('kaputt', { status: 500 })
    return Response.json(body)
  })
}

describe('probabilityFromEnsemble', () => {
  it('ist der Anteil der Modellläufe mit Schneefall', () => {
    expect(probabilityFromEnsemble(ensembleHourly(10))).toEqual({ probability: 25, members: 40 })
    expect(probabilityFromEnsemble(ensembleHourly(0))?.probability).toBe(0)
    expect(probabilityFromEnsemble(ensembleHourly(40))?.probability).toBe(100)
  })

  it('zählt nur messbaren Schneefall und ignoriert Lücken', () => {
    const hourly = {
      snowfall: [0.01, 0.02, null],
      snowfall_member01: [0.05, 0.05, null],
      snowfall_member02: [null, null, null],
      temperature_2m: [5, 5, 5],
    }
    expect(probabilityFromEnsemble(hourly)).toEqual({ probability: 50, members: 2 })
  })

  it('gibt ohne Daten null zurück', () => {
    expect(probabilityFromEnsemble({ time: [] })).toBeNull()
    expect(probabilityFromEnsemble(undefined)).toBeNull()
  })
})

describe('probabilityFromForecast', () => {
  it('nimmt bei Frost die Niederschlagswahrscheinlichkeit', () => {
    expect(probabilityFromForecast(forecastBody.hourly)).toBe(40)
  })

  it('ergibt bei mildem Wetter null Prozent', () => {
    expect(
      probabilityFromForecast({ ...forecastBody.hourly, temperature_2m: hours(8) }),
    ).toBe(0)
  })

  it('wertet vorhergesagten Schneefall auch knapp über null Grad als Schnee', () => {
    const hourly = {
      snowfall: [0, 0.4],
      precipitation_probability: [10, 70],
      temperature_2m: [3, 1.5],
    }
    expect(probabilityFromForecast(hourly)).toBe(70)
  })
})

describe('createSnowService', () => {
  const noon = new Date('2026-12-05T11:00:00Z')

  it('kombiniert Ensemble-Wahrscheinlichkeit mit den Tageswerten', async () => {
    const fetchImpl = fakeFetch({ ensemble: { hourly: ensembleHourly(30) }, forecast: forecastBody })
    const report = await createSnowService({ fetchImpl, now: () => noon }).get()
    expect(report).toMatchObject({
      location: 'Hamburg',
      date: '2026-12-05',
      probability: 75,
      snowfallCm: 1.4,
      temperatureMin: -3.1,
      temperatureMax: 0.6,
      method: 'ensemble',
    })
  })

  it('fragt die Wetter-API innerhalb der Cache-Dauer nur einmal', async () => {
    const fetchImpl = fakeFetch({ ensemble: { hourly: ensembleHourly(4) }, forecast: forecastBody })
    let time = noon.getTime()
    const service = createSnowService({ fetchImpl, now: () => new Date(time), ttlMs: 60_000 })

    await Promise.all([service.get(), service.get()])
    time += 59_000
    await service.get()
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    time += 2_000
    await service.get()
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('weicht auf die normale Vorhersage aus, wenn das Ensemble ausfällt', async () => {
    const fetchImpl = fakeFetch({ forecast: forecastBody })
    const report = await createSnowService({ fetchImpl, now: () => noon }).get()
    expect(report).toMatchObject({ probability: 40, method: 'forecast' })
  })

  it('liefert bei einem Ausfall den letzten Stand von heute und schont die Wetter-API', async () => {
    let online = true
    const working = fakeFetch({ ensemble: { hourly: ensembleHourly(20) }, forecast: forecastBody })
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      online ? working(input) : new Response('kaputt', { status: 502 }),
    )
    let time = noon.getTime()
    const service = createSnowService({ fetchImpl, now: () => new Date(time), ttlMs: 60_000 })

    await service.get()
    online = false
    time += 120_000
    expect(await service.get()).toMatchObject({ probability: 50, stale: true })
    const callsAfterFailure = fetchImpl.mock.calls.length

    time += 10_000
    expect(await service.get()).toMatchObject({ stale: true })
    expect(fetchImpl).toHaveBeenCalledTimes(callsAfterFailure)
  })

  it('verwendet keine Werte von gestern', async () => {
    let online = true
    const working = fakeFetch({ ensemble: { hourly: ensembleHourly(20) }, forecast: forecastBody })
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      online ? working(input) : new Response('kaputt', { status: 502 }),
    )
    let time = noon.getTime()
    const service = createSnowService({ fetchImpl, now: () => new Date(time) })

    await service.get()
    online = false
    time += 24 * 3_600_000
    await expect(service.get()).rejects.toThrow()
  })
})
