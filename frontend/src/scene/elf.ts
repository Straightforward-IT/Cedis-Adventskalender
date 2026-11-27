import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'

export function addElfHat(
  b: Builder, x: number, y: number, z: number, felt: THREE.Color, shadow: THREE.Color, tilt = -0.45,
): void {
  b.cylinder(x, y + 0.2, z, 0.32, 0.32, 0.1, 14, col('#fff8ee'))
  b.within(new THREE.Matrix4().makeRotationZ(tilt).setPosition(x, y + 0.22, z), () => {
    b.cylinder(0, 0.32, 0, 0.29, 0.02, 0.64, 12, [shadow, felt])
    b.sphere(0, 0.68, 0, 0.08, 0.08, 0.08, col('#e8b04a'))
  })
}

/**
 * Easter Egg: der Wichtel aus Haus 9, der hinter der Hausecke hervorlugt.
 * Ursprung (0, 0, 0) liegt 0,4 m hinter der hinteren rechten Hausecke am Boden; der Kopf ragt nach rechts (+x)
 * um die Ecke und schaut zur Straße (+z). Was links von x = 0 liegt, verdeckt das Haus.
 */
export function buildPeekingElf(): THREE.BufferGeometry {
  const b = new Builder()
  const skin = col('#f6c9a3')
  const ear = col('#efb88f')
  const hat = col('#3f8a4f')
  const hatDark = col('#2f6d3d')
  const white = col('#fff8ee')
  const dark = col('#3a2418')

  const hx = 0.06
  const hy = 1.0

  // Kopf, Wange, Nase
  b.sphere(hx, hy, 0, 0.3, 0.29, 0.28, skin)
  b.sphere(hx + 0.17, hy - 0.08, 0.2, 0.06, 0.05, 0.03, col('#ec8f80'))
  b.sphere(hx + 0.06, hy - 0.03, 0.28, 0.055, 0.05, 0.05, col('#e88f73'))

  // Spitzes Ohr, schräg nach oben hinten
  b.cylinder(hx + 0.32, hy + 0.08, -0.04, 0.07, 0, 0.26, 8, ear, { z: -0.85, x: -0.25 })

  // Große, neugierige Augen
  for (const [x, z] of [[hx + 0.14, 0.22], [hx - 0.06, 0.25]] as const) {
    b.sphere(x, hy + 0.06, z, 0.075, 0.09, 0.05, white)
    b.sphere(x + 0.015, hy + 0.05, z + 0.04, 0.04, 0.05, 0.02, dark)
  }

  // Mütze mit Krempe und goldenem Bommel, leicht zur Seite gekippt
  addElfHat(b, hx, hy, 0, hat, hatDark)

  // Körper im grünen Kittel – steht hinter dem Haus, nur die Schulter schaut hervor
  b.cylinder(-0.08, 0.36, 0, 0.26, 0.18, 0.72, 12, [hatDark, hat])
  b.cylinder(-0.08, 0.74, 0, 0.2, 0.2, 0.08, 12, white)

  // Finger, die sich an der hinteren Hauskante festhalten
  for (const y of [0.62, 0.7, 0.78]) b.sphere(0.03, y, 0.36, 0.045, 0.035, 0.05, skin)

  return b.batch.build('lit')
}

/** Kittel- und Mützenfarben der Wichtel, die am Glühweinstand anstehen. */
const ELF_OUTFITS = [
  ['#3f8a4f', '#2f6d3d'],
  ['#c4463c', '#95302a'],
  ['#3a6ea5', '#2a5282'],
  ['#d9a441', '#ad7f2c'],
] as const

/**
 * Ein ganzer Wichtel, der aufrecht steht – z. B. als Kundschaft am Glühweinstand.
 * Ursprung am Boden zwischen den Füßen, er schaut nach +z. Etwa 1,7 m bis zum Mützenbommel.
 * `look` wählt Kittel- und Mützenfarbe.
 */
export function buildStandingElf(look = 0): THREE.BufferGeometry {
  const b = new Builder()
  const [felt, feltDark] = ELF_OUTFITS[((look % ELF_OUTFITS.length) + ELF_OUTFITS.length) % ELF_OUTFITS.length].map(col)
  const skin = col('#f6c9a3')
  const ear = col('#efb88f')
  const white = col('#fff8ee')
  const dark = col('#3a2418')
  const boot = col('#5a3524')
  const legs = col('#e9e2d0')

  // Stiefel mit Spitze, gestreifte Beine
  for (const side of [-1, 1]) {
    b.sphere(side * 0.11, 0.06, 0.05, 0.09, 0.07, 0.15, boot)
    b.cone(side * 0.11, 0.05, 0.2, 0.04, 0.12, 6, boot)
    b.cylinder(side * 0.1, 0.24, 0, 0.065, 0.07, 0.3, 8, legs)
    b.cylinder(side * 0.1, 0.2, 0, 0.068, 0.068, 0.05, 8, felt)
  }

  // Kittel mit Gürtel und Kragen
  b.cylinder(0, 0.6, 0, 0.3, 0.19, 0.5, 14, [feltDark, felt])
  b.cylinder(0, 0.53, 0, 0.255, 0.25, 0.07, 14, dark)
  b.box(0, 0.53, 0.25, 0.09, 0.07, 0.03, col('#f2c14e'))
  b.cylinder(0, 0.86, 0, 0.21, 0.21, 0.07, 14, white)

  // Arme, Hände vor dem Bauch
  for (const side of [-1, 1]) {
    b.cylinder(side * 0.23, 0.68, 0.04, 0.06, 0.07, 0.34, 8, felt, { z: side * 0.35, x: -0.35 })
    b.sphere(side * 0.27, 0.53, 0.13, 0.06, 0.055, 0.06, skin)
  }

  // Kopf mit Ohren, Augen, Nase und roten Bäckchen
  const hy = 1.1
  b.sphere(0, hy, 0, 0.27, 0.26, 0.25, skin)
  for (const side of [-1, 1]) {
    b.cylinder(side * 0.3, hy + 0.06, -0.02, 0.06, 0, 0.24, 8, ear, { z: -side * 1.05 })
    b.sphere(side * 0.09, hy + 0.04, 0.21, 0.065, 0.08, 0.04, white)
    b.sphere(side * 0.09, hy + 0.03, 0.245, 0.035, 0.045, 0.02, dark)
    b.sphere(side * 0.15, hy - 0.09, 0.18, 0.055, 0.04, 0.03, col('#ec8f80'))
  }
  b.sphere(0, hy - 0.04, 0.26, 0.05, 0.045, 0.045, col('#e88f73'))
  b.box(0, hy - 0.14, 0.235, 0.09, 0.018, 0.02, dark)

  addElfHat(b, 0, hy, 0, felt, feltDark, look % 2 === 0 ? -0.45 : 0.45)

  return b.batch.build('lit')
}
