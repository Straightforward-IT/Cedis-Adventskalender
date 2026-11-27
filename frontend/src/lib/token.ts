import { isValidDay } from './calendar.ts'

/** Der „Schlüssel“ aus einem QR-Code: Hausnummer plus Geheimcode. */
export interface DoorToken {
  day: number
  key: string
}

/** Gleiche Regeln wie im Backend: Groß-/Kleinschreibung, Trennzeichen und O/I/L verzeihen. */
export function normalizeKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export function parseToken(token: string): DoorToken | null {
  const match = /^(\d{1,2})\.([0-9A-Za-z-]{4,32})$/.exec(token.trim())
  if (!match) return null
  const day = Number(match[1])
  return isValidDay(day) ? { day, key: normalizeKey(match[2]) } : null
}

/** Liest den Schlüssel aus gescanntem Text: entweder die ganze Adresse (`…/?k=5.ABC…`) oder nur `5.ABC…`. */
export function extractToken(text: string): DoorToken | null {
  const trimmed = text.trim()
  try {
    const fromUrl = new URL(trimmed).searchParams.get('k')
    if (fromUrl) return parseToken(fromUrl)
  } catch {
    // kein URL – dann vielleicht der nackte Schlüssel
  }
  return parseToken(trimmed)
}

/** Für die Anzeige und zum Vergleichen mit dem Aufdruck: `ABCDE-FGHJK`. */
export function formatKey(key: string): string {
  return key.length > 5 ? `${key.slice(0, 5)}-${key.slice(5)}` : key
}
