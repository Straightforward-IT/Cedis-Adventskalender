/**
 * Schneeballschlacht: Hinter Schneehügeln tauchen Eichhörnchen auf – zehn wollen
 * getroffen werden. Schneebälle gibt es nicht unbegrenzt: Wer im Schnee rollt,
 * formt neue, höchstens drei auf einmal.
 */

export const GOAL = 10
export const MAX_AMMO = 3
/** So viele Pixel muss der Finger durch den Schnee rollen, bis ein Ball fertig ist. */
export const ROLL_DISTANCE = 480

export interface Ammo {
  balls: number
  /** Fortschritt am nächsten Ball (0–1). */
  forming: number
}

export const fullAmmo = (): Ammo => ({ balls: MAX_AMMO, forming: 0 })

/** Rollen um `pixels` – fertige Bälle wandern in den Vorrat, bis er voll ist. */
export function roll(ammo: Ammo, pixels: number): Ammo {
  if (ammo.balls >= MAX_AMMO) return { balls: MAX_AMMO, forming: 0 }
  let { balls, forming } = ammo
  forming += Math.max(0, pixels) / ROLL_DISTANCE
  while (forming >= 1 && balls < MAX_AMMO) {
    balls++
    forming -= 1
  }
  return { balls, forming: balls >= MAX_AMMO ? 0 : forming }
}

/** Einen Ball werfen – ohne Vorrat geht das nicht (dann null). */
export function take(ammo: Ammo): Ammo | null {
  return ammo.balls > 0 ? { ...ammo, balls: ammo.balls - 1 } : null
}

export interface SnowballProgress {
  hits: number
}

export function restoreHits(value: unknown): number {
  const hits = (value as Partial<SnowballProgress> | null)?.hits
  return Number.isInteger(hits) ? Math.max(0, Math.min(GOAL, hits as number)) : 0
}

/** Wo die Hügel stehen (x seitlich, z Entfernung, r Radius) – nah, mittel und fern gemischt. */
export const MOUNDS: readonly { x: number; z: number; r: number }[] = [
  { x: -3.2, z: 7, r: 1.2 },
  { x: 1.6, z: 7, r: 1.2 },
  { x: -5.6, z: 11, r: 1.5 },
  { x: -0.8, z: 11, r: 1.5 },
  { x: 4.4, z: 11, r: 1.5 },
  { x: -7.5, z: 16, r: 1.8 },
  { x: -2.8, z: 16, r: 1.8 },
  { x: 2.4, z: 16, r: 1.8 },
  { x: 7.2, z: 16, r: 1.8 },
]
