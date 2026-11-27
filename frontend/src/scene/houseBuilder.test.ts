import type { BufferGeometry } from 'three'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildHouse, extendEaves, samplePolyline } from './houseBuilder.ts'
import { DOOR_HEIGHT, DOOR_WIDTH, bodyHeight, generateStreet } from './houseSpec.ts'

function hasOnlyFiniteNumbers(geometry: BufferGeometry): boolean {
  return Object.values(geometry.attributes).every((attribute) =>
    Array.from(attribute.array as ArrayLike<number>).every(Number.isFinite),
  )
}

describe('buildHouse', () => {
  const houses = generateStreet().map((spec) => ({ spec, built: buildHouse(spec) }))

  it('baut alle 23 Häuser zu gültiger Geometrie zusammen', () => {
    for (const { spec, built } of houses) {
      for (const geometry of [built.solid, built.glow, built.halo, built.door]) {
        expect(geometry.getAttribute('position').count, `Haus ${spec.day}`).toBeGreaterThan(0)
        expect(hasOnlyFiniteNumbers(geometry), `Haus ${spec.day}`).toBe(true)
      }
    }
  })

  it('bleibt mit jedem Haus in seinem Grundstück', () => {
    for (const { spec, built } of houses) {
      built.solid.computeBoundingBox()
      const box = built.solid.boundingBox!
      // Dachüberstand und Deko dürfen etwas über die Hauswand hinausragen.
      expect(box.min.x, `Haus ${spec.day}`).toBeGreaterThan(-spec.width / 2 - 0.7)
      expect(box.max.x, `Haus ${spec.day}`).toBeLessThan(spec.width / 2 + 0.7)
      expect(box.min.y).toBeGreaterThan(-0.5)
      expect(box.max.y).toBeLessThanOrEqual(built.anchors.height + 0.01)
    }
  })

  it('hängt das Hausnummernschild gut sichtbar über die Tür', () => {
    for (const { spec, built } of houses) {
      const { plaque, doorX } = built.anchors
      expect(plaque.x).toBe(doorX)
      expect(plaque.y - plaque.radius, `Haus ${spec.day}`).toBeGreaterThan(DOOR_HEIGHT)
      expect(plaque.y + plaque.radius, `Haus ${spec.day}`).toBeLessThan(3.2)
      expect(Math.abs(doorX) + 0.5).toBeLessThan(spec.width / 2)
    }
  })

  it('hält die offene Tür bei allen Fassaden frei von Leisten, Balken und Sockeln', () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0, 0.2)
    try {
      for (const { spec, built } of houses) {
        const facade = new Mesh(built.solid, material)
        for (const dx of [-0.4, -0.2, 0, 0.2, 0.4]) {
          for (const y of [0.2, 0.42, 1.1, DOOR_HEIGHT - 0.1]) {
            ray.ray.origin.set(built.anchors.doorX + dx * DOOR_WIDTH, y, 0.1)
            expect(
              ray.intersectObject(facade),
              `Haus ${spec.day} (${spec.wall.style}), Türposition ${dx}/${y}`,
            ).toHaveLength(0)
          }
        }
      }
    } finally {
      material.dispose()
    }
  })

  it('platziert das Selfie oberhalb des Erdgeschosses und unterhalb des Firsts', () => {
    for (const { spec, built } of houses) {
      const { photo, height } = built.anchors
      expect(photo.y, `Haus ${spec.day}`).toBeGreaterThan(bodyHeight(spec) - 2)
      expect(photo.y + 0.6, `Haus ${spec.day}`).toBeLessThan(height)
    }
  })
})

describe('samplePolyline', () => {
  it('verteilt Punkte gleichmäßig über Ecken hinweg', () => {
    const points = samplePolyline(
      [
        [0, 0],
        [2, 0],
        [2, 2],
      ],
      1,
    )
    expect(points).toEqual([
      [0.5, 0],
      [1.5, 0],
      [2, 0.5],
      [2, 1.5],
    ])
  })
})

describe('extendEaves', () => {
  it('verlängert das Dach entlang seiner Neigung um den Überstand', () => {
    const [left, apex, right] = extendEaves(
      [
        [-2, 0],
        [0, 2],
        [2, 0],
      ],
      0.5,
    )
    expect(left).toEqual([-2.5, -0.5])
    expect(apex).toEqual([0, 2])
    expect(right).toEqual([2.5, -0.5])
  })
})
