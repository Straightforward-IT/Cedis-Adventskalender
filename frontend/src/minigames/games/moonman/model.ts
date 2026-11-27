/**
 * Mondstaub-Mann: Auf dem Mond liegt eine Schicht feiner Staub. Wer eine Kugel darüber
 * rollt, nimmt den Staub auf und die Kugel wächst. Wo schon gerollt wurde, liegt kaum
 * noch etwas – dort wächst sie nur noch ein bisschen. Drei Kugeln ergeben den Mann.
 */

/** Spielfeld: ein Quadrat von 2 · HALF Metern, aufgeteilt in CELLS × CELLS Staubfelder. */
export const FIELD = { half: 14, cells: 160 }
/** Bis hierhin (Abstand zur Mitte) darf gerollt werden – dahinter beginnt der Kraterrand. */
export const PLAY_RADIUS = 12
export const START_RADIUS = 0.22
/** Zielgröße jeder Kugel: unten groß, oben klein. */
export const TARGET_RADII = [1, 0.72, 0.5] as const
/** Aufgenommenes Volumen (m³) pro m² frischem Staub. */
export const DUST_THICKNESS = 0.14
/** Was auf schon abgerolltem Boden noch hängen bleibt (m³ pro m²) – fast nichts. */
export const RESIDUAL = 0.006
/** Anteil des Staubs, den die Kugel bei einer Berührung mitnimmt. */
const PICK = 0.85

export type Decor = 'sticks' | 'coins' | 'helmet'
export const DECOR: readonly Decor[] = ['sticks', 'coins', 'helmet']

export interface Point {
  x: number
  z: number
}

const CELL = (FIELD.half * 2) / FIELD.cells

export class DustField {
  /** Staubhöhe je Feld, 1 = frisch, 0 = abgerollt. */
  readonly depth: Float32Array
  /** Wird bei jeder Änderung hochgezählt – so weiß die Grafik, wann sie neu malen muss. */
  version = 0

  constructor() {
    this.depth = new Float32Array(FIELD.cells * FIELD.cells)
    for (let i = 0; i < this.depth.length; i++) {
      // Etwas unruhig, damit die Fläche nicht wie frisch gestrichen aussieht.
      const x = i % FIELD.cells
      const z = Math.floor(i / FIELD.cells)
      this.depth[i] = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(z * 0.45) * 2) * Math.cos(z * 0.6))
    }
  }

  /** Nimmt Staub im Kreis um (x, z) auf und liefert das Volumen in m³. */
  collect(point: Point, radius: number): number {
    const toCell = (v: number) => (v + FIELD.half) / CELL
    const x0 = Math.max(0, Math.floor(toCell(point.x - radius)))
    const x1 = Math.min(FIELD.cells - 1, Math.floor(toCell(point.x + radius)))
    const z0 = Math.max(0, Math.floor(toCell(point.z - radius)))
    const z1 = Math.min(FIELD.cells - 1, Math.floor(toCell(point.z + radius)))
    let volume = 0
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const cx = (x + 0.5) * CELL - FIELD.half
        const cz = (z + 0.5) * CELL - FIELD.half
        const gap = radius - Math.hypot(cx - point.x, cz - point.z)
        if (gap <= 0) continue
        // Am Rand der Spur nimmt die Kugel nur einen Teil mit – so wird die Spur weich statt treppig.
        // Aber mindestens die Hälfte: Sonst bliebe in der Randzone so viel liegen, dass eine
        // kleine Kugel in einer alten Spur fast wie auf frischem Staub wüchse.
        const edge = Math.min(1, 0.5 + gap / (CELL * 1.5))
        const i = z * FIELD.cells + x
        const take = this.depth[i] * PICK * edge
        if (take <= 0.0001) continue
        this.depth[i] -= take
        volume += take * CELL * CELL * DUST_THICKNESS
      }
    }
    if (volume > 0) this.version++
    return volume
  }

  /** Durchschnittliche Staubhöhe – wie viel noch zu holen ist. */
  remaining(): number {
    let sum = 0
    for (const d of this.depth) sum += d
    return sum / this.depth.length
  }
}

/** Breite der Spur, die eine Kugel zieht (halb). */
export const trackHalfWidth = (radius: number) => Math.max(0.18, radius * 0.6)

/** Rollt eine Kugel von `from` nach `to` und liefert das aufgesammelte Volumen. */
export function rollStep(field: DustField, from: Point, to: Point, radius: number): number {
  const distance = Math.hypot(to.x - from.x, to.z - from.z)
  if (distance === 0) return 0
  const half = trackHalfWidth(radius)
  const steps = Math.ceil(distance / (CELL * 0.5))
  let volume = 0
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    volume += field.collect({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }, half)
  }
  return volume + distance * 2 * half * RESIDUAL
}

export const volumeOf = (radius: number) => (4 / 3) * Math.PI * radius ** 3
export const radiusOf = (volume: number) => Math.cbrt((3 * volume) / (4 * Math.PI))

/** Neue Größe nach dem Aufsammeln – nie über das Ziel hinaus. */
export function grow(radius: number, volume: number, target: number): number {
  return Math.min(target, radiusOf(volumeOf(radius) + volume))
}

/** 0 bei Startgröße, 1 bei Zielgröße. */
export function sizeProgress(radius: number, target: number): number {
  return Math.max(0, Math.min(1, (radius - START_RADIUS) / (target - START_RADIUS)))
}

/** Höhe der Kugelmitten im fertigen Turm – jede sinkt ein wenig in die darunter ein. */
export function stackHeights(radii: readonly number[] = TARGET_RADII): number[] {
  const heights: number[] = []
  radii.forEach((radius, i) => {
    heights.push(i === 0 ? radius : heights[i - 1] + (radii[i - 1] + radius) * 0.84)
  })
  return heights
}

/** Hält eine Kugel im Krater und außerhalb der schon liegenden Grundkugel. */
export function keepInside(point: Point, radius: number, obstacle: { point: Point; radius: number } | null): Point {
  let { x, z } = point
  const reach = PLAY_RADIUS - radius
  const distance = Math.hypot(x, z)
  if (distance > reach) {
    x *= reach / distance
    z *= reach / distance
  }
  if (obstacle) {
    const dx = x - obstacle.point.x
    const dz = z - obstacle.point.z
    const gap = Math.hypot(dx, dz)
    const min = obstacle.radius + radius
    if (gap < min) {
      const scale = gap > 0.0001 ? min / gap : 1
      x = obstacle.point.x + (gap > 0.0001 ? dx : min) * scale
      z = obstacle.point.z + (gap > 0.0001 ? dz : 0) * scale
    }
  }
  return { x, z }
}

/** Wo die nächste Kugel beginnt: ein Stück weg vom Schneemann, Richtung Kratermitte. */
export function spawnPoint(base: Point): Point {
  const distance = Math.hypot(base.x, base.z)
  const dir = distance > 3 ? { x: -base.x / distance, z: -base.z / distance } : { x: 1, z: 0.4 }
  const length = Math.hypot(dir.x, dir.z)
  return keepInside({ x: base.x + (dir.x / length) * 5, z: base.z + (dir.z / length) * 5 }, 1, null)
}

/** Gemerkter Stand: wie viele Kugeln schon stehen, wo der Mann steht und was er schon trägt. */
export interface MoonProgress {
  stacked: number
  base: Point
  decor: Decor[]
}

export function restoreProgress(value: unknown): MoonProgress | null {
  const v = value as Partial<MoonProgress> | null
  if (!v || typeof v !== 'object') return null
  const stacked = Number.isInteger(v.stacked) ? Math.max(0, Math.min(3, v.stacked as number)) : 0
  const base = v.base && Number.isFinite(v.base.x) && Number.isFinite(v.base.z) ? keepInside(v.base, TARGET_RADII[0], null) : { x: 0, z: 0 }
  const decor = Array.isArray(v.decor) ? DECOR.filter((d) => (v.decor as unknown[]).includes(d)) : []
  if (stacked === 0) return null
  return { stacked, base, decor: stacked === 3 ? decor : [] }
}
