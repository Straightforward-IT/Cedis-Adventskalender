import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'

/** Wo der Weihnachtsmann im Schlitten sitzt (relativ zum Schlitten). */
export const SANTA_SEAT = new THREE.Vector3(-0.15, 1.05, 0)

/** Schlitten mit Sack und zwei Rentieren; fährt in +x-Richtung, Ursprung unter der Sitzbank. */
export function buildSleigh(): THREE.BufferGeometry {
  const b = new Builder()
  const red = col('#c8312b')
  const redDark = col('#9c2420')
  const gold = col('#e8b04a')
  const fur = col('#9a6a44')
  const furDark = col('#7d5233')
  const antler = col('#6b4129')
  const leather = col('#3a2418')

  // Kufen mit vorn eingerollter Spitze
  for (const z of [-0.42, 0.42]) {
    b.box(0, 0.06, z, 2.1, 0.07, 0.07, gold)
    b.cylinder(1.08, 0.24, z, 0.05, 0.05, 0.36, 8, gold, { z: 0.5 })
    b.sphere(1.2, 0.42, z, 0.08, 0.08, 0.08, gold)
    for (const x of [-0.6, 0.5]) b.box(x, 0.2, z, 0.06, 0.28, 0.06, gold)
  }
  // Wanne, hohe Rückenlehne, geschwungene Front
  b.box(0, 0.55, 0, 1.7, 0.5, 0.95, [redDark, red])
  b.box(-0.78, 0.95, 0, 0.18, 0.8, 0.95, [redDark, red])
  b.sphere(0.85, 0.6, 0, 0.18, 0.32, 0.47, red)
  b.box(0, 0.82, 0.48, 1.7, 0.06, 0.03, gold)
  b.box(0, 0.82, -0.48, 1.7, 0.06, 0.03, gold)
  // Geschenkesack hinten
  b.sphere(-0.48, 1.12, 0, 0.36, 0.42, 0.36, col('#8a5a2e'))
  b.box(-0.36, 1.3, 0.2, 0.22, 0.2, 0.2, col('#3f8a4f'))
  b.box(-0.6, 1.36, -0.12, 0.2, 0.18, 0.2, col('#3f6fb5'))

  // Zwei Rentiere im Galopp
  for (const [x, nose] of [[2.3, col('#5b3a26')], [3.6, col('#ff3b2f')]] as const) {
    b.sphere(x, 0.9, 0, 0.5, 0.26, 0.22, fur)
    b.cylinder(x + 0.42, 1.18, 0, 0.1, 0.08, 0.42, 8, fur, { z: -0.7 })
    b.sphere(x + 0.62, 1.38, 0, 0.17, 0.14, 0.13, fur)
    b.sphere(x + 0.78, 1.33, 0, 0.06, 0.06, 0.06, nose)
    for (const z of [-0.08, 0.08]) {
      b.cylinder(x + 0.58, 1.6, z, 0.025, 0.02, 0.36, 6, antler, { x: z * 3 })
      b.cylinder(x + 0.68, 1.68, z * 1.8, 0.02, 0.015, 0.2, 6, antler, { z: -0.8 })
    }
    // Beine weit gestreckt – vorn nach vorn, hinten nach hinten
    for (const z of [-0.12, 0.12]) {
      b.cylinder(x + 0.42, 0.62, z, 0.05, 0.04, 0.5, 6, furDark, { z: 0.7 })
      b.cylinder(x - 0.42, 0.62, z, 0.05, 0.04, 0.5, 6, furDark, { z: -0.7 })
    }
    b.sphere(x - 0.5, 0.98, 0, 0.07, 0.07, 0.07, col('#f3ead9'))
  }
  // Zügel
  b.box(1.85, 0.95, 0, 1.6, 0.03, 0.03, leather)
  b.box(2.95, 0.98, 0, 1.0, 0.03, 0.03, leather)
  return b.batch.build('lit')
}

/** Der Weihnachtsmann allein – Ursprung in der Körpermitte, damit er sich beim Fallen um sich selbst dreht. */
export function buildSanta(): THREE.BufferGeometry {
  const b = new Builder()
  const red = col('#d33b33')
  const redDark = col('#a62a24')
  const white = col('#fff8ee')
  const skin = col('#f6c9a3')
  const black = col('#2b211d')
  b.sphere(0, 0, 0, 0.42, 0.46, 0.38, [redDark, red])
  b.cylinder(0, -0.04, 0, 0.43, 0.43, 0.1, 16, black)
  b.box(0, -0.04, 0.42, 0.14, 0.12, 0.03, col('#e8b04a'))
  b.cylinder(0, 0.08, 0.36, 0.05, 0.05, 0.5, 8, white, { x: 0.3 })
  // Kopf mit Bart, Nase und Augen
  b.sphere(0, 0.62, 0.02, 0.22, 0.22, 0.2, skin)
  b.sphere(0, 0.5, 0.14, 0.22, 0.2, 0.14, white)
  b.sphere(0, 0.62, 0.2, 0.05, 0.045, 0.04, col('#e88f73'))
  for (const x of [-0.08, 0.08]) b.sphere(x, 0.7, 0.18, 0.025, 0.03, 0.02, black)
  // Mütze
  b.cylinder(0, 0.8, 0, 0.23, 0.23, 0.08, 14, white)
  b.cylinder(0.04, 1.0, 0, 0.2, 0.03, 0.4, 12, red, { z: -0.35 })
  b.sphere(0.16, 1.17, 0, 0.07, 0.07, 0.07, white)
  // Arme und Beine, alle von sich gestreckt – er purzelt
  for (const side of [-1, 1]) {
    b.cylinder(side * 0.5, 0.18, 0, 0.1, 0.09, 0.42, 8, red, { z: side * 1.0 })
    b.sphere(side * 0.7, 0.32, 0, 0.1, 0.1, 0.1, white)
    b.cylinder(side * 0.18, -0.5, 0, 0.11, 0.1, 0.4, 8, red, { z: side * 0.25 })
    b.sphere(side * 0.24, -0.74, 0.06, 0.12, 0.1, 0.16, black)
  }
  return b.batch.build('lit')
}

/** Schlitten samt Weihnachtsmann auf der Bank – fliegt in +x-Richtung. */
export function buildSleighWithSanta(material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  const santa = new THREE.Mesh(buildSanta(), material)
  santa.position.copy(SANTA_SEAT)
  santa.rotation.y = Math.PI / 2
  group.add(new THREE.Mesh(buildSleigh(), material), santa)
  return group
}
