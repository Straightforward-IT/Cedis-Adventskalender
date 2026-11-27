export const TOTAL_DAYS = 24

/** Kalenderdatum in der Zeitzone Europe/Berlin. */
export interface BerlinDate {
  year: number
  month: number
  day: number
}

const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function berlinDate(now: Date): BerlinDate {
  const parts = berlinFormatter.formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

export function parseIsoDate(value: string): BerlinDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(year, month - 1, day))
  const valid =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
  return valid ? { year, month, day } : null
}

export function formatIsoDate(date: BerlinDate): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

/**
 * Anzahl der freigeschalteten Häuser (0–24). Haus n öffnet am n. Dezember
 * um 0 Uhr Berliner Zeit und bleibt danach dauerhaft offen.
 */
export function unlockedDays(today: BerlinDate, calendarYear: number): number {
  if (today.year < calendarYear) return 0
  if (today.year > calendarYear) return TOTAL_DAYS
  if (today.month < 12) return 0
  return Math.min(today.day, TOTAL_DAYS)
}

/** Zeitpunkt, an dem ein Haus öffnet. Im Dezember gilt in Berlin immer MEZ (UTC+1). */
export function opensAt(day: number, calendarYear: number): string {
  return `${calendarYear}-12-${String(day).padStart(2, '0')}T00:00:00+01:00`
}

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= TOTAL_DAYS
}
