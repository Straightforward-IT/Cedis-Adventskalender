/**
 * Eingeschneit: Das Fenster ist voller Schnee. Wer ins Mikrofon pustet, weht ihn
 * Stück für Stück von der Scheibe – und entdeckt den Wichtel, der unten hereinlugt.
 *
 * Der Schnee ist ein Raster aus Zellen mit einer Tiefe von 0 (frei) bis MAX_DEPTH.
 * Pusten trägt Schnee ab: in der Mitte am schnellsten, an Lochrändern schneller als
 * auf geschlossener Decke. Unten liegt am meisten – der Wichtel kommt zuletzt zum Vorschein.
 */

export const COLS = 30
export const ROWS = 36
export const MAX_DEPTH = 100
/** Ab diesem Anteil freier Zellen weht der Rest von allein davon. */
export const CLEAR_AT = 0.88
/** Tiefe pro Sekunde, die kräftiges Pusten (Stärke 1) in der Mitte abträgt. */
export const BLOW_RATE = 34
/** Leiseres zählt nicht – sonst schmilzt der Schnee schon vom Rauschen im Raum. */
export const MIN_STRENGTH = 0.05
/** So schnell verschwindet der Rest, wenn das Fenster fast frei ist. */
const SWEEP_RATE = 180

export interface SnowState {
  /** Tiefe je Zelle, zeilenweise von oben links. */
  snow: number[]
}

/** Kleiner, fester Zufall – damit jeder dasselbe Schneebild bekommt und Tests stabil sind. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function freshSnow(seed = 1203): number[] {
  const random = seededRandom(seed)
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const row = Math.floor(i / COLS)
    return Math.min(MAX_DEPTH, Math.round(60 + 32 * (row / (ROWS - 1)) + random() * 14))
  })
}

export function restoreSnow(value: unknown): number[] | null {
  const snow = (value as Partial<SnowState> | null)?.snow
  if (!Array.isArray(snow) || snow.length !== COLS * ROWS) return null
  if (!snow.every((depth) => typeof depth === 'number' && Number.isFinite(depth))) return null
  return snow.map((depth) => Math.max(0, Math.min(MAX_DEPTH, depth)))
}

/** Gemerkter Stand – beim Wiederholen eines gelösten Hauses aber frischer Schnee. */
export function startSnow(value: unknown, completedBefore: boolean): number[] {
  const restored = restoreSnow(value)
  if (!restored || (completedBefore && isClear(restored))) return freshSnow()
  return restored
}

export function snapshot(snow: readonly number[]): SnowState {
  return { snow: snow.map((depth) => Math.round(depth)) }
}

/** Wie stark der Atem eine Zelle trifft: Mitte (etwas oberhalb) voll, Ecken gut halb. */
const WEIGHTS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const dx = (col - (COLS - 1) / 2) / (COLS / 2)
  const dy = (row - (ROWS - 1) * 0.42) / (ROWS / 2)
  return 1 - 0.45 * Math.min(1, Math.hypot(dx, dy) / Math.SQRT2)
})

/**
 * Fest verteilte, weich verlaufende Härte je Zelle (0.6–1.4): So entstehen beim Pusten
 * rundliche Löcher statt eines Schachbretts.
 */
const TOUGHNESS = (() => {
  const random = seededRandom(2412)
  const step = 6
  const cw = Math.ceil(COLS / step) + 1
  const ch = Math.ceil(ROWS / step) + 1
  const coarse = Array.from({ length: cw * ch }, () => random())
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const gx = (i % COLS) / step
    const gy = Math.floor(i / COLS) / step
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const tx = smooth(gx - x0)
    const ty = smooth(gy - y0)
    const at = (x: number, y: number) => coarse[y * cw + x]
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
    return 0.6 + 0.8 * (top + (bottom - top) * ty)
  })
})()

function openNeighbours(snow: readonly number[], i: number): number {
  const col = i % COLS
  let open = 0
  if (col > 0 && snow[i - 1] <= 0) open++
  if (col < COLS - 1 && snow[i + 1] <= 0) open++
  if (i >= COLS && snow[i - COLS] <= 0) open++
  if (i < COLS * (ROWS - 1) && snow[i + COLS] <= 0) open++
  return open
}

/**
 * Pustet `dt` Sekunden lang mit `strength` (0–1). Verändert `snow` direkt – das läuft
 * in jedem Bild – und gibt zurück, wie viel Schnee dabei weggeweht wurde.
 */
export function blow(snow: number[], strength: number, dt: number, random: () => number = Math.random): number {
  if (strength < MIN_STRENGTH || dt <= 0) return 0
  const base = Math.min(1, strength) * BLOW_RATE * dt
  let removed = 0
  for (let i = 0; i < snow.length; i++) {
    if (snow[i] <= 0) continue
    const edge = 1 + 0.7 * (openNeighbours(snow, i) / 4)
    const loss = Math.min(snow[i], (base * WEIGHTS[i] * edge * (0.85 + 0.3 * random())) / TOUGHNESS[i])
    snow[i] -= loss
    removed += loss
  }
  return removed
}

/** Schwamm: Radius in Zellen und wie viel Schnee ein Wisch in der Mitte mitnimmt. */
export const SPONGE_RADIUS = 3.4
export const SPONGE_DEPTH = 38

/**
 * Wischt mit dem Schwamm von `from` nach `to` (Anteile der Scheibe, 0–1) über den Schnee.
 * In der Mitte des Schwamms am kräftigsten, zum Rand hin weich. Verändert `snow` direkt und
 * gibt zurück, wie viel Schnee dabei abgewischt wurde. Ein paar Wische sind nötig, nicht einer.
 */
export function wipe(snow: number[], from: { x: number; y: number }, to: { x: number; y: number }): number {
  // Entlang der Strecke in kleinen Schritten, damit schnelle Wische keine Lücken lassen.
  const dx = (to.x - from.x) * COLS
  const dy = (to.y - from.y) * ROWS
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (SPONGE_RADIUS * 0.5)))
  // Pro Zelle nur einmal je Wisch abtragen – sonst zählt ein Zittern auf der Stelle mehrfach.
  const touched = new Map<number, number>()
  for (let s = 0; s <= steps; s++) {
    const cx = (from.x + (to.x - from.x) * (s / steps)) * COLS
    const cy = (from.y + (to.y - from.y) * (s / steps)) * ROWS
    const r = Math.ceil(SPONGE_RADIUS)
    for (let row = Math.floor(cy) - r; row <= Math.floor(cy) + r; row++) {
      if (row < 0 || row >= ROWS) continue
      for (let col = Math.floor(cx) - r; col <= Math.floor(cx) + r; col++) {
        if (col < 0 || col >= COLS) continue
        const distance = Math.hypot(col + 0.5 - cx, row + 0.5 - cy) / SPONGE_RADIUS
        if (distance >= 1) continue
        const strength = 1 - distance * distance
        const i = row * COLS + col
        touched.set(i, Math.max(touched.get(i) ?? 0, strength))
      }
    }
  }
  let removed = 0
  for (const [i, strength] of touched) {
    if (snow[i] <= 0) continue
    const loss = Math.min(snow[i], (SPONGE_DEPTH * strength) / TOUGHNESS[i])
    snow[i] -= loss
    removed += loss
  }
  return removed
}

/** Der letzte Rest weht ohne weiteres Zutun davon. */
export function sweep(snow: number[], dt: number): void {
  for (let i = 0; i < snow.length; i++) snow[i] = Math.max(0, snow[i] - SWEEP_RATE * dt)
}

export function clearedFraction(snow: readonly number[]): number {
  let open = 0
  for (const depth of snow) if (depth <= 0) open++
  return open / snow.length
}

const FRESH_TOTAL = freshSnow().reduce((sum, depth) => sum + depth, 0)

/** Wie viel Schnee schon weggeweht ist (0–1) – für die Fortschrittsanzeige. */
export function blownAway(snow: readonly number[]): number {
  const left = snow.reduce((sum, depth) => sum + Math.max(0, depth), 0)
  return Math.min(1, Math.max(0, 1 - left / FRESH_TOTAL))
}

export function isClear(snow: readonly number[]): boolean {
  return snow.every((depth) => depth <= 0)
}
