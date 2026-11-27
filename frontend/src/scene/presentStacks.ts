import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import type { Random } from '../lib/rng.ts'
import { KINDS } from '../minigames/games/tetris/model.ts'
import { Builder } from './batch.ts'
import { DOOR_WIDTH } from './houseSpec.ts'
import { col, SNOW } from './palette.ts'

/**
 * Nach Geschenke-Tetris (Haus 23) stapeln sich vor jeder Haustür Geschenke – links und
 * rechts neben den Stufen, in den Papierfarben aus dem Spiel. Koordinaten wie im Haus:
 * Fassade bei z = 0, die Straße liegt bei +z.
 */

/** Ein Stapel aus 2–4 Paketen, nach oben kleiner, jedes etwas verdreht. */
function stack(b: Builder, rnd: Random, x: number, z: number, count: number): void {
  let y = 0
  let width = rnd.range(0.36, 0.46)
  let turn = rnd.range(-0.4, 0.4)
  for (let i = 0; i < count; i++) {
    const { paper, ribbon } = KINDS[rnd.int(1, 7)]
    const height = rnd.range(0.17, 0.3)
    const depth = width * rnd.range(0.8, 1)
    const px = x + rnd.range(-0.03, 0.03)
    const pz = z + rnd.range(-0.03, 0.03)
    const cy = y + height / 2
    const rotation = { y: turn }
    b.box(px, cy, pz, width, height, depth, col(paper), rotation)
    b.box(px, cy, pz, width * 0.16, height + 0.008, depth + 0.008, col(ribbon), rotation)
    b.box(px, cy, pz, width + 0.008, height + 0.008, depth * 0.16, col(ribbon), rotation)
    y += height
    if (i === count - 1) {
      // Schleife obenauf – zwei Schlaufen und ein Knoten.
      const along = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn)).multiplyScalar(0.06)
      b.sphere(px - along.x, y + 0.035, pz - along.z, 0.065, 0.045, 0.045, col(ribbon))
      b.sphere(px + along.x, y + 0.035, pz + along.z, 0.065, 0.045, 0.045, col(ribbon))
      b.sphere(px, y + 0.02, pz, 0.035, 0.035, 0.035, col(ribbon))
    } else if (rnd.chance(0.5)) {
      // Etwas Schnee auf der Kante des Pakets darunter.
      b.sphere(px, y, pz, width * 0.5, 0.02, depth * 0.5, col(SNOW))
    }
    width *= rnd.range(0.7, 0.85)
    turn += rnd.range(-0.5, 0.5)
  }
}

/** Die Geschenkestapel auf einer Seite (−1 links, 1 rechts) der Tür eines Hauses. */
export function buildEntrancePresents(day: number, doorX: number, side: -1 | 1): THREE.BufferGeometry {
  const b = new Builder()
  const rnd = createRandom(hashSeed('present-stacks', day, side))
  // Ein hoher Stapel direkt neben den Stufen, davor oder daneben ein kleiner.
  const near = doorX + side * (DOOR_WIDTH / 2 + rnd.range(0.48, 0.62))
  stack(b, rnd, near, rnd.range(0.95, 1.1), rnd.int(3, 4))
  stack(b, rnd, near + side * rnd.range(0.42, 0.55), rnd.range(1.15, 1.35), rnd.int(1, 2))
  if (rnd.chance(0.5)) stack(b, rnd, near - side * 0.05, rnd.range(1.5, 1.6), 1)
  return b.batch.build('lit')
}
