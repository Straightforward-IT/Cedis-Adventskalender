import * as THREE from 'three'
import { Builder } from './batch.ts'
import { createGlowMaterial } from './materials.ts'
import type { TimeUniform } from './materials.ts'
import { col } from './palette.ts'
import { haloOf } from './props.ts'

/**
 * Easter Egg aus Haus 16 („Rentiere gesucht!“): Rudolph und die fünf Rentiere aus dem
 * Wimmelbild streifen über die Wiese gegenüber den Häusern – rechts, wenn man zum Baum schaut.
 * Sie laufen zu einem Ziel, grasen ein Weilchen, schauen sich um und ziehen weiter.
 */

const FUR = '#9a6a44'
const FUR_DARK = '#7d5233'
const FUR_LIGHT = '#e3c39c'
const ANTLER = '#6b4129'
const HOOF = '#3a2418'

/** Hüften relativ zum Körper (x nach vorn, z zur Seite). */
const HIPS: readonly [number, number][] = [
  [0.36, 0.13],
  [0.36, -0.13],
  [-0.36, 0.13],
  [-0.36, -0.13],
]
const HIP_Y = 0.82
const NECK = new THREE.Vector3(0.42, 1.02, 0)
const WALK_SPEED = 0.75
/** Kopf runter zum Grasen (Drehung um z – das Rentier schaut nach +x). */
const GRAZE_PITCH = -1.35

const up = new THREE.Vector3(0, 1, 0)
const direction = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const euler = new THREE.Euler()

/** Ein Stab von a nach b – Builder-Zylinder stehen sonst senkrecht. */
function rod(b: Builder, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1: number, color: THREE.Color): void {
  direction.set(bx - ax, by - ay, bz - az)
  const length = direction.length()
  quaternion.setFromUnitVectors(up, direction.normalize())
  euler.setFromQuaternion(quaternion)
  b.cylinder((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, r0, r1, length, 7, color, { x: euler.x, y: euler.y, z: euler.z })
  b.sphere(bx, by, bz, r1, r1, r1, color)
}

function buildBody(): THREE.BufferGeometry {
  const b = new Builder()
  b.sphere(0, 0.98, 0, 0.56, 0.3, 0.28, col(FUR))
  b.sphere(0.02, 0.86, 0, 0.4, 0.17, 0.22, col(FUR_LIGHT))
  // Helle Halskrause vorn an der Brust
  b.sphere(0.42, 1.04, 0, 0.2, 0.22, 0.2, col(FUR_LIGHT))
  b.sphere(-0.55, 1.08, 0, 0.08, 0.1, 0.08, col('#ffffff'))
  return b.batch.build('lit')
}

/** Hals und Kopf, Ursprung am Halsansatz – so kann er zum Grasen nicken. */
function buildHead(rudolph: boolean): { solid: THREE.BufferGeometry; halo: THREE.BufferGeometry | null } {
  const b = new Builder()
  const fur = col(FUR)
  const antler = col(ANTLER)
  rod(b, 0, 0, 0, 0.2, 0.42, 0, 0.15, 0.11, fur)
  b.sphere(0.3, 0.5, 0, 0.21, 0.14, 0.14, fur)
  b.sphere(0.47, 0.46, 0, 0.12, 0.09, 0.1, col(FUR_LIGHT))
  b.sphere(0.58, 0.47, 0, rudolph ? 0.065 : 0.045, rudolph ? 0.065 : 0.04, rudolph ? 0.065 : 0.045, col(rudolph ? '#d33b33' : '#2b1a12'))
  // Rotes Halsband mit Glöckchen – Santas Rentiere erkennt man daran.
  rod(b, 0.02, 0.08, 0, 0.1, 0.06, 0, 0.17, 0.17, col('#c2483c'))
  b.sphere(0.2, 0.0, 0, 0.045, 0.045, 0.045, col('#e8b04a'))
  for (const side of [-1, 1]) {
    b.sphere(0.36, 0.55, side * 0.11, 0.035, 0.04, 0.025, col('#ffffff'))
    b.sphere(0.375, 0.55, side * 0.125, 0.02, 0.025, 0.012, col('#2b1a12'))
    rod(b, 0.22, 0.58, side * 0.1, 0.12, 0.62, side * 0.25, 0.05, 0.015, col(FUR_DARK))
    // Geweih: Hauptstange nach hinten-oben mit drei Enden
    const s = side
    rod(b, 0.25, 0.6, s * 0.07, 0.2, 0.82, s * 0.16, 0.03, 0.025, antler)
    rod(b, 0.2, 0.82, s * 0.16, 0.08, 1.02, s * 0.22, 0.025, 0.018, antler)
    rod(b, 0.08, 1.02, s * 0.22, 0.02, 1.16, s * 0.2, 0.018, 0.01, antler)
    rod(b, 0.2, 0.82, s * 0.16, 0.33, 0.9, s * 0.2, 0.018, 0.01, antler)
    rod(b, 0.08, 1.02, s * 0.22, 0.2, 1.12, s * 0.3, 0.016, 0.008, antler)
    rod(b, 0.14, 0.93, s * 0.19, 0.0, 0.98, s * 0.32, 0.015, 0.008, antler)
  }
  let halo: THREE.BufferGeometry | null = null
  if (rudolph) {
    const glow = new Builder()
    glow.billboard(0.62, 0.47, 0, 0.6, 0.6, haloOf(col('#ff5a4a'), 0.6), { phase: 0, twinkle: 0.35, interior: 0 })
    halo = glow.batch.build('glow')
  }
  return { solid: b.batch.build('lit'), halo }
}

function buildLeg(): THREE.BufferGeometry {
  const b = new Builder()
  b.cylinder(0, -0.38, 0, 0.065, 0.045, 0.76, 7, col(FUR_DARK))
  b.cylinder(0, -0.79, 0, 0.055, 0.06, 0.08, 7, col(HOOF))
  return b.batch.build('lit')
}

type Mood = 'walk' | 'graze' | 'look'

interface Deer {
  root: THREE.Group
  head: THREE.Group
  legs: THREE.Mesh[]
  target: THREE.Vector2
  mood: Mood
  /** Restzeit im aktuellen Zustand (grasen, umschauen). */
  left: number
  heading: number
  stride: number
  pitch: number
  speed: number
}

export interface MeadowArea {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface MeadowHerd {
  group: THREE.Group
  /** Die einzelnen Rentiere – das erste ist Rudolph. */
  deer: THREE.Group[]
  /** Dieses Rentier bleibt stehen und schaut zur Straße, solange man es betrachtet (null: alle frei). */
  hold(index: number | null): void
  update(dt: number): void
  dispose(): void
}

export function createMeadowHerd(solidMaterial: THREE.Material, time: TimeUniform, area: MeadowArea, count = 6): MeadowHerd {
  const group = new THREE.Group()
  const body = buildBody()
  const leg = buildLeg()
  const plainHead = buildHead(false)
  const rudolphHead = buildHead(true)
  const haloMaterial = createGlowMaterial(time, { halo: true })
  // Unsichtbare, etwas größere Trefferfläche: Aus der Ferne sind die Rentiere nur ein paar Pixel groß.
  const hitGeometry = new THREE.BoxGeometry(1.9, 2.3, 1.1)
  hitGeometry.translate(0.15, 1.1, 0)
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false })
  const randomSpot = (out: THREE.Vector2) =>
    out.set(THREE.MathUtils.lerp(area.minX, area.maxX, Math.random()), THREE.MathUtils.lerp(area.minZ, area.maxZ, Math.random()))

  const herd: Deer[] = Array.from({ length: count }, (_, i) => {
    const root = new THREE.Group()
    root.add(new THREE.Mesh(body, solidMaterial))
    const legs = HIPS.map(([x, z]) => {
      const mesh = new THREE.Mesh(leg, solidMaterial)
      mesh.position.set(x, HIP_Y, z)
      root.add(mesh)
      return mesh
    })
    const head = new THREE.Group()
    head.position.copy(NECK)
    const geometry = i === 0 ? rudolphHead : plainHead
    head.add(new THREE.Mesh(geometry.solid, solidMaterial))
    if (geometry.halo) head.add(new THREE.Mesh(geometry.halo, haloMaterial))
    root.add(head)
    root.add(new THREE.Mesh(hitGeometry, hitMaterial))
    // Rudolph ist ein bisschen kleiner als die anderen.
    root.scale.setScalar(i === 0 ? 0.92 : 1 + Math.random() * 0.1)
    const start = randomSpot(new THREE.Vector2())
    root.position.set(start.x, 0, start.y)
    const heading = Math.random() * Math.PI * 2
    root.rotation.y = heading
    group.add(root)
    return {
      root,
      head,
      legs,
      target: randomSpot(new THREE.Vector2()),
      mood: (i % 2 ? 'graze' : 'walk') as Mood,
      left: 1 + Math.random() * 4,
      heading,
      stride: Math.random() * 10,
      pitch: 0,
      speed: WALK_SPEED * (0.85 + Math.random() * 0.3),
    }
  })

  const toTarget = new THREE.Vector2()
  let held: number | null = null
  /** Schräg zur Straße (−z) – so sieht man Gesicht und Geweih. */
  const POSE_HEADING = Math.PI / 2 - 0.65

  function update(dt: number): void {
    herd.forEach((deer, index) => {
      let pitchGoal = 0
      if (index === held) {
        deer.mood = 'look'
        deer.left = 2
        let turn = POSE_HEADING - deer.heading
        turn = Math.atan2(Math.sin(turn), Math.cos(turn))
        deer.heading += THREE.MathUtils.clamp(turn, -2.5 * dt, 2.5 * dt)
        deer.stride += Math.abs(turn) > 0.05 ? dt * 3 : 0
      } else if (deer.mood === 'walk') {
        toTarget.set(deer.target.x - deer.root.position.x, deer.target.y - deer.root.position.z)
        const distance = toTarget.length()
        if (distance < 0.15) {
          deer.mood = Math.random() < 0.65 ? 'graze' : 'look'
          deer.left = deer.mood === 'graze' ? 4 + Math.random() * 6 : 1.5 + Math.random() * 2.5
        } else {
          // Ein Rentier aus dem Builder schaut nach +x; rotation.y = 0 heißt also Blick nach +x.
          const goal = Math.atan2(-toTarget.y, toTarget.x)
          let turn = goal - deer.heading
          turn = Math.atan2(Math.sin(turn), Math.cos(turn))
          deer.heading += THREE.MathUtils.clamp(turn, -2.2 * dt, 2.2 * dt)
          // Erst einigermaßen in Richtung drehen, dann loslaufen.
          const pace = deer.speed * Math.max(0, Math.cos(turn)) * deer.root.scale.x
          deer.root.position.x += Math.cos(deer.heading) * pace * dt
          deer.root.position.z -= Math.sin(deer.heading) * pace * dt
          deer.stride += pace * dt * 7
        }
      } else {
        deer.left -= dt
        if (deer.mood === 'graze') pitchGoal = GRAZE_PITCH
        else pitchGoal = 0.15 * Math.sin(time.value * 1.3 + deer.stride)
        if (deer.left <= 0) {
          deer.mood = 'walk'
          randomSpot(deer.target)
        }
      }
      deer.root.rotation.y = deer.heading
      deer.pitch += (pitchGoal - deer.pitch) * Math.min(1, dt * 3)
      deer.head.rotation.z = deer.pitch
      // Beim Grasen ein wenig kauen.
      if (deer.mood === 'graze') deer.head.rotation.z += Math.sin(time.value * 6 + deer.stride) * 0.04
      // Diagonale Beinpaare schwingen gegengleich.
      const walking = deer.mood === 'walk'
      deer.legs.forEach((mesh, i) => {
        const swing = walking ? Math.sin(deer.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : 0
        mesh.rotation.z += (swing - mesh.rotation.z) * Math.min(1, dt * 12)
      })
      deer.root.position.y = walking ? Math.abs(Math.sin(deer.stride)) * 0.03 : 0
    })
  }

  return {
    group,
    deer: herd.map((deer) => deer.root),
    hold(index) {
      held = index
    },
    update,
    dispose() {
      for (const geometry of [body, leg, plainHead.solid, rudolphHead.solid, rudolphHead.halo, hitGeometry]) geometry?.dispose()
      haloMaterial.dispose()
      hitMaterial.dispose()
    },
  }
}
