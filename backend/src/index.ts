import { createApp } from './app.ts'
import { formatIsoDate } from './calendar.ts'
import { loadConfig } from './config.ts'
import { createSnowService } from './snow.ts'

const config = loadConfig()
const app = createApp({ config, snow: createSnowService() })

const server = app.listen(config.port, (error?: Error) => {
  if (error) throw error
  console.log(`Weihnachtsstraße-API läuft auf Port ${config.port} (Kalenderjahr ${config.calendarYear})`)
  if (config.usesDevSecret) {
    console.warn('QR_SECRET ist nicht gesetzt – es wird ein Entwicklungs-Geheimnis verwendet.')
  }
  if (config.debugDate) {
    console.warn(`DEBUG_DATE aktiv: Der Server tut so, als wäre heute ${formatIsoDate(config.debugDate)}.`)
  }
})

// Heroku beendet Dynos mit SIGTERM – laufende Anfragen noch sauber beantworten.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
