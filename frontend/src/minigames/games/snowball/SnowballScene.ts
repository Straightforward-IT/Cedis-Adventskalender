import * as THREE from 'three'
import { createEnvironment } from '../../../scene/environment.ts'
import { buildHouse } from '../../../scene/houseBuilder.ts'
import { createStreetLayout, STREET_SEED } from '../../../scene/houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from '../../../scene/materials.ts'
import { buildSquirrel } from '../../../scene/squirrel.ts'
import { createMoonTexture } from '../../../scene/textures.ts'
import { MOUNDS } from './model.ts'

export type Stage = 'intro' | 'play' | 'done'

export interface SnowballCallbacks {
  onStage(stage: Stage): void
  /** Ein Eichhörnchen wurde getroffen. */
  onHit(): void
  /** Ein Wurf ging daneben. */
  onMiss(): void
}

const HOUSE_DAY = 6
/**
 * Hier steht man beim Werfen: gegenüber, gleich hinter dem Zaun (z = 12,5) im Feld, mit dem
 * Rücken zu den Häusern. Vor einem liegen die Schneehügel, dahinter der Wald (ab z ≈ 31).
 */
const STAND = new THREE.Vector3(0, 1.4, 13.4)
/** Zu Beginn: Blick von der Straße auf Haus 6 – so, wie man es aus der Straßenansicht kennt. */
const START = new THREE.Vector3(0, 5.2, 19)
/** Im Spiel etwas größer als auf der Straße – man soll sie gut treffen können. */
const SQUIRREL_SCALE = 1.35
const MOUND_HEIGHT = 0.75
const MAX_UP = 3

type SquirrelState = 'hidden' | 'rising' | 'up' | 'ducking' | 'hit'

interface Squirrel {
  mesh: THREE.Mesh
  mound: { x: number; z: number; r: number }
  state: SquirrelState
  t: number
  /** Wie lange es diesmal oben bleibt. */
  stay: number
  /** Erst danach darf es wieder auftauchen. */
  rest: number
  hiddenY: number
  upY: number
}

interface Flight {
  ball: THREE.Mesh
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
  duration: number
  arc: number
  target: Squirrel | null
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function starField(count: number, radius: number): THREE.Points {
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const y = 0.12 + Math.random() * 0.88
    const a = Math.random() * Math.PI * 2
    const ring = Math.sqrt(1 - y * y)
    positions.push(Math.cos(a) * ring * radius, y * radius, Math.sin(a) * ring * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff8e6', size: 1.5, sizeAttenuation: false, fog: false }))
}

/**
 * Die Schneeballschlacht als 3D-Szene: Es beginnt auf der echten Straße mit Blick auf
 * Haus 6, dann dreht man sich um zum Feld auf der anderen Straßenseite. Dort lugen
 * Eichhörnchen hinter Schneehügeln hervor.
 */
export class SnowballScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400)
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: SnowballCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly raycaster = new THREE.Raycaster()
  private readonly squirrels: Squirrel[] = []
  private readonly mounds: THREE.Mesh[] = []
  private readonly flights: Flight[] = []
  private readonly puffs: { mesh: THREE.Mesh; dir: THREE.Vector3; t: number; origin: THREE.Vector3 }[] = []
  private readonly ballGeometry = new THREE.SphereGeometry(0.13, 14, 10)
  private readonly ballMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a4060' })
  private readonly puffGeometry = new THREE.SphereGeometry(0.09, 8, 6)
  private stage: Stage = 'intro'
  private introTime = 0
  /** Blickrichtung um die Hochachse: π = zu den Häusern, 0 = zum Feld. */
  private yaw = Math.PI
  private spawnIn = 0.6
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, callbacks: SnowballCallbacks, skipIntro: boolean) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    this.build()
    if (skipIntro) this.startPlay()
    else this.camera.position.copy(START)
    this.applyYaw()

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __snowball: this })
    queueMicrotask(() => {
      if (!this.disposed) this.callbacks.onStage(this.stage)
    })
  }

  // --------------------------------------------------------------- Steuerung

  skipIntro(): void {
    if (this.stage === 'intro') this.startPlay()
  }

  /** Wirft einen Schneeball dorthin, wo getippt wurde. */
  throwAt(clientX: number, clientY: number): void {
    if (this.stage !== 'play') return
    const rect = this.canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    const ray = this.raycaster.ray

    // Was liegt zuerst im Weg: ein Hügel oder ein Eichhörnchen?
    const moundHit = this.raycaster.intersectObjects(this.mounds, false)[0]
    let target: Squirrel | null = null
    let distance = moundHit?.distance ?? Infinity
    const point = new THREE.Vector3()
    for (const squirrel of this.squirrels) {
      if (squirrel.state === 'hidden' || squirrel.state === 'hit') continue
      const p = squirrel.mesh.position
      for (const [y, r] of [[0.45, 0.36], [0.9, 0.28], [0.85, 0.32]] as const) {
        const center = new THREE.Vector3(p.x, p.y + y * SQUIRREL_SCALE, p.z)
        const hit = ray.intersectSphere(new THREE.Sphere(center, r * SQUIRREL_SCALE), point)
        if (hit && hit.distanceTo(ray.origin) < distance) {
          distance = hit.distanceTo(ray.origin)
          target = squirrel
        }
      }
    }
    let to: THREE.Vector3
    if (Number.isFinite(distance)) to = ray.at(distance, new THREE.Vector3())
    else {
      // Ins Leere: dort landen, wo der Strahl den Boden trifft – oder weit hinten.
      const ground = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())
      to = ground && ground.distanceTo(ray.origin) < 45 ? ground : ray.at(45, new THREE.Vector3())
    }

    const from = this.camera.localToWorld(new THREE.Vector3(0.35, -0.45, -0.6))
    const ball = new THREE.Mesh(this.ballGeometry, this.ballMaterial)
    ball.position.copy(from)
    this.scene.add(ball)
    const length = from.distanceTo(to)
    this.flights.push({ ball, from, to, t: 0, duration: THREE.MathUtils.clamp(length / 24, 0.22, 0.8), arc: length * 0.05, target })
  }

  /** Geschafft – alle verschwinden, es fliegen nur noch ein paar Flocken. */
  finish(): void {
    if (this.stage === 'done') return
    this.stage = 'done'
    for (const squirrel of this.squirrels) {
      if (squirrel.state === 'rising' || squirrel.state === 'up') {
        squirrel.state = 'ducking'
        squirrel.t = 0
      }
    }
    this.callbacks.onStage('done')
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
    this.ballGeometry.dispose()
    this.puffGeometry.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------------ Aufbau

  private build(): void {
    const scene = this.scene
    scene.background = new THREE.Color('#2a2e62')
    scene.fog = new THREE.Fog('#2a2e62', 25, 90)
    scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.2))
    const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.5)
    moonlight.position.set(-0.6, 0.9, -0.5)
    scene.add(moonlight)
    scene.add(starField(420, 150))
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
    moon.position.set(18, 42, 90)
    moon.scale.setScalar(30)
    scene.add(moon)

    // Die ganze Straße – verschoben, sodass Haus 6 im Ursprung steht (wie beim Mondstaub-Mann).
    const layout = createStreetLayout(STREET_SEED)
    const home = layout.plots.find((p) => p.spec.day === HOUSE_DAY)!
    const street = new THREE.Group()
    street.position.x = -home.x
    scene.add(street)
    const solid = createSolidMaterial()
    const glow = createGlowMaterial(this.time)
    glow.side = THREE.DoubleSide
    const halo = createGlowMaterial(this.time, { halo: true })
    for (const plot of layout.plots) {
      const house = buildHouse(plot.spec)
      const group = new THREE.Group()
      group.position.x = plot.x
      const door = new THREE.Mesh(house.door, solid)
      door.position.copy(house.anchors.hinge)
      group.add(new THREE.Mesh(house.solid, solid), new THREE.Mesh(house.glow, glow), new THREE.Mesh(house.halo, halo), door)
      street.add(group)
    }
    street.add(createEnvironment(layout, solid, this.time, STREET_SEED).group)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: '#e4ebf8' }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    scene.add(ground)

    const snow = new THREE.MeshLambertMaterial({ color: '#f4f7ff' })
    const moundGeometry = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
    const squirrelGeometry = buildSquirrel()
    for (const mound of MOUNDS) {
      const mesh = new THREE.Mesh(moundGeometry, snow)
      mesh.position.set(mound.x, 0, STAND.z + mound.z)
      mesh.scale.set(mound.r, mound.r * MOUND_HEIGHT, mound.r * 0.8)
      scene.add(mesh)
      this.mounds.push(mesh)

      const squirrel = new THREE.Mesh(squirrelGeometry, solid)
      // Mit dem Gesicht zu uns (−z), knapp hinter dem Hügel
      squirrel.rotation.y = Math.PI
      squirrel.scale.setScalar(SQUIRREL_SCALE)
      const upY = mound.r * MOUND_HEIGHT - 0.6 * SQUIRREL_SCALE
      squirrel.position.set(mound.x, upY - 1.6 * SQUIRREL_SCALE, STAND.z + mound.z + mound.r * 0.25)
      squirrel.visible = false
      scene.add(squirrel)
      this.squirrels.push({ mesh: squirrel, mound: { ...mound, z: STAND.z + mound.z }, state: 'hidden', t: 0, stay: 0, rest: 0, hiddenY: upY - 1.6 * SQUIRREL_SCALE, upY })
    }
  }

  private startPlay(): void {
    this.stage = 'play'
    this.yaw = 0
    this.camera.position.copy(STAND)
    this.applyYaw()
    this.callbacks.onStage('play')
  }

  private applyYaw(): void {
    // Zu den Häusern leicht nach unten aufs Haus, zum Feld knapp unter den Horizont.
    const turned = this.yaw / Math.PI
    const look = new THREE.Vector3(Math.sin(this.yaw), THREE.MathUtils.lerp(-0.04, -0.07, turned), Math.cos(this.yaw))
    this.camera.lookAt(this.camera.position.clone().add(look))
  }

  // ------------------------------------------------------------ Bild für Bild

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.time.value += dt

    if (this.stage === 'intro') this.updateIntro(dt)
    else if (this.stage === 'play') this.spawn(dt)
    this.updateSquirrels(dt)
    this.updateFlights(dt)
    this.updatePuffs(dt)

    this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  private updateIntro(dt: number): void {
    this.introTime += dt
    // Kurz aufs Haus schauen, dann über die Straße gehen und sich zum Feld umdrehen.
    const k = THREE.MathUtils.clamp((this.introTime - 1.4) / 2.6, 0, 1)
    const t = easeInOut(k)
    this.yaw = Math.PI * (1 - t)
    this.camera.position.lerpVectors(START, STAND, t)
    this.applyYaw()
    if (k >= 1) this.startPlay()
  }

  private spawn(dt: number): void {
    this.spawnIn -= dt
    if (this.spawnIn > 0) return
    this.spawnIn = 0.55 + Math.random() * 0.9
    const active = this.squirrels.filter((s) => s.state === 'rising' || s.state === 'up').length
    if (active >= MAX_UP) return
    const free = this.squirrels.filter((s) => s.state === 'hidden' && s.rest <= 0)
    if (free.length === 0) return
    const squirrel = free[Math.floor(Math.random() * free.length)]
    squirrel.state = 'rising'
    squirrel.t = 0
    squirrel.stay = 1.3 + Math.random() * 1.2
    squirrel.mesh.visible = true
    squirrel.mesh.rotation.set(0, Math.PI, (Math.random() - 0.5) * 0.3)
    squirrel.mesh.position.x = squirrel.mound.x + (Math.random() - 0.5) * squirrel.mound.r * 0.7
  }

  private updateSquirrels(dt: number): void {
    for (const s of this.squirrels) {
      s.t += dt
      const p = s.mesh.position
      switch (s.state) {
        case 'hidden':
          s.rest -= dt
          break
        case 'rising': {
          const k = Math.min(1, s.t / 0.22)
          p.y = s.hiddenY + (s.upY - s.hiddenY) * easeInOut(k)
          if (k >= 1) { s.state = 'up'; s.t = 0 }
          break
        }
        case 'up':
          // Neugierig hin und her wackeln
          s.mesh.rotation.z = Math.sin(this.time.value * 4 + p.x) * 0.08
          p.y = s.upY + Math.abs(Math.sin(this.time.value * 5 + p.z)) * 0.05
          if (s.t >= s.stay) { s.state = 'ducking'; s.t = 0 }
          break
        case 'ducking': {
          const k = Math.min(1, s.t / 0.18)
          p.y = s.upY + (s.hiddenY - s.upY) * k
          if (k >= 1) this.hide(s, 0.5)
          break
        }
        case 'hit': {
          // Rückwärts umkippen und hinter dem Hügel versinken
          const k = Math.min(1, s.t / 0.7)
          s.mesh.rotation.x = -k * 1.6
          s.mesh.rotation.z += dt * 6
          p.y = s.upY + Math.sin(k * Math.PI) * 0.5 - k * k * 2.2
          if (k >= 1) this.hide(s, 1.2)
          break
        }
      }
    }
  }

  private hide(s: Squirrel, rest: number): void {
    s.state = 'hidden'
    s.t = 0
    s.rest = rest
    s.mesh.visible = false
    s.mesh.rotation.set(0, Math.PI, 0)
    s.mesh.position.y = s.hiddenY
  }

  private updateFlights(dt: number): void {
    for (const flight of [...this.flights]) {
      flight.t += dt / flight.duration
      const t = Math.min(1, flight.t)
      flight.ball.position.lerpVectors(flight.from, flight.to, t)
      flight.ball.position.y += flight.arc * 4 * t * (1 - t)
      if (t < 1) continue
      this.flights.splice(this.flights.indexOf(flight), 1)
      this.scene.remove(flight.ball)
      this.splash(flight.to)
      const target = flight.target
      if (target && target.state !== 'hidden' && target.state !== 'hit' && this.stage !== 'intro') {
        target.state = 'hit'
        target.t = 0
        this.callbacks.onHit()
      } else {
        this.callbacks.onMiss()
      }
    }
  }

  /** Schneegestöber, wo der Ball aufschlägt. */
  private splash(at: THREE.Vector3): void {
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(this.puffGeometry, material)
      mesh.position.copy(at)
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize()
      this.scene.add(mesh)
      this.puffs.push({ mesh, dir, t: 0, origin: at.clone() })
    }
  }

  private updatePuffs(dt: number): void {
    for (const puff of [...this.puffs]) {
      puff.t += dt / 0.55
      const t = Math.min(1, puff.t)
      puff.mesh.position.copy(puff.origin).addScaledVector(puff.dir, t * 0.9)
      puff.mesh.position.y -= t * t * 0.4
      puff.mesh.scale.setScalar(1 + t * 1.5)
      ;(puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t)
      if (t >= 1) {
        this.scene.remove(puff.mesh)
        this.puffs.splice(this.puffs.indexOf(puff), 1)
        if (!this.puffs.some((p) => p.mesh.material === puff.mesh.material)) (puff.mesh.material as THREE.Material).dispose()
      }
    }
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
