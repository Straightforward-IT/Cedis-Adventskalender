import cors from 'cors'
import express from 'express'
import type { ErrorRequestHandler, Express, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  TOTAL_DAYS,
  berlinDate,
  formatIsoDate,
  isValidDay,
  opensAt,
  unlockedDays,
} from './calendar.ts'
import type { Config } from './config.ts'
import { verifyKey } from './keys.ts'
import { rewardFor } from './rewards.ts'
import type { SnowService } from './snow.ts'

export interface AppDependencies {
  config: Config
  snow: SnowService
  now?: () => Date
}

export function createApp({ config, snow, now = () => new Date() }: AppDependencies): Express {
  const app = express()
  app.disable('x-powered-by')
  // Heroku stellt genau einen Proxy vor die App – nötig für korrekte Client-IPs im Rate-Limit.
  app.set('trust proxy', 1)

  app.use(cors({ origin: config.corsOrigins, maxAge: 86_400 }))
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '2kb' }))

  const today = () => config.debugDate ?? berlinDate(now())
  const currentlyUnlocked = () => unlockedDays(today(), config.calendarYear)

  app.get('/', (_req, res) => {
    res.json({ name: 'weihnachtsstrasse-api', status: 'ok' })
  })

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/api/status', (_req, res) => {
    const unlocked = currentlyUnlocked()
    res.json({
      serverTime: now().toISOString(),
      today: formatIsoDate(today()),
      calendarYear: config.calendarYear,
      unlockedDays: unlocked,
      nextUnlockAt: unlocked < TOTAL_DAYS ? opensAt(unlocked + 1, config.calendarYear) : null,
      debug: config.debugDate !== null,
    })
  })

  app.get('/api/snow', async (_req, res) => {
    try {
      const report = await snow.get()
      res.set('Cache-Control', 'public, max-age=300')
      res.json(report)
    } catch (error) {
      console.error('Schnee-o-Meter:', error instanceof Error ? error.message : error)
      res.status(503).json({ error: 'snow_unavailable' })
    }
  })

  const keyLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limited' },
  })

  /** Prüft Tag, Schlüssel und Datum. Antwortet im Fehlerfall selbst und liefert dann null. */
  function authorizeDoor(req: Request, res: Response): number | null {
    const day = Number(req.params.day)
    if (!isValidDay(day)) {
      res.status(400).json({ error: 'invalid_day' })
      return null
    }
    const body: unknown = req.body
    const key = body !== null && typeof body === 'object' ? (body as { key?: unknown }).key : undefined
    if (!verifyKey(config.qrSecret, day, key)) {
      res.status(403).json({ error: 'invalid_key' })
      return null
    }
    if (day > currentlyUnlocked()) {
      res.status(403).json({ error: 'locked', opensAt: opensAt(day, config.calendarYear) })
      return null
    }
    return day
  }

  app.post('/api/houses/:day/unlock', keyLimiter, (req, res) => {
    const day = authorizeDoor(req, res)
    if (day !== null) res.json({ ok: true, day })
  })

  app.post('/api/houses/:day/reward', keyLimiter, (req, res) => {
    const day = authorizeDoor(req, res)
    if (day !== null) res.json(rewardFor(day, config.rewardMessages))
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = Number((error as { status?: unknown } | null)?.status)
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: 'bad_request' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'internal_error' })
  }
  app.use(handleError)

  return app
}
