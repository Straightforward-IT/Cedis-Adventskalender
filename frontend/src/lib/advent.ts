const DAY_MS = 86_400_000

/** Der 4. Advent: der letzte Sonntag vor dem 25. Dezember (UTC-Mitternacht). */
function fourthAdvent(year: number): number {
  const christmasEve = Date.UTC(year, 11, 24)
  const weekday = new Date(christmasEve).getUTCDay() // 0 = Sonntag
  return christmasEve - weekday * DAY_MS
}

/**
 * Wie viele Kerzen am Adventskranz brennen (0–4) an einem Tag (JJJJ-MM-TT).
 * Ab dem 1. Advent eine, ab jedem weiteren Adventssonntag eine mehr – bis Weihnachten vorbei ist.
 */
export function adventCandles(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return 0
  const year = Number(match[1])
  const date = Date.UTC(year, Number(match[2]) - 1, Number(match[3]))
  const fourth = fourthAdvent(year)
  if (date > Date.UTC(year, 11, 26)) return 4
  let lit = 0
  for (let week = 3; week >= 0; week--) if (date >= fourth - week * 7 * DAY_MS) lit++
  return lit
}
