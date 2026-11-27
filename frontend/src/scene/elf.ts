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
 * Easter Egg: der Wichtel aus Haus 3, der hinter der Hausecke hervorlugt.
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
