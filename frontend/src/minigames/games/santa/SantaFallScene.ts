import * as THREE from 'three'
import { createSolidMaterial } from '../../../scene/materials.ts'
import { buildSanta, buildSleigh, SANTA_SEAT } from '../../../scene/sleigh.ts'
import { buildStreetBackdrop } from '../../../scene/streetBackdrop.ts'
import { createMoonTexture } from '../../../scene/textures.ts'

export type FallCue = 'bump' | 'land' | 'done'

const HOUSE_DAY = 11
/** Der Schlitten zieht weit hinter den Häusern vorbei – klein vor dem Nachthimmel. */
const FLY_Y = 17
const FLY_Z = -16
const FLY_FROM = -42
const FLY_TO = 46
const FLY_SPEED = 13
/** Ab hier zählt die Zeit (Sekunden). */
const FLY_START = 0.8
/** An dieser Stelle holpert der Schlitten – und der Weihnachtsmann fliegt raus. */
const BUMP_X = -5
const BUMP_T = FLY_START + (BUMP_X - FLY_FROM) / FLY_SPEED
const FALL_DURATION = 2.1
const LAND_T = BUMP_T + FALL_DURATION
const DONE_T = LAND_T + 1.6
/** Wo er im Schnee landet: auf dem Gehweg vor Haus 11. */
const LANDING = new THREE.Vector3(2.4, 0.42, 8.6)

const CAMERA_START = new THREE.Vector3(0, 3.4, 23)
const LOOK_START = new THREE.Vector3(0, 9.5, -4)
/** Am Ende ganz nah dran – vor dem Zaun (z = 12,5), damit er nicht im Bild steht. */
const CAMERA_END = new THREE.Vector3(1.6, 3.4, 12.2)

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

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

export interface SantaFallCallbacks {
  onCue(cue: FallCue): void
}

/**
 * Der Vorspann von Santa Bibber: Auf der echten Straße zieht der Schlitten weit hinten
 * über die Dächer, holpert – und der Weihnachtsmann purzelt heraus, über die Häuser
 * hinweg bis vor Haus 11 in den Schnee.
 */
export class SantaFallScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500)
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: SantaFallCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly sleigh: THREE.Mesh
  private readonly santa: THREE.Mesh
  private readonly puffs: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = []
  private readonly fallFrom = new THREE.Vector3()
  private readonly fallVia = new THREE.Vector3()
  private readonly look = new THREE.Vector3().copy(LOOK_START)
  private clock = 0
  private cues = new Set<FallCue>()
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, callbacks: SantaFallCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))

    const scene = this.scene
    scene.background = new THREE.Color('#2a2e62')
    scene.fog = new THREE.Fog('#2a2e62', 35, 170)
    scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.2))
    const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.4)
    moonlight.position.set(-0.4, 0.8, 0.9)
    scene.add(moonlight)
    scene.add(starField(420, 160))
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
    moon.position.set(-26, 40, -90)
    moon.scale.setScalar(22)
    scene.add(moon)
    scene.add(buildStreetBackdrop(HOUSE_DAY, this.time))

    const solid = createSolidMaterial()
    this.sleigh = new THREE.Mesh(buildSleigh(), solid)
    this.santa = new THREE.Mesh(buildSanta(), solid)
    this.sleigh.position.set(FLY_FROM, FLY_Y, FLY_Z)
    scene.add(this.sleigh, this.santa)

    const snow = new THREE.MeshLambertMaterial({ color: '#f4f7ff', transparent: true })
    const puffGeometry = new THREE.SphereGeometry(0.16, 8, 6)
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(puffGeometry, snow)
      mesh.visible = false
      const a = (i / 26) * Math.PI * 2
      this.puffs.push({ mesh, dir: new THREE.Vector3(Math.cos(a), 0.8 + (i % 3) * 0.5, Math.sin(a) * 0.6) })
      scene.add(mesh)
    }

    this.camera.position.copy(CAMERA_START)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.update(0)
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __santaFall: this })
  }

  /** Springt ans Ende des Vorspanns. */
  skip(): void {
    this.clock = DONE_T
    this.update(0)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    const seen = new Set<unknown>()
    this.scene.traverse((object) => {
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
    this.renderer.dispose()
  }

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    if (this.clock < DONE_T + 0.5) this.frame = requestAnimationFrame(this.tick)
  }

  private cue(cue: FallCue): void {
    if (this.cues.has(cue)) return
    this.cues.add(cue)
    this.callbacks.onCue(cue)
  }

  private update(dt: number): void {
    this.clock += dt
    this.time.value += dt
    const t = this.clock

    // Der Schlitten zieht gleichmäßig vorbei, mit leichtem Auf und Ab – und einem Holperer.
    const x = FLY_FROM + Math.max(0, t - FLY_START) * FLY_SPEED
    const jolt = Math.exp(-Math.max(0, t - BUMP_T) * 4) * (t > BUMP_T ? 1 : 0)
    this.sleigh.position.set(Math.min(x, FLY_TO), FLY_Y + Math.sin(t * 2.4) * 0.25 + jolt * 0.5, FLY_Z)
    this.sleigh.rotation.z = Math.sin(t * 2.4 + 1) * 0.05 + jolt * Math.sin(t * 30) * 0.25
    this.sleigh.visible = x < FLY_TO

    const santa = this.santa
    if (t < BUMP_T) {
      // Sitzt noch im Schlitten.
      santa.position.copy(this.sleigh.position).add(SANTA_SEAT)
      santa.rotation.set(0, Math.PI / 2, this.sleigh.rotation.z)
      this.fallFrom.copy(santa.position)
      this.fallVia.set(this.fallFrom.x + 6, FLY_Y + 6, -4)
    } else if (t < LAND_T) {
      this.cue('bump')
      // Erst hoch aus dem Schlitten, dann im Bogen über die Dächer bis vor das Haus.
      const u = Math.pow(clamp01((t - BUMP_T) / FALL_DURATION), 1.25)
      const a = this.fallFrom.clone().lerp(this.fallVia, u)
      const b = this.fallVia.clone().lerp(LANDING, u)
      santa.position.copy(a.lerp(b, u))
      santa.rotation.set(u * 9, Math.PI / 2 + u * 2, u * 13)
    } else {
      this.cue('land')
      // Plumps – auf dem Rücken im Schnee, Kopf zur Seite, Gesicht nach oben; ein kleiner Hopser.
      const since = t - LAND_T
      santa.position.copy(LANDING)
      santa.position.y += Math.abs(Math.sin(since * 7)) * Math.exp(-since * 4) * 0.4
      santa.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.25)
      this.puffs.forEach(({ mesh, dir }) => {
        mesh.visible = since < 1.2
        mesh.position.copy(LANDING).addScaledVector(dir, Math.min(since, 1.2) * 1.4)
        mesh.position.y = Math.max(0.1, LANDING.y + dir.y * since * 1.6 - since * since * 2.2)
        mesh.scale.setScalar(1 + since * 1.5)
        ;(mesh.material as THREE.MeshLambertMaterial).opacity = clamp01(1 - since / 1.2)
      })
      if (t >= DONE_T) this.cue('done')
    }

    // Kamera: erst die Straße mit den Dächern, dann dem Purzelnden folgen und heranfahren.
    const follow = easeInOut(clamp01((t - BUMP_T) / 1.2))
    const close = easeInOut(clamp01((t - LAND_T + 0.6) / 1.6))
    this.camera.position.lerpVectors(CAMERA_START, CAMERA_END, close)
    const target = new THREE.Vector3().copy(LOOK_START).lerp(santa.position, follow)
    // Weich nachführen, damit das Purzeln nicht ruckelt.
    this.look.lerp(target, dt > 0 ? 1 - Math.exp(-dt * 8) : 1)
    this.camera.fov = 46 - close * 4
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.look)
  }

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}
