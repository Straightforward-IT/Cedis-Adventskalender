import { BOARD, GARAGE, HOOP } from '../../../scene/garage.ts'

/**
 * Weihnachtskugelball: Vor der Garage zwischen Haus 14 und 15 wirft man von der Straße aus
 * Christbaumkugeln in den Korb. Von fünf Plätzen aus muss je eine Kugel sauber durch den Ring –
 * berührt sie unterwegs irgendetwas (Ring, Brett, Wand, Boden), zerspringt sie.
 *
 * Gezielt wird automatisch auf den Korb; entscheidend ist die Kraft. Die Kraftanzeige pendelt,
 * solange man gedrückt hält. Loslassen im grünen Bereich – die Kugel rauscht durch.
 *
 * Koordinaten wie die Garage: x entlang der Straße (Mitte der Einfahrt = 0), y nach oben,
 * z zur Straße hin. Alles in Metern und Sekunden.
 */

export interface Vec {
  x: number
  y: number
  z: number
}

export interface Spot {
  x: number
  z: number
  /** Wo im Kraftbalken der Idealwurf liegt (0 … 1). */
  sweet: number
  name: string
}

export const GOAL = 5
export const BALL_RADIUS = 0.085
export const GRAVITY = 9.81
/** Abwurfwinkel über der Waagerechten. */
export const LAUNCH_ANGLE = (60 * Math.PI) / 180
/** So viel m/s liegen zwischen leerem und vollem Kraftbalken. */
export const POWER_SPAN = 2
/** Eine volle Pendelbewegung der Kraftanzeige (hoch und wieder runter). */
export const METER_PERIOD = 1.9
/** Augenhöhe und Abwurfhöhe. */
export const EYE_HEIGHT = 1.68
export const RELEASE_HEIGHT = 1.45

/** Fünf Wurfplätze auf der Straße – jeder aus einem anderen Winkel. */
export const SPOTS: readonly Spot[] = [
  { x: 0, z: 4.1, sweet: 0.5, name: 'Gerade vor dem Korb' },
  { x: -2.5, z: 3.7, sweet: 0.58, name: 'Links an der Laterne vorbei' },
  { x: 2.7, z: 4.6, sweet: 0.46, name: 'Von rechts' },
  { x: -1.5, z: 6.3, sweet: 0.64, name: 'Mitten auf der Straße' },
  { x: 1.9, z: 7.4, sweet: 0.7, name: 'Von der anderen Straßenseite' },
]

/** Pendelnder Kraftbalken: 0 → 1 → 0 in `METER_PERIOD` Sekunden. */
export function meter(heldSeconds: number): number {
  const t = (heldSeconds / METER_PERIOD) % 1
  return t < 0.5 ? t * 2 : 2 - t * 2
}

/** Horizontale Richtung vom Wurfplatz zum Korb. */
function aim(spot: Spot): { dx: number; dz: number; distance: number } {
  const dx = HOOP.x - spot.x
  const dz = HOOP.z - spot.z
  const distance = Math.hypot(dx, dz)
  return { dx: dx / distance, dz: dz / distance, distance }
}

/** Abwurfpunkt: eine Armlänge vor dem Auge, Richtung Korb, etwas unterhalb – dort ist die Kugel zu sehen. */
export function releasePoint(spot: Spot): Vec {
  const { dx, dz } = aim(spot)
  return { x: spot.x + dx * 0.8, y: RELEASE_HEIGHT, z: spot.z + dz * 0.8 }
}

/** Ziel des Idealwurfs: knapp hinter der Ringmitte – so fliegt die Kugel sicher über den vorderen Ring. */
const AIM_BEYOND = 0.05

/** Die Geschwindigkeit, mit der die Kugel genau durch den Zielpunkt im Ring fällt. */
export function idealSpeed(spot: Spot): number {
  const from = releasePoint(spot)
  const d = Math.hypot(HOOP.x - from.x, HOOP.z - from.z) + AIM_BEYOND
  const h = HOOP.y - from.y
  const cos = Math.cos(LAUNCH_ANGLE)
  return Math.sqrt((GRAVITY * d * d) / (2 * cos * cos * (d * Math.tan(LAUNCH_ANGLE) - h)))
}

export function speedFor(spot: Spot, power: number): number {
  return idealSpeed(spot) + (power - spot.sweet) * POWER_SPAN
}

export type Hit = 'rim' | 'board' | 'wall' | 'house' | 'ground'

export interface Flight {
  /** Positionen in gleichen Zeitabständen (`step` Sekunden). */
  path: Vec[]
  step: number
  /** Durch den Ring? Dann der Index im Pfad, an dem sie durchfällt. */
  scored: boolean
  scoreIndex: number
  /** Woran sie am Ende zerspringt. */
  hit: Hit
}

const STEP = 1 / 240

/** Rechnet einen Wurf durch – mit Kollisionen an Ring, Brett, Garage, Häusern und Boden. */
export function simulate(spot: Spot, power: number): Flight {
  const from = releasePoint(spot)
  const { dx, dz } = aim(spot)
  const speed = speedFor(spot, power)
  const horizontal = speed * Math.cos(LAUNCH_ANGLE)
  const v = { x: dx * horizontal, y: speed * Math.sin(LAUNCH_ANGLE), z: dz * horizontal }
  const p = { ...from }
  const path: Vec[] = [{ ...p }]
  let scored = false
  let scoreIndex = -1
  const r = BALL_RADIUS

  for (let i = 0; i < 4 / STEP; i++) {
    const prevY = p.y
    v.y -= GRAVITY * STEP
    p.x += v.x * STEP
    p.y += v.y * STEP
    p.z += v.z * STEP
    path.push({ ...p })

    // Durch den Ring gefallen (von oben nach unten, ohne ihn zu berühren)?
    if (!scored && prevY >= HOOP.y && p.y < HOOP.y && v.y < 0) {
      const off = Math.hypot(p.x - HOOP.x, p.z - HOOP.z)
      if (off < HOOP.radius - r) {
        scored = true
        scoreIndex = path.length - 1
        // Das Netz bremst: Die Kugel fällt danach fast senkrecht nach unten.
        v.x *= 0.15
        v.z *= 0.15
        v.y *= 0.6
      }
    }
    // Im Netz: Ring und Brett können sie nicht mehr treffen, nur noch der Boden.
    if (scored) {
      if (p.y - r <= 0) return { path, step: STEP, scored, scoreIndex, hit: 'ground' }
      continue
    }

    // Ring: Abstand zur Kreislinie des Rings
    const ringH = Math.hypot(p.x - HOOP.x, p.z - HOOP.z) - HOOP.radius
    if (Math.hypot(ringH, p.y - HOOP.y) < r + HOOP.tube) return { path, step: STEP, scored, scoreIndex, hit: 'rim' }

    // Brett
    if (
      p.z - r < BOARD.front && p.z + r > BOARD.back - 0.02 &&
      Math.abs(p.x) < BOARD.width / 2 + r && p.y > BOARD.bottom - r && p.y < BOARD.top + r
    ) return { path, step: STEP, scored, scoreIndex, hit: 'board' }

    // Garage (Wand und Dach vereinfacht als Block)
    if (p.z - r < GARAGE.front && Math.abs(p.x) < GARAGE.width / 2 + 0.3 && p.y < GARAGE.ridge + 0.1) {
      return { path, step: STEP, scored, scoreIndex, hit: 'wall' }
    }
    // Die Häuser links und rechts der Einfahrt
    if (p.z - r < 0.3 && Math.abs(p.x) > GARAGE.width / 2 + 0.6) return { path, step: STEP, scored, scoreIndex, hit: 'house' }

    if (p.y - r <= 0) return { path, step: STEP, scored, scoreIndex, hit: 'ground' }
  }
  return { path, step: STEP, scored, scoreIndex, hit: 'ground' }
}

/** Der grüne Bereich im Kraftbalken: von – bis, in dem der Wurf sauber durchgeht. */
export function sweetZone(spot: Spot): { from: number; to: number } {
  let from = -1
  let to = -1
  for (let power = 0; power <= 1.0001; power += 0.0025) {
    if (simulate(spot, power).scored) {
      if (from < 0) from = power
      to = power
    } else if (from >= 0) break
  }
  return { from: Math.max(0, from), to: Math.max(0, to) }
}

/** Gespeicherter Stand: wie viele Plätze schon geschafft sind (und wie viele Kugeln zersprungen). */
export function restore(saved: unknown): { scored: number; shattered: number } {
  if (!saved || typeof saved !== 'object') return { scored: 0, shattered: 0 }
  const { scored, shattered } = saved as { scored?: unknown; shattered?: unknown }
  const clamp = (value: unknown, max: number) =>
    typeof value === 'number' && Number.isInteger(value) ? Math.min(max, Math.max(0, value)) : 0
  return { scored: clamp(scored, GOAL), shattered: clamp(shattered, 999) }
}
