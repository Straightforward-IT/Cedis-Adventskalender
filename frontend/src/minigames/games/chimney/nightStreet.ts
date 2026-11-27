import * as THREE from 'three'
import type { HouseAnchors } from '../../../scene/houseBuilder.ts'
import type { TimeUniform } from '../../../scene/materials.ts'
import { buildStreetBackdropWithHome } from '../../../scene/streetBackdrop.ts'
import { createMoonTexture } from '../../../scene/textures.ts'

function starField(count: number, radius: number): THREE.Points {
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const y = 0.15 + Math.random() * 0.85
    const a = Math.random() * Math.PI * 2
    const ring = Math.sqrt(1 - y * y)
    positions.push(Math.cos(a) * ring * radius, y * radius, Math.sin(a) * ring * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff8e6', size: 1.5, sizeAttenuation: false, fog: false }))
}

/** Die nächtliche Straße für Vor- und Abspann: Himmel, Mond, Sterne – und Haus `day` im Ursprung. */
export function createNightStreet(day: number, time: TimeUniform): { scene: THREE.Scene; home: HouseAnchors } {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#2a2e62')
  scene.fog = new THREE.Fog('#2a2e62', 30, 150)
  scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.2))
  const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.4)
  moonlight.position.set(-0.4, 0.8, 0.9)
  scene.add(moonlight)
  scene.add(starField(420, 160))
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
  moon.position.set(30, 45, -80)
  moon.scale.setScalar(22)
  scene.add(moon)
  const { group, home } = buildStreetBackdropWithHome(day, time)
  scene.add(group)
  return { scene, home }
}

/** Gibt alle Geometrien, Materialien und Texturen der Szene frei. */
export function disposeScene(scene: THREE.Scene): void {
  const seen = new Set<unknown>()
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry)
      mesh.geometry.dispose()
    }
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
    for (const material of materials) {
      if (seen.has(material)) continue
      seen.add(material)
      ;(material as THREE.MeshBasicMaterial).map?.dispose()
      material.dispose()
    }
  })
}
