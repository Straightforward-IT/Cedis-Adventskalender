import * as THREE from 'three'
import { createEnvironment } from './environment.ts'
import { buildHouse } from './houseBuilder.ts'
import type { HouseAnchors } from './houseBuilder.ts'
import { createStreetLayout, STREET_SEED } from './houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from './materials.ts'
import type { TimeUniform } from './materials.ts'

/**
 * Die ganze Weihnachtsstraße als Kulisse für ein Minispiel – verschoben, sodass Haus
 * `day` im Ursprung steht. Häuser schauen nach +z, die Straße liegt bei z ≈ 5,5.
 */
export function buildStreetBackdrop(day: number, time: TimeUniform): THREE.Group {
  return buildStreetBackdropWithHome(day, time).group
}

/** Wie `buildStreetBackdrop`, liefert zusätzlich die Ankerpunkte von Haus `day` (Schornstein, Balkon …). */
export function buildStreetBackdropWithHome(day: number, time: TimeUniform): { group: THREE.Group; home: HouseAnchors } {
  const layout = createStreetLayout(STREET_SEED)
  const home = layout.plots.find((p) => p.spec.day === day)!
  const street = new THREE.Group()
  street.position.x = -home.x
  const solid = createSolidMaterial()
  const glow = createGlowMaterial(time)
  glow.side = THREE.DoubleSide
  const halo = createGlowMaterial(time, { halo: true })
  let anchors: HouseAnchors | null = null
  for (const plot of layout.plots) {
    const house = buildHouse(plot.spec)
    if (plot === home) anchors = house.anchors
    const group = new THREE.Group()
    group.position.x = plot.x
    const door = new THREE.Mesh(house.door, solid)
    door.position.copy(house.anchors.hinge)
    group.add(new THREE.Mesh(house.solid, solid), new THREE.Mesh(house.glow, glow), new THREE.Mesh(house.halo, halo), door)
    street.add(group)
  }
  street.add(createEnvironment(layout, solid, time, STREET_SEED).group)
  return { group: street, home: anchors! }
}
