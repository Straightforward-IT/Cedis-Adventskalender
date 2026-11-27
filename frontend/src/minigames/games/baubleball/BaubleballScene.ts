import * as THREE from 'three'
import { createEnvironment } from '../../../scene/environment.ts'
import { BOARD, buildHoop, HOOP, HOOP_MOUNT } from '../../../scene/garage.ts'
import { buildHouse } from '../../../scene/houseBuilder.ts'
import { createStreetLayout, STREET_SEED } from '../../../scene/houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from '../../../scene/materials.ts'
import { createMoonTexture, createSparkleTexture } from '../../../scene/textures.ts'
import { BALL_RADIUS, EYE_HEIGHT, GRAVITY, releasePoint, SPOTS } from './model.ts'
import type { Flight, Vec } from './model.ts'

export type Stage = 'intro' | 'play' | 'done'

export interface BaubleballCallbacks {
  onStage(stage: Stage): void
  /** Die Kugel ist gerade durch den Ring gefallen. */
  onScore(): void
  /** Die Kugel ist zersprungen – der Wurf ist vorbei. */
  onLanded(flight: Flight): void
}

/** Farben der Christbaumkugeln – jede neue Kugel nimmt die nächste. */
const BAUBLE_COLORS = ['#d23a3a', '#e8b33a', '#2f7fd1', '#2f9a5c', '#c9ccd8', '#b54bb0']
/** Zu Beginn: nah vor der Garage, damit man den Hammer arbeiten sieht. */
const START = new THREE.Vector3(1.1, 2.55, 5.2)
const START_LOOK = new THREE.Vector3(0.15, 2.75, 0)
/** Ablauf des Anbringens (Sekunden): Korb wird von vorn angesetzt, vier Hammerschläge, Hammer verschwindet. */
const DROP = 0.7
const STRIKES = 4
const STRIKE_TIME = 0.55
const INSTALL = DROP + STRIKES * STRIKE_TIME + 0.4
/** So schief hängt der Korb, bevor der erste Schlag sitzt. */
const TILT = 0.32
/** Hier trifft der Hammer: vorn auf die rechte untere Ecke des Bretts. */
const HIT = new THREE.Vector3(0.46, BOARD.bottom + 0.12, BOARD.front + 0.05)
/** Ein Comic-Hammer, gut zu sehen; der Griff liegt rechts unterhalb des Trefferpunkts. */
const HAMMER_SCALE = 1.5
const GRIP = new THREE.Vector3(HIT.x + 0.7, HIT.y - 0.25, HIT.z)
/** Hierhin schaut man vom Wurfplatz aus: unter den Ring – so sind Korb oben und Kugel unten im Bild. */
const LOOK_AT = new THREE.Vector3(HOOP.x, HOOP.y - 0.85, HOOP.z)

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

interface Shard {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spin: THREE.Vector3
  t: number
  resting: boolean
}

interface Sparkle {
  sprite: THREE.Sprite
  velocity: THREE.Vector3
  t: number
  life: number
}

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

/** Eine Christbaumkugel mit goldener Kappe und Aufhänger. */
function makeBauble(material: THREE.Material, cap: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), material))
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), cap)
  top.position.y = BALL_RADIUS + 0.005
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), cap)
  loop.position.y = BALL_RADIUS + 0.03
  group.add(top, loop)
  return group
}

/**
 * Weihnachtskugelball in 3D: die echte Straße, verschoben so, dass die Garage zwischen
 * Haus 14 und 15 im Ursprung steht. Man steht auf der Straße vor der Einfahrt und wirft
 * Christbaumkugeln in den geschmückten Korb über dem Garagentor.
 */
export class BaubleballScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400)
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: BaubleballCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly solid = createSolidMaterial()
  private readonly disposers: (() => void)[] = []
  private readonly baubleMaterials = BAUBLE_COLORS.map(
    (color) => new THREE.MeshPhongMaterial({ color, shininess: 110, specular: '#ffffff', emissive: new THREE.Color(color).multiplyScalar(0.18) }),
  )
  private readonly capMaterial = new THREE.MeshPhongMaterial({ color: '#d9b45a', shininess: 80, specular: '#fff3c4' })
  private readonly shardGeometry = new THREE.TetrahedronGeometry(0.028)
  private readonly sparkleTexture = createSparkleTexture()
  private readonly shards: Shard[] = []
  private readonly sparkles: Sparkle[] = []
  private ball: THREE.Group | null = null
  private readonly hoopPivot = new THREE.Group()
  private readonly hammer = new THREE.Group()
  private lastStrike = -1
  private ballColor = 0
  private flight: { data: Flight; t: number; scored: boolean } | null = null
  private stage: Stage = 'intro'
  private stageTime = 0
  /** Kamerafahrt zum nächsten Wurfplatz. */
  private move: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null
  private spot = 0
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, callbacks: BaubleballCallbacks, startSpot: number, skipIntro: boolean) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.spot = Math.min(startSpot, SPOTS.length - 1)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    this.build()
    if (skipIntro) this.startPlay()
    else {
      this.place(START, START_LOOK)
      this.setInstall(0)
    }

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __baubleball: this })
    queueMicrotask(() => {
      if (!this.disposed) this.callbacks.onStage(this.stage)
    })
  }

  // --------------------------------------------------------------- Steuerung

  skipIntro(): void {
    if (this.stage === 'intro') this.startPlay()
  }

  /** Bereit für den nächsten Wurf? (Kugel in der Hand, keine Kamerafahrt) */
  get ready(): boolean {
    return this.stage === 'play' && !this.flight && !this.move && !!this.ball
  }

  /** Lässt die Kugel in der Hand etwas zittern, je stärker man Schwung holt. */
  windUp(power: number): void {
    if (!this.ball || this.flight) return
    const rest = this.restPosition()
    const back = this.towardsCamera().multiplyScalar(power * 0.12)
    this.ball.position.copy(rest).add(back)
    this.ball.position.y -= power * 0.06
  }

  throw(flight: Flight): void {
    if (!this.ready) return
    this.flight = { data: flight, t: 0, scored: false }
  }

  /** Nächster Wurfplatz – die Kamera geht dorthin. */
  goTo(spot: number): void {
    const target = Math.min(spot, SPOTS.length - 1)
    if (target === this.spot) return
    this.spot = target
    this.move = { from: this.camera.position.clone(), to: this.eye(target), t: 0 }
    this.removeBall()
  }

  /** Alle fünf drin: Zurücktreten und die Garage feiern lassen. */
  finish(): void {
    if (this.stage === 'done') return
    this.stage = 'done'
    this.stageTime = 0
    this.removeBall()
    this.burst(new THREE.Vector3(HOOP.x, HOOP.y + 0.2, HOOP.z), 60, 1.6)
    this.callbacks.onStage('done')
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    for (const dispose of this.disposers) dispose()
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
        material.dispose()
      }
    })
    for (const material of [...this.baubleMaterials, this.capMaterial]) material.dispose()
    this.shardGeometry.dispose()
    this.sparkleTexture.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------------ Aufbau

  private build(): void {
    const scene = this.scene
    scene.background = new THREE.Color('#2a2e62')
    scene.fog = new THREE.Fog('#2a2e62', 25, 90)
    scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.1))
    const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.4)
    moonlight.position.set(-0.4, 0.9, 0.7)
    scene.add(moonlight)
    // Warmes Licht der Garagenlampe auf Korb und Kugeln
    const lamp = new THREE.PointLight('#ffd08a', 7, 10, 1.6)
    lamp.position.set(0.4, 3.9, 1.8)
    scene.add(lamp)
    scene.add(starField(420, 150))
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
    moon.position.set(30, 44, -80)
    moon.scale.setScalar(26)
    scene.add(moon)

    // Die ganze Straße – verschoben, sodass die Garage im Ursprung steht.
    const layout = createStreetLayout(STREET_SEED)
    const street = new THREE.Group()
    street.position.x = -layout.garage.x
    scene.add(street)
    const glow = createGlowMaterial(this.time)
    glow.side = THREE.DoubleSide
    const halo = createGlowMaterial(this.time, { halo: true })
    for (const plot of layout.plots) {
      if (Math.abs(plot.x - layout.garage.x) > 45) continue
      const house = buildHouse(plot.spec)
      const group = new THREE.Group()
      group.position.x = plot.x
      const door = new THREE.Mesh(house.door, this.solid)
      door.position.copy(house.anchors.hinge)
      group.add(new THREE.Mesh(house.solid, this.solid), new THREE.Mesh(house.glow, glow), new THREE.Mesh(house.halo, halo), door)
      street.add(group)
    }
    const environment = createEnvironment(layout, this.solid, this.time, STREET_SEED)
    street.add(environment.group)
    this.disposers.push(() => environment.dispose())

    // Der Korb – im Intro wird er erst angeschlagen. Er kippt um die Halterung an der Wand.
    const hoop = buildHoop()
    const hoopGlow = createGlowMaterial(this.time)
    const hoopHalo = createGlowMaterial(this.time, { halo: true })
    const hoopMeshes = [new THREE.Mesh(hoop.solid, this.solid), new THREE.Mesh(hoop.glow, hoopGlow), new THREE.Mesh(hoop.halo, hoopHalo)]
    for (const mesh of hoopMeshes) mesh.position.copy(HOOP_MOUNT).negate()
    this.hoopPivot.position.copy(HOOP_MOUNT)
    this.hoopPivot.add(...hoopMeshes)
    scene.add(this.hoopPivot)

    // Der Hammer: Stiel aus Holz, eiserner Kopf. Gedreht wird um den Griff.
    const wood = new THREE.MeshLambertMaterial({ color: '#9a6a40' })
    const iron = new THREE.MeshPhongMaterial({ color: '#59607a', shininess: 70, specular: '#ccd3ea' })
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 10), wood)
    handle.position.y = 0.21
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.075, 0.075), iron)
    head.position.set(-0.04, 0.43, 0)
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), iron)
    claw.position.set(0.09, 0.45, 0)
    claw.rotation.z = -0.5
    this.hammer.add(handle, head, claw)
    // Der Griff liegt rechts neben der Halterung; der Kopf schlägt nach links auf den Trefferpunkt.
    this.hammer.position.copy(GRIP)
    this.hammer.scale.setScalar(HAMMER_SCALE)
    scene.add(this.hammer)

    // Kleine leuchtende Markierungen auf der Straße: die fünf Wurfplätze
    const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffd45e', transparent: true, opacity: 0.55, depthWrite: false })
    const markerGeometry = new THREE.RingGeometry(0.22, 0.3, 32)
    for (const spot of SPOTS) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial)
      marker.rotation.x = -Math.PI / 2
      marker.position.set(spot.x, 0.03, spot.z)
      scene.add(marker)
    }
  }

  private eye(spot: number): THREE.Vector3 {
    const s = SPOTS[spot]
    return new THREE.Vector3(s.x, EYE_HEIGHT, s.z)
  }

  /**
   * Stand des Anbringens zur Zeit `t` (Sekunden): Der Korb setzt schief an, jeder Hammerschlag
   * richtet ihn ein Stück gerade, dann verschwindet der Hammer. Ab `INSTALL` hängt er fest.
   */
  private setInstall(t: number): void {
    const pivot = this.hoopPivot
    const hammer = this.hammer
    if (t >= INSTALL) {
      pivot.position.copy(HOOP_MOUNT)
      pivot.rotation.set(0, 0, 0)
      hammer.visible = false
      return
    }
    // Ansetzen: von vorn an die Wand gedrückt, schief
    const drop = easeInOut(Math.min(1, t / DROP))
    pivot.position.copy(HOOP_MOUNT)
    pivot.position.z += (1 - drop) * 1.4
    const struck = t < DROP ? 0 : Math.min(STRIKES, Math.floor((t - DROP) / STRIKE_TIME + 0.3))
    pivot.rotation.set(0, 0, TILT * (1 - struck / STRIKES))

    // Hammer: ausholen, zuschlagen, kurz nachfedern
    hammer.visible = t > DROP * 0.5
    const local = t < DROP ? 0 : ((t - DROP) % STRIKE_TIME) / STRIKE_TIME
    // Winkel um den Griff: −0,3 = weit ausgeholt, 1,2 = Kopf auf der Halterung.
    const RAISED = -0.3
    const HIT_ANGLE = 1.2
    let swing: number
    if (t < DROP || t >= DROP + STRIKES * STRIKE_TIME) swing = RAISED
    else if (local < 0.6) swing = THREE.MathUtils.lerp(t - DROP < STRIKE_TIME ? RAISED : HIT_ANGLE, RAISED, easeInOut(local / 0.6))
    else if (local < 0.72) swing = THREE.MathUtils.lerp(RAISED, HIT_ANGLE, ((local - 0.6) / 0.12) ** 2)
    else swing = HIT_ANGLE - Math.sin(((local - 0.72) / 0.28) * Math.PI) * 0.12
    hammer.rotation.z = swing
    // Zum Schluss fliegt der Hammer davon.
    const away = Math.max(0, t - (DROP + STRIKES * STRIKE_TIME)) / 0.4
    hammer.position.set(GRIP.x + away * 0.8, GRIP.y + away * 1.2, GRIP.z)
    hammer.scale.setScalar(HAMMER_SCALE * Math.max(0.01, 1 - away))
    // Jeder Treffer: Funken und ein kleines Wackeln des Bretts
    if (t >= DROP && t < DROP + STRIKES * STRIKE_TIME) {
      const strike = Math.floor((t - DROP) / STRIKE_TIME)
      if (local >= 0.72 && this.lastStrike < strike) {
        this.lastStrike = strike
        this.burst(HIT.clone(), 10, 0.55)
      }
      const shake = local >= 0.72 ? Math.sin((local - 0.72) * 60) * (1 - local) * 0.06 : 0
      pivot.rotation.x = shake
    }
  }

  private startPlay(): void {
    this.setInstall(INSTALL)
    this.stage = 'play'
    this.stageTime = 0
    this.place(this.eye(this.spot), LOOK_AT)
    this.callbacks.onStage('play')
  }

  private place(position: THREE.Vector3, look: THREE.Vector3): void {
    this.camera.position.copy(position)
    this.camera.lookAt(look)
  }

  /** Ruheposition der Kugel in der Hand – genau dort startet auch der Wurf. */
  private restPosition(): THREE.Vector3 {
    const r = releasePoint(SPOTS[this.spot])
    return new THREE.Vector3(r.x, r.y, r.z)
  }

  private towardsCamera(): THREE.Vector3 {
    return this.camera.position.clone().sub(LOOK_AT).setY(0).normalize()
  }

  private spawnBall(): void {
    const material = this.baubleMaterials[this.ballColor++ % this.baubleMaterials.length]
    this.ball = makeBauble(material, this.capMaterial)
    this.ball.position.copy(this.restPosition())
    this.scene.add(this.ball)
  }

  private removeBall(): void {
    if (!this.ball) return
    this.scene.remove(this.ball)
    this.ball.traverse((child) => (child as THREE.Mesh).geometry?.dispose())
    this.ball = null
  }

  // ------------------------------------------------------------ Bild für Bild

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.time.value += dt
    this.stageTime += dt

    if (this.stage === 'intro') this.updateIntro()
    else if (this.stage === 'done') this.updateOutro()
    else {
      this.updateMove(dt)
      if (!this.ball && !this.flight && !this.move) this.spawnBall()
      if (this.ball && !this.flight) this.ball.rotation.y += dt * 0.8
    }
    this.updateFlight(dt)
    this.updateShards(dt)
    this.updateSparkles(dt)
    this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  private updateIntro(): void {
    // Erst schlägt der Hammer den Korb an, dann geht es auf den ersten Wurfplatz.
    this.setInstall(this.stageTime)
    const k = easeInOut(THREE.MathUtils.clamp((this.stageTime - INSTALL - 0.3) / 2.2, 0, 1))
    const position = new THREE.Vector3().lerpVectors(START, this.eye(this.spot), k)
    const look = new THREE.Vector3().lerpVectors(START_LOOK, LOOK_AT, k)
    this.place(position, look)
    if (k >= 1) this.startPlay()
  }

  private updateMove(dt: number): void {
    if (!this.move) return
    this.move.t = Math.min(1, this.move.t + dt / 1.4)
    const k = easeInOut(this.move.t)
    const position = new THREE.Vector3().lerpVectors(this.move.from, this.move.to, k)
    position.y += Math.sin(k * Math.PI) * 0.08
    this.place(position, LOOK_AT)
    if (this.move.t >= 1) this.move = null
  }

  private updateOutro(): void {
    const k = easeInOut(THREE.MathUtils.clamp(this.stageTime / 3, 0, 1))
    const from = this.eye(this.spot)
    const to = new THREE.Vector3(0, 2.6, 9.5)
    this.place(new THREE.Vector3().lerpVectors(from, to, k), new THREE.Vector3().lerpVectors(LOOK_AT, new THREE.Vector3(0, 2.2, -0.5), k))
  }

  private updateFlight(dt: number): void {
    const flight = this.flight
    if (!flight || !this.ball) return
    flight.t += dt
    const path = flight.data.path
    const index = Math.min(path.length - 1, Math.floor(flight.t / flight.data.step))
    const p = path[index]
    this.ball.position.set(p.x, p.y, p.z)
    this.ball.rotation.x -= dt * 7
    if (flight.data.scored && !flight.scored && index >= flight.data.scoreIndex) {
      flight.scored = true
      this.burst(new THREE.Vector3(HOOP.x, HOOP.y, HOOP.z), 26, 1)
      this.callbacks.onScore()
    }
    if (index < path.length - 1) return
    // Klirr! Die Kugel zerspringt an der letzten Stelle.
    const material = (this.ball.children[0] as THREE.Mesh).material as THREE.Material
    this.shatter(p, material, path[Math.max(0, index - 4)])
    this.removeBall()
    this.flight = null
    this.callbacks.onLanded(flight.data)
  }

  private shatter(at: Vec, material: THREE.Material, before: Vec): void {
    const incoming = new THREE.Vector3(at.x - before.x, at.y - before.y, at.z - before.z).normalize()
    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(this.shardGeometry, material)
      mesh.position.set(at.x, Math.max(0.03, at.y), at.z)
      mesh.scale.setScalar(0.6 + Math.random() * 0.9)
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(1.2 + Math.random() * 2.2)
        .addScaledVector(incoming, -0.8)
      this.scene.add(mesh)
      this.shards.push({ mesh, velocity, spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), t: 0, resting: false })
    }
    this.burst(new THREE.Vector3(at.x, Math.max(0.1, at.y), at.z), 14, 0.7)
  }

  /** Glitzer, der kurz aufleuchtet und davonstiebt. */
  private burst(at: THREE.Vector3, count: number, size: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.sparkleTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        color: new THREE.Color().setHSL(0.1 + Math.random() * 0.06, 0.9, 0.7),
      }))
      sprite.position.copy(at)
      sprite.scale.setScalar(0.12 * size)
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar((0.6 + Math.random() * 1.6) * size)
      this.scene.add(sprite)
      this.sparkles.push({ sprite, velocity, t: 0, life: 0.6 + Math.random() * 0.7 })
    }
  }

  private updateShards(dt: number): void {
    for (const shard of [...this.shards]) {
      shard.t += dt
      if (!shard.resting) {
        shard.velocity.y -= GRAVITY * dt
        shard.mesh.position.addScaledVector(shard.velocity, dt)
        shard.mesh.rotation.x += shard.spin.x * dt
        shard.mesh.rotation.y += shard.spin.y * dt
        if (shard.mesh.position.y <= 0.02) {
          shard.mesh.position.y = 0.02
          // Ein kleiner Hüpfer, dann liegen bleiben
          if (Math.abs(shard.velocity.y) > 0.8) shard.velocity.set(shard.velocity.x * 0.4, -shard.velocity.y * 0.3, shard.velocity.z * 0.4)
          else shard.resting = true
        }
      }
      // Nach einer Weile versinken die Scherben im Schnee.
      if (shard.t > 2.6) shard.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 3))
      if (shard.t > 3.6) {
        this.scene.remove(shard.mesh)
        this.shards.splice(this.shards.indexOf(shard), 1)
      }
    }
  }

  private updateSparkles(dt: number): void {
    for (const sparkle of [...this.sparkles]) {
      sparkle.t += dt
      sparkle.sprite.position.addScaledVector(sparkle.velocity, dt)
      sparkle.velocity.multiplyScalar(1 - dt * 1.5)
      sparkle.velocity.y -= dt * 0.6
      const k = sparkle.t / sparkle.life
      ;(sparkle.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k)
      if (k >= 1) {
        this.scene.remove(sparkle.sprite)
        sparkle.sprite.material.dispose()
        this.sparkles.splice(this.sparkles.indexOf(sparkle), 1)
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
