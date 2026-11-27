import * as THREE from 'three'
import { buildStandingElf } from '../../../scene/elf.ts'
import { createEnvironment } from '../../../scene/environment.ts'
import { buildMug, createEmojiTexture, createGluehweinStand, GLUEHWEIN_STAND_Z, STAND, standOffset } from '../../../scene/gluehweinStand.ts'
import { buildHouse } from '../../../scene/houseBuilder.ts'
import { createStreetLayout, STREET_SEED } from '../../../scene/houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from '../../../scene/materials.ts'
import { buildSquirrel } from '../../../scene/squirrel.ts'
import { createMoonTexture } from '../../../scene/textures.ts'
import { hasArrived, isCold, isPouring, WALK_TIME } from './model.ts'
import type { Base, Customer, Extra, Kind, Outcome, Shop } from './model.ts'

export type Stage = 'intro' | 'play' | 'done'

export interface GluehweinCallbacks {
  onStage(stage: Stage): void
  /** Jedes Bild im Spiel: Hier rechnet das Spiel die Zeit weiter. */
  onFrame(dt: number): void
}

const HOUSE_DAY = 13
/** Vorderkante der Theke: auf dem Gehweg vor Haus 13 – wie auf der Straße. */
export const STAND_Z = GLUEHWEIN_STAND_Z
/** Hier steht man hinter der Theke und schaut über die Straße. */
const EYE = new THREE.Vector3(0, 2.05, STAND_Z - 2.02)
const LOOK = new THREE.Vector3(0, 0.67, STAND_Z + 2.45)
/** Zu Beginn: Blick von der Straße auf Haus 13 mit dem Stand davor. */
const START = new THREE.Vector3(0, 4.2, 15)
const START_LOOK = new THREE.Vector3(0, 2.2, 0)
/** Plätze an der Theke (x; +x liegt aus Spielersicht links) und wie weit davor die Kundschaft steht. */
const SPOT_X = [1.2, 0, -1.2]
const QUEUE_Z = STAND_Z + 0.95
/** Auf dieser Linie laufen Gäste die Straße entlang heran und wieder fort. */
const LANE_Z = STAND_Z + 2.1
/** Gäste etwas kleiner als Menschen – sie lugen über die Theke. */
const ELF_SCALE = 0.9
const SQUIRREL_SCALE = 1

const LIQUID: Record<Base, string> = { gluehwein: '#6e1622', kakao: '#6b3e26' }
const SHOT: Record<Exclude<Extra, 'sahne'>, string> = { rum: '#3d1a0c', amaretto: '#d27a26' }
const MOOD: Record<Outcome, string> = { happy: '😍', wrong: '😕', cold: '🥶' }

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

interface Actor {
  id: number
  kind: Kind
  group: THREE.Group
  body: THREE.Mesh
  spot: number
  /** Von links (−1) oder rechts (+1) gekommen. */
  side: number
  state: 'come' | 'leave'
  t: number
  mug: THREE.Group | null
  mood: THREE.Sprite | null
}

interface CupView {
  group: THREE.Group
  liquid: THREE.Mesh
  cream: THREE.Mesh
  shot: THREE.Mesh
  jug: THREE.Group
  stream: THREE.Mesh
  steam: THREE.Sprite[]
  frost: THREE.Sprite
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

function puffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 30)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(canvas)
}

/**
 * Glühwein-Fieber in 3D: Der Stand steht auf dem Gehweg vor Haus 13. Zu Beginn sieht man ihn
 * von der Straße aus, dann tritt man hinter die Theke und dreht sich zur Straße um. Wichtel und
 * Eichhörnchen kommen die Straße entlang, stellen sich an und ziehen mit ihrem Becher weiter.
 */
export class GluehweinScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400)
  private readonly canvas: HTMLCanvasElement
  private readonly overlay: HTMLElement
  private readonly shop: () => Shop
  private readonly callbacks: GluehweinCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly raycaster = new THREE.Raycaster()
  private readonly solid = createSolidMaterial()
  private readonly actors = new Map<number, Actor>()
  private readonly leaving: Actor[] = []
  private readonly cups: CupView[] = []
  private readonly elfGeometries: THREE.BufferGeometry[] = []
  private readonly squirrelGeometry = buildSquirrel()
  private readonly mugGeometry = buildMug()
  private readonly liquidGeometry = new THREE.CylinderGeometry(0.066, 0.066, 1, 16)
  private readonly creamGeometry = new THREE.SphereGeometry(1, 12, 8)
  private readonly puff = puffTexture()
  private readonly moods = new Map<string, THREE.Texture>()
  private readonly disposers: (() => void)[] = []
  private readonly selection: THREE.Mesh
  private stage: Stage = 'intro'
  private stageTime = 0
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, shop: () => Shop, callbacks: GluehweinCallbacks, skipIntro: boolean) {
    this.canvas = canvas
    this.overlay = overlay
    this.shop = shop
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    for (let look = 0; look < 4; look++) this.elfGeometries.push(buildStandingElf(look))

    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.17, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd45e', transparent: true, opacity: 0.95, depthWrite: false }),
    )
    this.selection.rotation.x = -Math.PI / 2
    this.selection.visible = false
    this.build()

    if (skipIntro) this.startPlay()
    else this.place(START, START_LOOK)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __gluehwein: this })
    queueMicrotask(() => {
      if (!this.disposed) this.callbacks.onStage(this.stage)
    })
  }

  // --------------------------------------------------------------- Steuerung

  skipIntro(): void {
    if (this.stage === 'intro') this.startPlay()
  }

  /** Welcher Becher ist ausgewählt? Er bekommt einen goldenen Ring. */
  select(cup: number | null): void {
    this.selection.visible = cup !== null
    if (cup !== null) this.selection.position.set(STAND.cupX[cup], STAND.counterTop + 0.012, STAND_Z + STAND.cupZ)
  }

  /** Was liegt unter dem Finger: ein Becher oder ein Gast? */
  pick(clientX: number, clientY: number): { cup: number } | { customer: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    const ray = this.raycaster.ray
    let best: { cup: number } | { customer: number } | null = null
    let distance = Infinity
    const hit = new THREE.Vector3()
    const test = (center: THREE.Vector3, radius: number, result: { cup: number } | { customer: number }) => {
      if (!ray.intersectSphere(new THREE.Sphere(center, radius), hit)) return
      const d = hit.distanceTo(ray.origin)
      if (d < distance) {
        distance = d
        best = result
      }
    }
    STAND.cupX.forEach((x, cup) => test(new THREE.Vector3(x, STAND.counterTop + 0.08, STAND_Z + STAND.cupZ), 0.17, { cup }))
    for (const actor of this.actors.values()) {
      const p = actor.group.position
      for (const y of [0.6, 1.05]) test(new THREE.Vector3(p.x, y, p.z), 0.42, { customer: actor.id })
    }
    return best
  }

  /** Ein Gast hat seinen Becher bekommen: Er nimmt ihn, zeigt, wie es ihm gefällt, und zieht weiter. */
  served(customer: Customer, outcome: Outcome, drink: { base: Base; extra: Extra | null }): void {
    const actor = this.actors.get(customer.id)
    if (!actor) return
    this.actors.delete(customer.id)
    actor.state = 'leave'
    actor.t = 0
    actor.mug = this.makeMug(drink.base, drink.extra)
    actor.mug.position.set(0.02, actor.kind === 'elf' ? 0.44 : 0.52, actor.kind === 'elf' ? 0.2 : 0.3)
    actor.mug.rotation.y = -Math.PI / 2
    actor.group.add(actor.mug)
    const mood = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moodTexture(MOOD[outcome]), depthWrite: false, transparent: true }))
    mood.scale.setScalar(0.5)
    mood.position.set(0, 1.85, 0)
    actor.group.add(mood)
    actor.mood = mood
    this.leaving.push(actor)
  }

  /** Geschafft – die Kamera tritt zurück auf die Straße. */
  finish(): void {
    if (this.stage === 'done') return
    this.stage = 'done'
    this.stageTime = 0
    this.select(null)
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
    for (const geometry of [...this.elfGeometries, this.squirrelGeometry, this.mugGeometry, this.liquidGeometry, this.creamGeometry]) geometry.dispose()
    this.puff.dispose()
    for (const texture of this.moods.values()) texture.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------------ Aufbau

  private build(): void {
    const scene = this.scene
    scene.background = new THREE.Color('#2a2e62')
    scene.fog = new THREE.Fog('#2a2e62', 25, 90)
    scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2))
    const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.3)
    moonlight.position.set(-0.6, 0.9, 0.5)
    scene.add(moonlight)
    scene.add(starField(420, 150))
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
    moon.position.set(-22, 40, 90)
    moon.scale.setScalar(26)
    scene.add(moon)

    // Die ganze Straße – verschoben, sodass der Stand vor Haus 13 im Ursprung steht.
    // Er steht neben der Haustür (wie auf der Straße), damit Tür und Selfie frei bleiben.
    const layout = createStreetLayout(STREET_SEED)
    const home = layout.plots.find((p) => p.spec.day === HOUSE_DAY)!
    const street = new THREE.Group()
    scene.add(street)
    const glow = createGlowMaterial(this.time)
    glow.side = THREE.DoubleSide
    const halo = createGlowMaterial(this.time, { halo: true })
    for (const plot of layout.plots) {
      if (Math.abs(plot.x - home.x) > 45) continue
      const house = buildHouse(plot.spec)
      const group = new THREE.Group()
      group.position.x = plot.x
      const door = new THREE.Mesh(house.door, this.solid)
      door.position.copy(house.anchors.hinge)
      if (plot === home) street.position.x = -(home.x + standOffset(house.anchors.doorX, home.spec.width))
      group.add(new THREE.Mesh(house.solid, this.solid), new THREE.Mesh(house.glow, glow), new THREE.Mesh(house.halo, halo), door)
      street.add(group)
    }
    const environment = createEnvironment(layout, this.solid, this.time, STREET_SEED)
    street.add(environment.group)
    this.disposers.push(() => environment.dispose())

    const stand = createGluehweinStand(this.solid, this.time, { light: true })
    stand.group.position.z = STAND_Z
    scene.add(stand.group)
    this.disposers.push(() => stand.dispose())
    scene.add(this.selection)

    // Drei Becherplätze auf der Theke
    for (const x of STAND.cupX) {
      const view = this.makeCupView()
      view.group.position.set(x, STAND.counterTop, STAND_Z + STAND.cupZ)
      scene.add(view.group)
      this.cups.push(view)
    }
  }

  private makeCupView(): CupView {
    const group = new THREE.Group()
    group.add(new THREE.Mesh(this.mugGeometry, this.solid))
    const liquid = new THREE.Mesh(this.liquidGeometry, new THREE.MeshLambertMaterial({ color: LIQUID.gluehwein }))
    group.add(liquid)
    const cream = new THREE.Mesh(this.creamGeometry, new THREE.MeshLambertMaterial({ color: '#fffaf0' }))
    cream.scale.set(0.07, 0.045, 0.07)
    group.add(cream)
    const shot = new THREE.Mesh(this.creamGeometry, new THREE.MeshLambertMaterial({ color: SHOT.rum, emissive: '#2a1206' }))
    shot.scale.set(0.045, 0.01, 0.045)
    group.add(shot)

    // Kanne bzw. Kelle, die beim Zapfen über dem Becher schwebt und eingießt
    const jug = new THREE.Group()
    const jugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 14), new THREE.MeshLambertMaterial({ color: '#b8683c' }))
    jugBody.position.set(-0.08, 0, 0)
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.1, 8), jugBody.material)
    spout.position.set(0.03, 0.06, 0)
    spout.rotation.z = -1
    jug.add(jugBody, spout)
    jug.position.set(-0.02, 0.36, 0)
    jug.visible = false
    group.add(jug)
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), new THREE.MeshBasicMaterial({ color: LIQUID.gluehwein }))
    stream.visible = false
    group.add(stream)

    const steam: THREE.Sprite[] = []
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puff, transparent: true, depthWrite: false, opacity: 0 }))
      sprite.scale.setScalar(0.14)
      group.add(sprite)
      steam.push(sprite)
    }
    const frost = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moodTexture('❄️'), transparent: true, depthWrite: false }))
    frost.scale.setScalar(0.16)
    frost.position.set(0, 0.3, 0)
    frost.visible = false
    group.add(frost)
    return { group, liquid, cream, shot, jug, stream, steam, frost }
  }

  /** Ein fertiger Becher zum Mitnehmen (mit Inhalt, ohne Dampf). */
  private makeMug(base: Base, extra: Extra | null): THREE.Group {
    const group = new THREE.Group()
    group.add(new THREE.Mesh(this.mugGeometry, this.solid))
    const liquid = new THREE.Mesh(this.liquidGeometry, new THREE.MeshLambertMaterial({ color: LIQUID[base] }))
    liquid.scale.y = 0.12
    liquid.position.y = 0.065
    group.add(liquid)
    if (extra === 'sahne') {
      const cream = new THREE.Mesh(this.creamGeometry, new THREE.MeshLambertMaterial({ color: '#fffaf0' }))
      cream.scale.set(0.07, 0.045, 0.07)
      cream.position.y = 0.135
      group.add(cream)
    }
    return group
  }

  private moodTexture(emoji: string): THREE.Texture {
    let texture = this.moods.get(emoji)
    if (!texture) {
      texture = createEmojiTexture(emoji)
      this.moods.set(emoji, texture)
    }
    return texture
  }

  private makeActor(customer: Customer): Actor {
    const elf = customer.kind === 'elf'
    const body = new THREE.Mesh(elf ? this.elfGeometries[customer.look % this.elfGeometries.length] : this.squirrelGeometry, this.solid)
    body.scale.setScalar(elf ? ELF_SCALE : SQUIRREL_SCALE)
    const group = new THREE.Group()
    group.add(body)
    // Gäste von links kommen auch nach links wieder weg – das wirkt natürlicher.
    const side = SPOT_X[customer.spot] < 0 ? -1 : SPOT_X[customer.spot] > 0 ? 1 : customer.id % 2 ? -1 : 1
    this.scene.add(group)
    return { id: customer.id, kind: customer.kind, group, body, spot: customer.spot, side, state: 'come', t: 0, mug: null, mood: null }
  }

  private startPlay(): void {
    this.stage = 'play'
    this.stageTime = 0
    this.place(EYE, LOOK)
    this.callbacks.onStage('play')
  }

  private place(position: THREE.Vector3, look: THREE.Vector3): void {
    this.camera.position.copy(position)
    this.camera.lookAt(look)
  }

  // ------------------------------------------------------------ Bild für Bild

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.time.value += dt
    this.stageTime += dt

    if (this.stage === 'intro') this.updateIntro()
    else if (this.stage === 'play') this.callbacks.onFrame(dt)
    else this.updateOutro()

    const shop = this.shop()
    this.syncCustomers(shop, dt)
    this.updateLeaving(dt)
    this.syncCups(shop)
    this.renderer.render(this.scene, this.camera)
    this.updateOverlay(shop)
    this.frame = requestAnimationFrame(this.tick)
  }

  private updateIntro(): void {
    // Kurz den Stand vor dem Haus zeigen, dann hinter die Theke treten und umdrehen.
    const k = THREE.MathUtils.clamp((this.stageTime - 1.5) / 2.8, 0, 1)
    const t = easeInOut(k)
    const position = new THREE.Vector3().lerpVectors(START, EYE, t)
    // Erst zum Haus (−z), am Ende zur Straße (+z): die Blickrichtung dreht sich um die Hochachse.
    const from = new THREE.Vector3().subVectors(START_LOOK, START).normalize()
    const to = new THREE.Vector3().subVectors(LOOK, EYE).normalize()
    const yaw = Math.PI * (1 - t)
    const pitch = THREE.MathUtils.lerp(Math.asin(from.y), Math.asin(to.y), t)
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    this.place(position, position.clone().add(direction))
    if (k >= 1) this.startPlay()
  }

  private updateOutro(): void {
    // Zurück auf die Straße – mit Blick auf den Stand, an dem noch Gäste feiern.
    const k = easeInOut(THREE.MathUtils.clamp(this.stageTime / 3.2, 0, 1))
    const target = new THREE.Vector3(1.6, 3.4, STAND_Z + 8.5)
    const look = new THREE.Vector3(0, 1.6, STAND_Z - 0.6)
    const position = new THREE.Vector3().lerpVectors(EYE, target, k)
    // Seitlich um den Stand herum, damit man nicht durchs Dach fliegt.
    position.x += Math.sin(k * Math.PI) * 3.2
    position.y += Math.sin(k * Math.PI) * 1.2
    const direction = new THREE.Vector3().lerpVectors(
      new THREE.Vector3().subVectors(LOOK, EYE).normalize(),
      new THREE.Vector3().subVectors(look, target).normalize(),
      k,
    )
    this.place(position, position.clone().add(direction))
  }

  private syncCustomers(shop: Shop, dt: number): void {
    const present = new Set<number>()
    for (const customer of shop.customers) {
      present.add(customer.id)
      let actor = this.actors.get(customer.id)
      if (!actor) {
        actor = this.makeActor(customer)
        this.actors.set(customer.id, actor)
      }
      actor.t += dt
      const progress = 1 - customer.arrive / WALK_TIME
      const spotX = SPOT_X[customer.spot]
      const startX = spotX + actor.side * 9
      const p = actor.group.position
      if (progress < 0.78) {
        // Die Straße entlang heranlaufen
        const k = progress / 0.78
        p.set(THREE.MathUtils.lerp(startX, spotX, k), 0, LANE_Z)
        actor.group.rotation.y = actor.side > 0 ? -Math.PI / 2 : Math.PI / 2
        this.walk(actor, actor.t)
      } else if (!hasArrived(customer)) {
        // Zur Theke einbiegen
        const k = (progress - 0.78) / 0.22
        p.set(spotX, 0, THREE.MathUtils.lerp(LANE_Z, QUEUE_Z, k))
        actor.group.rotation.y = THREE.MathUtils.lerp(actor.side > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI, Math.min(1, k * 1.6))
        this.walk(actor, actor.t)
      } else {
        // Warten: leicht hin und her wippen, nach dem Lösen fröhlich hüpfen
        p.set(spotX, 0, QUEUE_Z)
        actor.group.rotation.y = Math.PI
        const cheer = this.stage === 'done'
        actor.body.position.y = cheer ? Math.abs(Math.sin(this.time.value * 7 + actor.id)) * 0.25 : 0
        actor.body.rotation.z = Math.sin(this.time.value * 2.2 + actor.id * 1.7) * 0.05
      }
    }
    for (const [id, actor] of this.actors) {
      if (present.has(id)) continue
      // Verschwunden, ohne bedient worden zu sein (sollte nicht vorkommen): einfach entfernen.
      this.scene.remove(actor.group)
      this.actors.delete(id)
    }
  }

  private walk(actor: Actor, t: number): void {
    actor.body.position.y = Math.abs(Math.sin(t * 9)) * 0.06
    actor.body.rotation.z = Math.sin(t * 9) * 0.06
  }

  private updateLeaving(dt: number): void {
    for (const actor of [...this.leaving]) {
      actor.t += dt
      const p = actor.group.position
      if (actor.mood) {
        const k = Math.min(1, actor.t / 0.35)
        actor.mood.scale.setScalar(0.25 + 0.3 * k)
        actor.mood.position.y = 1.8 + actor.t * 0.12
        ;(actor.mood.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - Math.max(0, actor.t - 1.8) / 0.6)
      }
      // Kurz stehen bleiben und probieren, dann zur Seite weiterziehen
      if (actor.t < 0.7) {
        actor.body.position.y = Math.sin((actor.t / 0.7) * Math.PI) * 0.12
      } else if (actor.t < 1.2) {
        const k = (actor.t - 0.7) / 0.5
        actor.group.rotation.y = THREE.MathUtils.lerp(Math.PI, actor.side > 0 ? Math.PI / 2 : -Math.PI / 2, k)
        p.z = THREE.MathUtils.lerp(QUEUE_Z, LANE_Z, k)
        this.walk(actor, actor.t)
      } else {
        p.x += actor.side * dt * 3.4
        p.z = LANE_Z
        this.walk(actor, actor.t)
      }
      if (actor.t > 4.5) {
        this.scene.remove(actor.group)
        ;(actor.mood?.material as THREE.Material | undefined)?.dispose()
        this.leaving.splice(this.leaving.indexOf(actor), 1)
      }
    }
  }

  private syncCups(shop: Shop): void {
    shop.cups.forEach((cup, i) => {
      const view = this.cups[i]
      view.group.visible = cup.base !== null
      if (cup.base === null) return
      const fill = cup.fill
      const level = 0.02 + fill * 0.1
      view.liquid.scale.y = level
      view.liquid.position.y = 0.006 + level / 2
      ;(view.liquid.material as THREE.MeshLambertMaterial).color.set(LIQUID[cup.base])

      const pouring = isPouring(cup)
      view.jug.visible = pouring
      view.stream.visible = pouring
      if (pouring) {
        view.jug.rotation.z = -0.5 - Math.sin(this.time.value * 3) * 0.08
        ;(view.jug.children[0] as THREE.Mesh).material = this.jugMaterial(cup.base)
        const top = 0.38
        view.stream.scale.y = top - level
        view.stream.position.set(0.02, level + (top - level) / 2, 0)
        ;(view.stream.material as THREE.MeshBasicMaterial).color.set(LIQUID[cup.base])
      }

      const toppingDone = cup.topping
      view.cream.visible = cup.extra === 'sahne'
      if (view.cream.visible) {
        view.cream.scale.set(0.07, 0.045 * toppingDone, 0.07)
        view.cream.position.y = 0.13
      }
      view.shot.visible = cup.extra === 'rum' || cup.extra === 'amaretto'
      if (view.shot.visible) {
        ;(view.shot.material as THREE.MeshLambertMaterial).color.set(SHOT[cup.extra as 'rum' | 'amaretto'])
        view.shot.scale.set(0.04 * toppingDone + 0.005, 0.008, 0.04 * toppingDone + 0.005)
        view.shot.position.y = level + 0.008
      }

      // Dampf, solange der Becher warm ist – je kälter, desto weniger
      const heat = pouring ? 1 : cup.heat
      view.steam.forEach((sprite, s) => {
        const phase = (this.time.value * 0.6 + s / view.steam.length) % 1
        sprite.position.set(Math.sin((phase + s) * 5) * 0.03, 0.16 + phase * 0.32, 0)
        sprite.scale.setScalar(0.08 + phase * 0.16)
        ;(sprite.material as THREE.SpriteMaterial).opacity = heat * 0.55 * Math.sin(phase * Math.PI)
      })
      view.frost.visible = isCold(cup)
      if (view.frost.visible) view.frost.position.y = 0.28 + Math.sin(this.time.value * 3 + i) * 0.015
    })
  }

  private readonly jugMaterials = new Map<Base, THREE.Material>()
  private jugMaterial(base: Base): THREE.Material {
    let material = this.jugMaterials.get(base)
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color: base === 'gluehwein' ? '#b8683c' : '#e9dcc8' })
      this.jugMaterials.set(base, material)
      this.disposers.push(() => material!.dispose())
    }
    return material
  }

  /** Sprechblasen über den Köpfen: Die Oberfläche zeichnet sie, die Szene schiebt sie an ihren Platz. */
  private updateOverlay(shop: Shop): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const v = new THREE.Vector3()
    for (const element of this.overlay.querySelectorAll<HTMLElement>('[data-customer]')) {
      const id = Number(element.dataset.customer)
      const actor = this.actors.get(id)
      const customer = shop.customers.find((c) => c.id === id)
      if (!actor || !customer || this.stage !== 'play') {
        element.style.visibility = 'hidden'
        continue
      }
      v.copy(actor.group.position)
      v.y = actor.kind === 'elf' ? 1.78 : 1.5
      v.project(this.camera)
      element.style.visibility = v.z < 1 ? 'visible' : 'hidden'
      element.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px) translate(-50%, -100%)`
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
