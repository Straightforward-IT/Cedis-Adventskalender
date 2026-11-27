import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import type { Point } from './batch.ts'
import { col } from './palette.ts'
import { addBulb } from './props.ts'

/** Abstand der Aufhänger und wie tief die Kette dazwischen durchhängt (m). */
const SPAN = 0.9
const SAG = 0.17
/** Abstand der Lämpchen entlang der Kette. */
const BULB_SPACING = 0.23
const WIRE = '#24432c'

/**
 * Obere Umrisslinie einer Dachkante: Von gestuften oder geknickten Kanten bleiben nur die
 * äußeren Ecken übrig – dort hängt man die Kette ein.
 */
export function upperHull(points: readonly Point[]): Point[] {
  const byX = new Map<number, number>()
  for (const [x, y] of points) {
    const key = Math.round(x * 1000) / 1000
    byX.set(key, Math.max(byX.get(key) ?? -Infinity, y))
  }
  const sorted = [...byX.entries()].sort((a, b) => a[0] - b[0])
  const hull: Point[] = []
  for (const p of sorted) {
    while (hull.length >= 2) {
      const [ax, ay] = hull[hull.length - 2]
      const [bx, by] = hull[hull.length - 1]
      // Liegt der mittlere Punkt unter der Verbindung, fliegt er raus.
      // Ecken auf einer Linie (Treppengiebel) bleiben als Aufhänger erhalten.
      if ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) > 1e-6) hull.pop()
      else break
    }
    hull.push(p)
  }
  return hull
}

/** Die Kette als Bögen zwischen Aufhängern entlang der oberen Dachkante. */
export function festoon(edge: readonly Point[]): { anchors: Point[]; curve: Point[] } {
  const hull = upperHull(edge)
  const anchors: Point[] = [hull[0]]
  const curve: Point[] = [hull[0]]
  for (let i = 0; i < hull.length - 1; i++) {
    const [x0, y0] = hull[i]
    const [x1, y1] = hull[i + 1]
    const spans = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / SPAN))
    for (let s = 0; s < spans; s++) {
      const steps = 10
      for (let k = 1; k <= steps; k++) {
        const t = (s + k / steps) / spans
        const local = k / steps
        curve.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - SAG * Math.sin(Math.PI * local)])
      }
      anchors.push([x0 + ((x1 - x0) * (s + 1)) / spans, y0 + ((y1 - y0) * (s + 1)) / spans])
    }
  }
  return { anchors, curve }
}

/**
 * Easter Egg aus Haus 3 („Lichterketten-Schlamassel“): die entwirrte Lichterkette, in Bögen
 * an der Dachkante aufgehängt, mit den bunten Lämpchen aus dem Spiel. Koordinaten wie das Haus.
 */
export function buildLightChain(
  eaves: { points: readonly Point[]; z: number },
  colors: readonly string[],
): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry; halo: THREE.BufferGeometry } {
  const solid = new Builder()
  const glow = new Builder()
  const halo = new Builder()
  const builders = { solid, glow, halo, rnd: createRandom(hashSeed(3, 'lichterkette')) }
  const wire = col(WIRE)
  const bulbs = colors.map(col)
  const z = eaves.z + 0.12
  const { anchors, curve } = festoon(eaves.points)

  // Das Kabel: kurze Zylinderstücke von Punkt zu Punkt.
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i]
    const [x1, y1] = curve[i + 1]
    const dx = x1 - x0
    const dy = y1 - y0
    solid.cylinder((x0 + x1) / 2, (y0 + y1) / 2, z, 0.016, 0.016, Math.hypot(dx, dy) + 0.01, 5, wire, { z: Math.atan2(-dx, dy) })
  }
  for (const [x, y] of anchors) solid.sphere(x, y, z, 0.035, 0.035, 0.035, wire)

  // Lämpchen in gleichen Abständen, ein wenig unter dem Kabel hängend.
  let carry = BULB_SPACING / 2
  let lamp = 0
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i]
    const [x1, y1] = curve[i + 1]
    const length = Math.hypot(x1 - x0, y1 - y0)
    while (carry <= length) {
      const t = carry / length
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      solid.cylinder(x, y - 0.03, z, 0.02, 0.02, 0.04, 5, wire)
      addBulb(builders, x, y - 0.075, z + 0.01, bulbs[lamp++ % bulbs.length], 0.058, 0.5)
      carry += BULB_SPACING
    }
    carry -= length
  }

  return { solid: solid.batch.build('lit'), glow: glow.batch.build('glow'), halo: halo.batch.build('glow') }
}
