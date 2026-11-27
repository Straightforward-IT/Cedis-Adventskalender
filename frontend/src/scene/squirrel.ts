import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'

/**
 * Ein Eichhörnchen mit Wuschelschwanz und Eichel, gebaut aus einfachen Formen.
 * Ursprung am Boden unter dem Körper, es schaut nach +z. Etwa 1,3 m hoch –
 * im Spiel so groß, dass man es gut trifft; auf der Straße wird es verkleinert.
 */
export function buildSquirrel(): THREE.BufferGeometry {
  const b = new Builder()
  const fur = col('#c8743a')
  const furDark = col('#a95a28')
  const cream = col('#f3dcb8')
  const dark = col('#2b1a12')
  const white = col('#ffffff')

  // Schwanz: dicke, nach oben eingerollte Kette hinter dem Körper
  for (const [y, z, r] of [[0.32, -0.32, 0.2], [0.58, -0.44, 0.24], [0.88, -0.46, 0.25], [1.12, -0.36, 0.21], [1.26, -0.18, 0.15]] as const) {
    b.sphere(0, y, z, r, r * 1.05, r, furDark)
  }
  b.sphere(0, 1.3, -0.08, 0.09, 0.08, 0.09, cream)

  // Körper und Bauch
  b.sphere(0, 0.42, 0, 0.28, 0.36, 0.25, fur)
  b.sphere(0, 0.4, 0.12, 0.17, 0.26, 0.13, cream)
  // Füße
  for (const side of [-1, 1]) b.sphere(side * 0.14, 0.06, 0.12, 0.1, 0.06, 0.14, furDark)

  // Kopf mit Schnauze und Pausbacken
  b.sphere(0, 0.88, 0.02, 0.23, 0.21, 0.21, fur)
  b.sphere(0, 0.82, 0.17, 0.12, 0.09, 0.09, cream)
  b.sphere(0, 0.86, 0.26, 0.04, 0.033, 0.03, dark)
  for (const side of [-1, 1]) {
    // Ohren mit Pinselspitzen
    b.cone(side * 0.13, 1.02, -0.01, 0.065, 0.16, 8, fur)
    b.cone(side * 0.13, 1.15, -0.01, 0.03, 0.08, 6, furDark)
    // Große Augen mit Glanzpunkt
    b.sphere(side * 0.085, 0.93, 0.16, 0.058, 0.066, 0.04, white)
    b.sphere(side * 0.09, 0.925, 0.195, 0.034, 0.042, 0.02, dark)
    b.sphere(side * 0.1, 0.94, 0.212, 0.011, 0.011, 0.006, white)
    // Pfötchen, die die Eichel halten
    b.sphere(side * 0.09, 0.6, 0.22, 0.055, 0.05, 0.05, furDark)
  }
  // Eichel
  b.sphere(0, 0.6, 0.27, 0.07, 0.085, 0.07, col('#b8863b'))
  b.sphere(0, 0.67, 0.27, 0.075, 0.035, 0.075, col('#6b4129'))

  return b.batch.build('lit')
}
