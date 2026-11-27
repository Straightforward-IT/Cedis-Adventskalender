import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { Config } from '../src/config.ts'
import { deriveKey } from '../src/keys.ts'
import type { SnowReport, SnowService } from '../src/snow.ts'

const SECRET = 'ein-geheimnis-fuer-die-tests'
const ORIGIN = 'https://adventskalender.bleck.it'

const snowReport: SnowReport = {
  location: 'Hamburg',
  date: '2026-12-05',
  probability: 35,
  snowfallCm: 0.4,
  temperatureMin: -1,
  temperatureMax: 2,
  method: 'ensemble',
  updatedAt: '2026-12-05T08:00:00.000Z',
}

interface Setup {
  now?: string
  env?: Record<string, string>
  snow?: SnowService
}

/** Startet die App auf einem freien Port und liefert eine kleine fetch-Hülle. */
async function withApi(
  { now = '2026-12-05T08:00:00Z', env = {}, snow = { get: async () => snowReport } }: Setup,
  run: (
    call: (path: string, init?: RequestInit) => Promise<{ status: number; body: any; headers: Headers }>,
    config: Config,
  ) => Promise<void>,
) {
  const config = loadConfig({ NODE_ENV: 'production', QR_SECRET: SECRET, CALENDAR_YEAR: '2026', ...env })
  const server = createApp({ config, snow, now: () => new Date(now) }).listen(0)
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    await run(async (path, init) => {
      const response = await fetch(base + path, init)
      return { status: response.status, body: await response.json(), headers: response.headers }
    }, config)
  } finally {
    server.closeAllConnections()
    server.close()
  }
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

describe('GET /api/status', () => {
  it('meldet die freigeschalteten Häuser und den nächsten Öffnungstermin', async () => {
    await withApi({}, async (call) => {
      const { status, body } = await call('/api/status')
      expect(status).toBe(200)
      expect(body).toMatchObject({
        today: '2026-12-05',
        calendarYear: 2026,
        unlockedDays: 5,
        nextUnlockAt: '2026-12-06T00:00:00+01:00',
        debug: false,
      })
    })
  })

  it('kennt nach Heiligabend keinen weiteren Termin', async () => {
    await withApi({ now: '2026-12-26T10:00:00Z' }, async (call) => {
      const { body } = await call('/api/status')
      expect(body).toMatchObject({ unlockedDays: 24, nextUnlockAt: null })
    })
  })

  it('rechnet mit DEBUG_DATE statt mit dem echten Datum', async () => {
    await withApi({ now: '2026-11-13T10:00:00Z', env: { DEBUG_DATE: '2026-12-12' } }, async (call) => {
      const { body } = await call('/api/status')
      expect(body).toMatchObject({ today: '2026-12-12', unlockedDays: 12, debug: true })
    })
  })
})

describe('POST /api/houses/:day/unlock', () => {
  it('schließt mit dem richtigen Schlüssel auf', async () => {
    await withApi({}, async (call) => {
      const { status, body } = await call('/api/houses/5/unlock', post({ key: deriveKey(SECRET, 5) }))
      expect(status).toBe(200)
      expect(body).toEqual({ ok: true, day: 5 })
    })
  })

  it('lehnt falsche und fremde Schlüssel ab', async () => {
    await withApi({}, async (call) => {
      for (const key of ['0000000000', deriveKey(SECRET, 4), undefined]) {
        const { status, body } = await call('/api/houses/5/unlock', post({ key }))
        expect(status).toBe(403)
        expect(body).toEqual({ error: 'invalid_key' })
      }
    })
  })

  it('lässt künftige Häuser trotz gültigem Schlüssel verschlossen', async () => {
    await withApi({}, async (call) => {
      const { status, body } = await call('/api/houses/6/unlock', post({ key: deriveKey(SECRET, 6) }))
      expect(status).toBe(403)
      expect(body).toEqual({ error: 'locked', opensAt: '2026-12-06T00:00:00+01:00' })
    })
  })

  it('verrät bei falschem Schlüssel nicht, wann ein Haus öffnet', async () => {
    await withApi({}, async (call) => {
      const { body } = await call('/api/houses/20/unlock', post({ key: 'FALSCH0000' }))
      expect(body).toEqual({ error: 'invalid_key' })
    })
  })

  it('weist ungültige Tage und kaputte Anfragen zurück', async () => {
    await withApi({}, async (call) => {
      for (const day of ['0', '25', '1.5', 'abc']) {
        const { status, body } = await call(`/api/houses/${day}/unlock`, post({ key: 'x' }))
        expect(status).toBe(400)
        expect(body).toEqual({ error: 'invalid_day' })
      }
      const broken = await call('/api/houses/5/unlock', post('{"key":'))
      expect(broken.status).toBe(400)
      expect(broken.body).toEqual({ error: 'bad_request' })
    })
  })

  it('bremst Rateversuche', async () => {
    await withApi({}, async (call) => {
      const attempts = await Promise.all(
        Array.from({ length: 35 }, () => call('/api/houses/5/unlock', post({ key: 'FALSCH0000' }))),
      )
      const limited = attempts.filter((attempt) => attempt.status === 429)
      expect(limited).toHaveLength(5)
      expect(limited[0].body).toEqual({ error: 'rate_limited' })
    })
  })
})

describe('POST /api/houses/:day/reward', () => {
  it('gibt die Belohnung nur mit Schlüssel und am richtigen Tag heraus', async () => {
    const env = { REWARDS_JSON: JSON.stringify({ 3: 'Ein Lebkuchenherz für dich!' }) }
    await withApi({ env }, async (call) => {
      const custom = await call('/api/houses/3/reward', post({ key: deriveKey(SECRET, 3) }))
      expect(custom.body).toEqual({ day: 3, title: 'Türchen 3', message: 'Ein Lebkuchenherz für dich!' })

      const standard = await call('/api/houses/4/reward', post({ key: deriveKey(SECRET, 4) }))
      expect(standard.body.message).toContain('Box 4')

      expect((await call('/api/houses/3/reward', post({ key: 'FALSCH0000' }))).status).toBe(403)
      expect((await call('/api/houses/9/reward', post({ key: deriveKey(SECRET, 9) }))).body.error).toBe('locked')
    })
  })
})

describe('GET /api/snow', () => {
  it('liefert den Schneebericht', async () => {
    await withApi({}, async (call) => {
      const { status, body } = await call('/api/snow')
      expect(status).toBe(200)
      expect(body).toEqual(snowReport)
    })
  })

  it('antwortet mit 503, wenn keine Wetterdaten da sind', async () => {
    const snow: SnowService = {
      get: async () => {
        throw new Error('offline')
      },
    }
    await withApi({ snow }, async (call) => {
      const { status, body } = await call('/api/snow')
      expect(status).toBe(503)
      expect(body).toEqual({ error: 'snow_unavailable' })
    })
  })
})

describe('CORS', () => {
  it('erlaubt nur das Frontend als Ursprung', async () => {
    await withApi({}, async (call) => {
      const allowed = await call('/api/status', { headers: { Origin: ORIGIN } })
      expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN)

      const foreign = await call('/api/status', { headers: { Origin: 'https://example.com' } })
      expect(foreign.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  it('erlaubt Muster mit * für Cloudflare-Adressen', async () => {
    const env = {
      CORS_ORIGINS: `${ORIGIN}, https://cedis-adventskalender.*.workers.dev, https://*-cedis-adventskalender.*.workers.dev`,
    }
    await withApi({ env }, async (call) => {
      const origin = async (value: string) =>
        (await call('/api/status', { headers: { Origin: value } })).headers.get('access-control-allow-origin')

      expect(await origin(ORIGIN)).toBe(ORIGIN)
      expect(await origin('https://cedis-adventskalender.cedi.workers.dev')).toBe('https://cedis-adventskalender.cedi.workers.dev')
      expect(await origin('https://1a2b3c4d-cedis-adventskalender.cedi.workers.dev')).toBe(
        'https://1a2b3c4d-cedis-adventskalender.cedi.workers.dev',
      )
      // Ein * überspringt keine Punkte – fremde Domains bleiben draußen.
      expect(await origin('https://cedis-adventskalender.evil.com.workers.dev')).toBeNull()
      expect(await origin('https://cedis-adventskalender.x.workers.dev.evil.com')).toBeNull()
      expect(await origin('http://cedis-adventskalender.cedi.workers.dev')).toBeNull()
    })
  })
})

describe('unbekannte Pfade', () => {
  it('antworten mit 404 als JSON', async () => {
    await withApi({}, async (call) => {
      const { status, body } = await call('/api/gibt-es-nicht')
      expect(status).toBe(404)
      expect(body).toEqual({ error: 'not_found' })
    })
  })
})
