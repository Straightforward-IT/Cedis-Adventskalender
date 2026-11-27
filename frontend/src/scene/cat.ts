import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'

/**
 * Easter Egg aus Haus 12 („Durch den Schornstein“): die orange getigerte Katze aus dem
 * Wohnzimmer, jetzt draußen auf dem Balkon. Ursprung am Boden unter ihr, sie schaut
 * zur Straße (+z). Der Schwanz ist ein eigenes Teil, damit er hin und her wedeln kann –
 * sein Ursprung liegt am Ansatz.
 */
export function buildBalconyCat(): { body: THREE.BufferGeometry; tail: THREE.BufferGeometry; tailBase: THREE.Vector3 } {
  const b = new Builder()
  const fur = col('#e0883a')
  const stripe = col('#b9612a')
  const white = col('#fff4e6')
  const green = col('#3f8a4f')
  const dark = col('#1d1410')
  const pink = col('#e26b6b')

  // Sitzender Körper mit Hinterbeinen, weißer Brust und Pfoten
  b.sphere(0, 0.16, -0.02, 0.13, 0.17, 0.14, fur)
  for (const side of [-1, 1]) b.sphere(side * 0.085, 0.08, -0.04, 0.07, 0.08, 0.1, fur)
  b.sphere(0, 0.19, 0.08, 0.075, 0.11, 0.06, white)
  for (const side of [-1, 1]) {
    b.cylinder(side * 0.045, 0.07, 0.09, 0.026, 0.024, 0.13, 8, fur)
    b.sphere(side * 0.045, 0.015, 0.105, 0.032, 0.02, 0.04, white)
  }
  for (const y of [0.12, 0.19, 0.25]) b.box(0, y, -0.15, 0.12, 0.018, 0.02, stripe)

  // Kopf mit Ohren, Schnauze, grünen Augen
  b.sphere(0, 0.38, 0.03, 0.1, 0.09, 0.09, fur)
  for (const side of [-1, 1]) {
    b.cone(side * 0.058, 0.43, 0.02, 0.034, 0.075, 6, fur)
    b.cone(side * 0.058, 0.435, 0.032, 0.02, 0.05, 6, col('#f2a6a0'))
    b.sphere(side * 0.038, 0.395, 0.105, 0.019, 0.023, 0.012, green)
    b.sphere(side * 0.038, 0.395, 0.114, 0.007, 0.018, 0.006, dark)
  }
  b.sphere(0, 0.35, 0.1, 0.048, 0.036, 0.03, white)
  b.sphere(0, 0.365, 0.128, 0.011, 0.008, 0.006, pink)
  for (const x of [-0.03, 0, 0.03]) b.box(x, 0.455, 0.06, 0.012, 0.035, 0.01, stripe)

  // Schwanz: vom Ansatz hinten nach außen und wieder nach oben geschwungen
  const t = new Builder()
  const points = [
    [0, 0, 0],
    [0.08, 0.0, -0.04],
    [0.16, 0.03, -0.02],
    [0.2, 0.1, 0.02],
    [0.2, 0.18, 0.05],
  ] as const
  for (let i = 1; i < points.length; i++) {
    const [x0, y0, z0] = points[i - 1]
    const [x1, y1, z1] = points[i]
    const from = new THREE.Vector3(x0, y0, z0)
    const to = new THREE.Vector3(x1, y1, z1)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const dir = to.clone().sub(from)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    t.within(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), () => {
      t.cylinder(0, 0, 0, 0.028, 0.025, dir.length() + 0.02, 8, i === points.length - 1 ? stripe : fur)
    })
    t.sphere(x1, y1, z1, 0.026, 0.026, 0.026, i === points.length - 1 ? stripe : fur)
  }

  return { body: b.batch.build('lit'), tail: t.batch.build('lit'), tailBase: new THREE.Vector3(0.06, 0.05, -0.12) }
}
