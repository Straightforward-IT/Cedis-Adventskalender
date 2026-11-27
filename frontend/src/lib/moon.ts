/** Länge eines Mondzyklus (Neumond bis Neumond) in Tagen. */
const SYNODIC_MONTH = 29.530588853
/** Ein bekannter Neumond: 6. Januar 2000, 18:14 UTC. */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const DAY_MS = 86_400_000

/**
 * Mondphase als Anteil des Zyklus: 0 = Neumond, 0,25 = zunehmender Halbmond,
 * 0,5 = Vollmond, 0,75 = abnehmender Halbmond. Gerechnet mit dem mittleren Zyklus, also auf etwa einen halben Tag genau – fürs Bild reicht das.
 */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - REFERENCE_NEW_MOON) / DAY_MS
  const phase = (days / SYNODIC_MONTH) % 1
  return phase < 0 ? phase + 1 : phase
}

/** Mondphase am Abend eines Tages (JJJJ-MM-TT, Berliner Datum) – dann schaut man in den Himmel. */
export function eveningMoonPhase(day: string, fallback = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return moonPhase(fallback)
  // 20 Uhr Berliner Winterzeit = 19 Uhr UTC
  return moonPhase(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 19)))
}

/** Kurzer Name der Phase mit passendem Symbol, z. B. „🌔 zunehmender Mond“. */
export function phaseName(phase: number): string {
  const names = [
    '🌑 Neumond', '🌒 zunehmende Sichel', '🌓 zunehmender Halbmond', '🌔 zunehmender Mond',
    '🌕 Vollmond', '🌖 abnehmender Mond', '🌗 abnehmender Halbmond', '🌘 abnehmende Sichel',
  ]
  return names[Math.round(phase * 8) % 8]
}

/** Beleuchteter Anteil der Scheibe (0–1). */
export function illumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2
}
