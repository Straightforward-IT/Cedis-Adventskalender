import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'
import { TOTAL_DAYS } from '../src/calendar.ts'
import { loadConfig } from '../src/config.ts'
import { deriveKey, formatToken } from '../src/keys.ts'

// Erzeugt die 24 QR-Codes (SVG + PNG) und einen Druckbogen im Ordner backend/qr-codes.

const config = loadConfig()
const outDir = path.resolve(import.meta.dirname, '..', 'qr-codes')
const qrOptions = { errorCorrectionLevel: 'M', margin: 2 } as const

const pad = (day: number) => String(day).padStart(2, '0')
const readable = (key: string) => `${key.slice(0, 5)}-${key.slice(5)}`

function printSheet(cells: string[]): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Weihnachtsstraße – QR-Codes</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #3b2a25; }
  .sheet { display: grid; grid-template-columns: repeat(4, 1fr); }
  figure { margin: 0; padding: 3mm 2mm 2mm; text-align: center; border: 0.2mm dashed #c9b8a6; break-inside: avoid; }
  figure svg { width: 34mm; height: 34mm; }
  figcaption { display: flex; flex-direction: column; gap: 0.5mm; font-size: 9pt; }
  figcaption span { font-family: ui-monospace, monospace; font-size: 7.5pt; letter-spacing: 0.04em; color: #7a655c; }
</style>
</head>
<body>
<main class="sheet">
${cells.join('\n')}
</main>
</body>
</html>
`
}

await mkdir(outDir, { recursive: true })

const cells: string[] = []
for (let day = 1; day <= TOTAL_DAYS; day++) {
  const key = deriveKey(config.qrSecret, day)
  const url = `${config.frontendUrl}/?k=${formatToken(day, key)}`
  const svg = await QRCode.toString(url, { ...qrOptions, type: 'svg' })
  await writeFile(path.join(outDir, `haus-${pad(day)}.svg`), svg)
  await QRCode.toFile(path.join(outDir, `haus-${pad(day)}.png`), url, { ...qrOptions, width: 1024 })
  cells.push(
    `<figure>${svg}<figcaption><strong>Haus ${day}</strong><span>${readable(key)}</span></figcaption></figure>`,
  )
}
await writeFile(path.join(outDir, 'druckbogen.html'), printSheet(cells))

console.log(`24 QR-Codes für ${config.frontendUrl} liegen in ${outDir}`)
console.log('Zum Drucken druckbogen.html im Browser öffnen. Unter jedem Code steht der Schlüssel zum Abtippen.')
if (config.usesDevSecret) {
  console.warn(
    '\nAchtung: QR_SECRET ist nicht gesetzt. Diese Codes passen nur zum lokalen Entwicklungs-Server,\n' +
      'nicht zu Heroku. Trage dasselbe QR_SECRET wie auf Heroku in backend/.env ein und starte erneut.',
  )
}
