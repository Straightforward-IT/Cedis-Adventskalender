export const TOTAL_DAYS = 24
export const DEFAULT_CALENDAR_YEAR = 2026

const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Heutiges Datum in Berlin als JJJJ-MM-TT. */
export function berlinToday(now: Date): string {
  return berlinFormatter.format(now)
}

/**
 * Freigeschaltete Häuser laut Datum (JJJJ-MM-TT). Maßgeblich ist der Server;
 * das hier dient nur der Anzeige, solange er nicht erreichbar ist.
 */
export function unlockedDaysOn(today: string, calendarYear: number): number {
  const [year, month, day] = today.split('-').map(Number)
  if (year < calendarYear) return 0
  if (year > calendarYear) return TOTAL_DAYS
  if (month < 12) return 0
  return Math.min(day, TOTAL_DAYS)
}

/** Wie oft noch geschlafen werden muss, bis ein Haus öffnet (0 = heute oder schon offen). */
export function sleepsUntil(day: number, today: string, calendarYear: number): number {
  const [year, month, date] = today.split('-').map(Number)
  const opening = Date.UTC(calendarYear, 11, day)
  const current = Date.UTC(year, month - 1, date)
  return Math.max(0, Math.round((opening - current) / 86_400_000))
}

export function formatDay(day: number): string {
  return `${day}. Dezember`
}

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= TOTAL_DAYS
}
