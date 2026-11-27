import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'
import { haloOf } from './props.ts'

/**
 * Easter Egg aus Haus 2 („Spuren im Schnee“): der Rentierkopf aus dem Punktebild,
 * jetzt im Giebel. Ursprung ist die Kopfmitte; er schaut nach vorn (+z).
 */
export function buildGableReindeer(): { solid: THREE.BufferGeometry; halo: THREE.BufferGeometry } {
  const solid = new Builder()
  const halo = new Builder()
  const fur = col('#9a6a44')
  const furDark = col('#7d5233')
  const muzzle = col('#e3c39c')
  const antler = col('#6b4129')
  const white = col('#ffffff')
  const dark = col('#3a2418')
  const nose = col('#d33b33')

  for (const side of [-1, 1]) {
    // Geweih: ein geschwungener Hauptast mit drei Enden. Jedes Stück läuft von Punkt zu Punkt,
    // an den Gelenken sitzt eine Kugel – so bleibt alles verbunden.
    const branch = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number) => {
      const dx = (x1 - x0) * side
      const dy = y1 - y0
      solid.cylinder(side * (x0 + x1) / 2, (y0 + y1) / 2, 0, r0, r1, Math.hypot(dx, dy), 8, antler, { z: Math.atan2(-dx, dy) })
      solid.sphere(side * x1, y1, 0, r1, r1, r1, antler)
    }
    solid.sphere(side * 0.11, 0.2, 0, 0.04, 0.04, 0.04, antler)
    branch(0.11, 0.2, 0.19, 0.42, 0.04, 0.034)
    branch(0.19, 0.42, 0.29, 0.6, 0.034, 0.028)
    branch(0.29, 0.6, 0.33, 0.78, 0.028, 0.016)
    branch(0.19, 0.42, 0.35, 0.5, 0.026, 0.014)
    branch(0.29, 0.6, 0.2, 0.75, 0.024, 0.013)
    branch(0.29, 0.6, 0.45, 0.68, 0.024, 0.012)
    // Ohren seitlich
    solid.cylinder(side * 0.3, 0.1, 0, 0.065, 0.01, 0.22, 8, furDark, { z: side * (Math.PI / 2 + 0.35) })
    // Augen
    solid.sphere(side * 0.1, 0.06, 0.16, 0.06, 0.07, 0.04, white)
    solid.sphere(side * 0.1, 0.055, 0.195, 0.034, 0.042, 0.02, dark)
    solid.sphere(side * 0.112, 0.07, 0.212, 0.01, 0.01, 0.006, white)
  }

  solid.sphere(0, 0, 0.02, 0.25, 0.29, 0.19, fur)
  solid.sphere(0, -0.15, 0.1, 0.17, 0.13, 0.13, muzzle)
  solid.sphere(0, -0.09, 0.22, 0.075, 0.06, 0.06, nose)
  solid.sphere(-0.02, -0.07, 0.275, 0.022, 0.015, 0.01, col('#ff9d8c'))

  // Die rote Nase leuchtet sanft in die Nacht.
  halo.billboard(0, -0.09, 0.3, 0.7, 0.7, haloOf(col('#ff5a4a'), 0.55), { phase: 0, twinkle: 0.35, interior: 0 })

  return { solid: solid.batch.build('lit'), halo: halo.batch.build('glow') }
}
