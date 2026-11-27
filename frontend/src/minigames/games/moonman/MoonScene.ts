import * as THREE from 'three'
import { Builder } from '../../../scene/batch.ts'
import { createEnvironment } from '../../../scene/environment.ts'
import { buildHouse } from '../../../scene/houseBuilder.ts'
import { createStreetLayout, STREET_SEED } from '../../../scene/houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from '../../../scene/materials.ts'
import { col } from '../../../scene/palette.ts'
import { createMoonTexture } from '../../../scene/textures.ts'
import {
  DECOR, DustField, FIELD, grow, keepInside, PLAY_RADIUS, rollStep, sizeProgress, trackHalfWidth,
  spawnPoint, stackHeights, START_RADIUS, TARGET_RADII,
} from './model.ts'
import type { Decor, MoonProgress, Point } from './model.ts'

export type Stage = 'intro' | 'rolling' | 'moving' | 'aiming' | 'flying' | 'decorate' | 'done'

export interface MoonCallbacks {
  onStage(stage: Stage, ball: number): void
  /** Wie groß die aktuelle Kugel schon ist (0–1). */
  onSize(progress: number): void
  onThrow(result: 'weak' | 'ok'): void
  /** Kurz bevor der Blick vom Haus auf den Mond springt – Zeit für einen hellen Blitz. */
  onFlash(): void
  onSave(progress: MoonProgress): void
}

const MAX_SPEED = 4.2
const HOUSE_DAY = 5
/** Wie stark man (in Pixeln) nach oben wischen muss, damit die Kugel oben landet. */
export const SWIPE_STRONG = 60
export const SWIPE_WEAK = 12
const HEIGHTS = stackHeights()
/**
 * Die Staubdecke wird auf eine große Leinwand gemalt: hell = frischer, hoher Staub,
 * dunkel = abgerollter Grund. Dieselbe Leinwand färbt den Boden, hebt ihn an und
 * schattiert ihn pixelgenau – so bleiben die Rinnenkanten auch aus der Nähe scharf.
 */
const SURFACE_PX = 1024
/** Grauwerte (0–255) auf der Leinwand. */
const SHADE = { fresh: 214, bare: 104, rim: 232 }
/** So hoch (Meter) liegt frischer Mondstaub – die Kugel gräbt sich beim Rollen eine Rinne. */
const DUST_HEIGHT = 0.16
/** Pixelfeine Schattierung von Kanten und Körnung. */
const BUMP = 1.4
const PX_PER_M = SURFACE_PX / (FIELD.half * 2)
const RELIEF_PX = 128
/** Wie oft pro Sekunde die Staubdecke neu zur Grafikkarte geht (Farbe/Licht bzw. Höhe). */
const SURFACE_HZ = 15
const RELIEF_EVERY = 2

const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const easeIn = (t: number) => t * t

interface Tween {
  elapsed: number
  duration: number
  update(k: number): void
  done?(): void
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Mondstaub auf der Kugel: hell mit dunklen Körnchen – so sieht man, dass sie rollt. */
function dustBallTexture() {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#e2e4ea'
    ctx.fillRect(0, 0, 256, 128)
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = i % 4 ? 'rgba(120,124,138,0.35)' : 'rgba(255,255,255,0.8)'
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 128, 0.6 + Math.random() * 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(110,114,128,0.35)'
    ctx.lineWidth = 2
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      ctx.arc(Math.random() * 256, 16 + Math.random() * 96, 4 + Math.random() * 7, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
}

function earthTexture() {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#2f6fc9'
    ctx.fillRect(0, 0, 256, 128)
    const blob = (x: number, y: number, r: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.4) {
        const rr = r * (0.7 + 0.3 * Math.sin(a * 3 + x))
        ctx.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr)
      }
      ctx.fill()
    }
    blob(50, 50, 18, '#4f9a5a'); blob(70, 80, 12, '#8a7a4a'); blob(150, 40, 22, '#4f9a5a')
    blob(180, 78, 16, '#4f9a5a'); blob(220, 60, 10, '#8a7a4a')
    ctx.fillStyle = '#f4f7ff'
    ctx.fillRect(0, 0, 256, 10)
    ctx.fillRect(0, 118, 256, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 14; i++) {
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, 20 + Math.random() * 88, 10 + Math.random() * 16, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function starField(count: number, radius: number, minY: number): THREE.Points {
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const y = minY + Math.random() * (1 - minY)
    const a = Math.random() * Math.PI * 2
    const ring = Math.sqrt(1 - y * y)
    positions.push(Math.cos(a) * ring * radius, y * radius, Math.sin(a) * ring * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff8e6', size: 1.6, sizeAttenuation: false, fog: false }))
}

function buildRocket(): THREE.Group {
  const b = new Builder()
  const white = col('#f4f1ec')
  const red = col('#d33b33')
  b.cylinder(0, 0.6, 0, 0.22, 0.22, 1.2, 16, [col('#d9d6d0'), white])
  b.cone(0, 1.2, 0, 0.22, 0.5, 16, red)
  b.cylinder(0, 0.9, 0, 0.225, 0.225, 0.08, 16, red)
  b.cylinder(0, 0.08, 0, 0.18, 0.22, 0.16, 16, col('#8d8f99'))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    b.within(new THREE.Matrix4().makeRotationY(a), () => b.box(0, 0.22, 0.27, 0.04, 0.42, 0.18, red, { x: 0.25 }))
  }
  b.cylinder(0, 0.7, 0.2, 0.09, 0.09, 0.04, 16, col('#9fd8f5'), { x: Math.PI / 2 })
  const group = new THREE.Group()
  group.add(new THREE.Mesh(b.batch.build('lit'), createSolidMaterial()))
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.7, 12),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  flame.rotation.x = Math.PI
  flame.position.y = -0.33
  flame.name = 'flame'
  group.add(flame)
  return group
}

/** Die Szene des Mondstaub-Manns: erst der Raketenstart am Haus, dann der Mond. */
export class MoonScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500)
  private readonly lookAt = new THREE.Vector3()
  private readonly time = { value: 0 }
  private readonly tweens: Tween[] = []
  private readonly callbacks: MoonCallbacks
  private readonly canvas: HTMLCanvasElement
  private readonly observer: ResizeObserver
  private frame = 0
  private last = 0
  private disposed = false

  // Start am Haus
  private readonly intro = new THREE.Scene()
  private readonly rocket = buildRocket()
  private readonly puffs: { mesh: THREE.Mesh; life: number }[] = []
  private chimney = new THREE.Vector3()
  private introTime = 0
  private readonly moonSpot = new THREE.Vector3(-22, 46, -90)
  private flashed = false

  // Auf dem Mond
  private readonly moon = new THREE.Scene()
  private readonly field = new DustField()
  private readonly surface = document.createElement('canvas')
  private readonly surfaceContext: CanvasRenderingContext2D
  private readonly surfaceTexture: THREE.CanvasTexture
  private surfaceDirty = false
  /** Weichgezeichnete, kleinere Kopie nur für die Höhe – sonst zeichnet das Gitter Treppen in die Kanten. */
  private readonly relief = document.createElement('canvas')
  private readonly reliefTexture: THREE.CanvasTexture
  /** Die zuletzt gegrabenen Stücke – ihr Grund wird nachgezogen, damit der neue Wall ihn nicht zuschüttet. */
  private recentTracks: { from: Point; to: Point; radius: number }[] = []
  private lastUpload = 0
  private readonly ballGeometry = new THREE.SphereGeometry(1, 40, 24)
  private readonly ballMaterial: THREE.MeshLambertMaterial
  private readonly shadow: THREE.Mesh
  private readonly snowman = new THREE.Group()
  private readonly earth: THREE.Mesh
  private ball: THREE.Mesh | null = null
  private radius = START_RADIUS
  private position: Point = { x: 0, z: 0 }
  private readonly velocity = { x: 0, z: 0 }
  private readonly drive = { x: 0, z: 0 }
  private path: Point[] = []

  private scene: THREE.Scene
  private stage: Stage = 'intro'
  private ballIndex = 0
  private stacked = 0
  private base: Point = { x: 0, z: 0 }
  private readonly decor = new Set<Decor>()
  private sizeReported = -1
  private orbit = 0

  constructor(canvas: HTMLCanvasElement, callbacks: MoonCallbacks, progress: MoonProgress | null) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    // 1,5 reicht für ein scharfes Bild und spart auf Retina-Handys fast die Hälfte der Pixel.
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))

    this.surface.width = this.surface.height = SURFACE_PX
    this.surfaceContext = this.surface.getContext('2d')!
    this.surfaceTexture = new THREE.CanvasTexture(this.surface)
    this.surfaceTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
    this.relief.width = this.relief.height = RELIEF_PX
    this.reliefTexture = new THREE.CanvasTexture(this.relief)
    this.reliefTexture.generateMipmaps = false
    this.reliefTexture.minFilter = THREE.LinearFilter
    this.paintFreshDust()
    this.ballMaterial = new THREE.MeshLambertMaterial({ map: dustBallTexture() })
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), new THREE.MeshBasicMaterial({ map: earthTexture() }))

    this.buildIntro()
    this.buildMoon()

    if (progress) {
      this.scene = this.moon
      this.restore(progress)
    } else {
      this.scene = this.intro
      this.camera.position.set(2.5, 4.2, 15)
      this.lookAt.set(0, 4.6, 0)
    }

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
    // Nur in der Entwicklung: Zugriff aus der Browser-Konsole.
    if (import.meta.env.DEV) Object.assign(window, { __moon: this })
    queueMicrotask(() => {
      if (!this.disposed) this.callbacks.onStage(this.stage, this.ballIndex)
    })
  }

  // --------------------------------------------------------------- Steuerung

  /** Richtung, in die gerollt werden soll (−1…1, x nach rechts, z zum Betrachter). */
  setDrive(x: number, z: number): void {
    this.drive.x = x
    this.drive.z = z
  }

  /** Wisch nach oben um `pixels` – wirft die Kugel auf den Turm, wenn er kräftig genug war. */
  swipe(pixels: number): void {
    if (this.stage !== 'aiming' || pixels < SWIPE_WEAK) return
    if (pixels >= SWIPE_STRONG) this.throwBall()
    else this.hop()
  }

  skipIntro(): void {
    if (this.stage === 'intro') this.landOnMoon()
  }

  addDecor(item: Decor): void {
    if ((this.stage !== 'decorate' && this.stage !== 'done') || this.decor.has(item)) return
    this.decor.add(item)
    this.attachDecor(item, true)
    this.save()
    if (DECOR.every((d) => this.decor.has(d))) this.setStage('done')
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    const seen = new Set<unknown>()
    for (const scene of [this.intro, this.moon]) {
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
    this.surfaceTexture.dispose()
    this.reliefTexture.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------------ Aufbau

  private buildIntro(): void {
    const scene = this.intro
    scene.background = new THREE.Color('#2a2e62')
    scene.fog = new THREE.Fog('#2a2e62', 30, 160)
    scene.add(new THREE.HemisphereLight('#b9c6ff', '#f6dccb', 2.2))
    const moonlight = new THREE.DirectionalLight('#dfe5ff', 1.4)
    moonlight.position.set(-0.4, 0.8, 0.9)
    scene.add(moonlight)

    // Die ganze Straße – verschoben, sodass Haus 5 im Ursprung steht.
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
      if (plot === home) this.chimney.copy(house.anchors.smoke ?? new THREE.Vector3(-1, house.anchors.height - 1, -2))
    }
    const environment = createEnvironment(layout, solid, this.time, STREET_SEED)
    street.add(environment.group)
    const stars = starField(380, 150, 0.15)
    scene.add(stars)

    const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: createMoonTexture(0.5), fog: false, depthWrite: false }))
    moonSprite.position.copy(this.moonSpot)
    moonSprite.scale.setScalar(34)
    scene.add(moonSprite)

    this.rocket.scale.setScalar(1.1)
    this.rocket.position.copy(this.chimney).y -= 1.4
    scene.add(this.rocket)
    const puffMaterial = new THREE.MeshBasicMaterial({ color: '#f2f4fa', transparent: true, opacity: 0.8, depthWrite: false })
    const puffGeometry = new THREE.SphereGeometry(0.22, 10, 8)
    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(puffGeometry, puffMaterial.clone())
      mesh.visible = false
      scene.add(mesh)
      this.puffs.push({ mesh, life: 0 })
    }
  }

  private buildMoon(): void {
    const scene = this.moon
    scene.background = new THREE.Color('#04050c')
    scene.add(new THREE.HemisphereLight('#a7b1d6', '#2a2b33', 0.9))
    const sun = new THREE.DirectionalLight('#ffffff', 2.4)
    sun.position.set(6, 10, 5)
    scene.add(sun)

    scene.add(starField(800, 160, -0.05))
    this.earth.position.set(-38, 42, -110)
    this.earth.rotation.z = 0.4
    scene.add(this.earth)

    const play = new THREE.Mesh(
      // Fein unterteilt: Jeder Eckpunkt hebt sich um die Staubhöhe an seiner Stelle.
      new THREE.PlaneGeometry(FIELD.half * 2, FIELD.half * 2, 160, 160),
      new THREE.MeshLambertMaterial({
        color: '#e6e8f0',
        map: this.surfaceTexture,
        // Grauwert → Höhe: abgerollter Grund liegt bei 0, frischer Staub DUST_HEIGHT darüber.
        displacementMap: this.reliefTexture,
        displacementScale: (DUST_HEIGHT * 255) / (SHADE.fresh - SHADE.bare),
        displacementBias: (-DUST_HEIGHT * SHADE.bare) / (SHADE.fresh - SHADE.bare),
        bumpMap: this.surfaceTexture,
        bumpScale: BUMP,
      }),
    )
    play.rotation.x = -Math.PI / 2
    scene.add(play)
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: '#686b76' }))
    outside.rotation.x = -Math.PI / 2
    outside.position.y = -0.02
    scene.add(outside)

    // Kraterrand rund ums Spielfeld und ein paar Krater in der Ferne
    const rock = new THREE.MeshLambertMaterial({ color: '#7a7d88' })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PLAY_RADIUS + 1.4, 1.5, 10, 64), rock)
    rim.rotation.x = -Math.PI / 2
    rim.scale.z = 0.35
    scene.add(rim)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3
      const d = 26 + Math.random() * 50
      const r = 1.5 + Math.random() * 4
      const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.25, 8, 28), rock)
      crater.rotation.x = -Math.PI / 2
      crater.scale.z = 0.4
      crater.position.set(Math.cos(a) * d, 0, Math.sin(a) * d)
      scene.add(crater)
    }

    this.shadow.position.y = 0.01
    scene.add(this.shadow, this.snowman)
  }

  private restore(progress: MoonProgress): void {
    this.base = { ...progress.base }
    this.stacked = progress.stacked
    for (let i = 0; i < this.stacked; i++) this.stackBall(i, false)
    if (this.stacked >= 3) {
      for (const item of progress.decor) {
        this.decor.add(item)
        this.attachDecor(item, false)
      }
      this.stage = DECOR.every((d) => this.decor.has(d)) ? 'done' : 'decorate'
      this.placeDecorCamera(true)
    } else {
      this.spawnBall(this.stacked)
      this.stage = 'rolling'
      this.followBall(1)
    }
  }

  // ------------------------------------------------------------------ Ablauf

  private setStage(stage: Stage): void {
    this.stage = stage
    this.callbacks.onStage(stage, this.ballIndex)
  }

  private save(): void {
    this.callbacks.onSave({ stacked: this.stacked, base: { ...this.base }, decor: DECOR.filter((d) => this.decor.has(d)) })
  }

  private landOnMoon(): void {
    this.scene = this.moon
    this.spawnBall(0)
    this.followBall(1)
    this.setStage('rolling')
  }

  private spawnBall(index: number): void {
    this.ballIndex = index
    this.recentTracks = []
    this.radius = START_RADIUS
    this.position = index === 0 ? { x: 0, z: 2 } : spawnPoint(this.base)
    this.velocity.x = this.velocity.z = 0
    this.ball = new THREE.Mesh(this.ballGeometry, this.ballMaterial)
    this.moon.add(this.ball)
    this.sizeReported = -1
    this.updateBall()
    this.shadow.visible = true
  }

  /** Eine fertige Kugel an ihren Platz im Turm setzen. */
  private stackBall(index: number, squash: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(this.ballGeometry, this.ballMaterial)
    const radius = TARGET_RADII[index]
    mesh.position.set(this.base.x, HEIGHTS[index], this.base.z)
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0)
    mesh.scale.setScalar(radius)
    mesh.name = `ball-${index}`
    this.snowman.add(mesh)
    if (squash) {
      this.tween(0.35, (k) => {
        const s = Math.sin(k * Math.PI) * 0.12
        mesh.scale.set(radius * (1 + s), radius * (1 - s), radius * (1 + s))
      })
    }
    return mesh
  }

  private ballDone(): void {
    const ball = this.ball!
    if (this.ballIndex === 0) {
      this.base = { ...this.position }
      this.moon.remove(ball)
      this.ball = null
      this.shadow.visible = false
      this.stackBall(0, true)
      this.stacked = 1
      this.save()
      this.spawnBall(1)
      this.setStage('rolling')
      return
    }
    // Vor den Turm rollen, damit man die Kugel von vorn hochwerfen kann.
    const r = this.radius
    const front = { x: this.base.x, z: this.base.z + TARGET_RADII[0] + r + 0.9 }
    const path: Point[] = []
    if (this.position.z < this.base.z + TARGET_RADII[0]) {
      const side = Math.sign(this.position.x - this.base.x) || 1
      path.push({ x: this.base.x + side * (TARGET_RADII[0] + r + 0.7), z: this.base.z + 0.4 })
    }
    path.push(front)
    this.path = path
    this.setStage('moving')
  }

  private throwBall(): void {
    const ball = this.ball!
    const index = this.ballIndex
    const start = ball.position.clone()
    const end = new THREE.Vector3(this.base.x, HEIGHTS[index], this.base.z)
    this.shadow.visible = false
    this.callbacks.onThrow('ok')
    this.setStage('flying')
    // Auf dem Mond fliegt alles gemächlich.
    this.tween(1.5, (k) => {
      const t = easeInOut(k)
      ball.position.set(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t + 1.8 * 4 * t * (1 - t),
        start.z + (end.z - start.z) * t,
      )
      ball.rotateX(-0.12)
    }, () => {
      this.moon.remove(ball)
      this.ball = null
      this.stackBall(index, true)
      this.puff(end.x, end.y - TARGET_RADII[index] * 0.8, end.z)
      this.stacked = index + 1
      this.save()
      if (this.stacked < 3) {
        this.spawnBall(this.stacked)
        this.setStage('rolling')
      } else {
        this.placeDecorCamera(false)
        this.setStage('decorate')
      }
    })
  }

  private hop(): void {
    const ball = this.ball!
    const y = ball.position.y
    this.callbacks.onThrow('weak')
    this.setStage('flying')
    this.tween(0.9, (k) => {
      ball.position.y = y + Math.sin(k * Math.PI) * 0.9
    }, () => this.setStage('aiming'))
  }

  /** Staubwölkchen beim Landen. */
  private puff(x: number, y: number, z: number): void {
    const material = new THREE.MeshBasicMaterial({ color: '#d9dbe2', transparent: true, opacity: 0.7, depthWrite: false })
    const geometry = new THREE.SphereGeometry(0.12, 8, 6)
    const bits = Array.from({ length: 10 }, (_, i) => {
      const mesh = new THREE.Mesh(geometry, material)
      const a = (i / 10) * Math.PI * 2
      mesh.position.set(x, y, z)
      mesh.userData.dir = new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a))
      this.moon.add(mesh)
      return mesh
    })
    this.tween(0.9, (k) => {
      for (const mesh of bits) {
        mesh.position.set(x, y, z).addScaledVector(mesh.userData.dir as THREE.Vector3, k * 1.3)
        mesh.scale.setScalar(1 + k * 2)
      }
      material.opacity = 0.7 * (1 - k)
    }, () => {
      for (const mesh of bits) this.moon.remove(mesh)
      geometry.dispose()
      material.dispose()
    })
  }

  // -------------------------------------------------------------- Schmuck

  private attachDecor(item: Decor, animate: boolean): void {
    const group = new THREE.Group()
    group.position.set(this.base.x, 0, this.base.z)
    this.snowman.add(group)
    const [, r1, r2] = TARGET_RADII
    const middle = new THREE.Vector3(0, HEIGHTS[1], 0)
    const head = new THREE.Vector3(0, HEIGHTS[2], 0)
    const pop = (object: THREE.Object3D, delay: number) => {
      const scale = object.scale.x
      if (!animate) return
      object.scale.setScalar(0.0001)
      this.tween(0.5 + delay, (k) => {
        const t = Math.max(0, (k * (0.5 + delay) - delay) / 0.5)
        object.scale.setScalar(Math.max(0.0001, easeOutBack(Math.min(1, t)) * scale))
      })
    }
    const onSurface = (center: THREE.Vector3, radius: number, dir: THREE.Vector3) =>
      center.clone().addScaledVector(dir.normalize(), radius * 0.98)

    if (item === 'sticks') {
      const wood = new THREE.MeshLambertMaterial({ color: '#6b4129' })
      for (const side of [-1, 1]) {
        const arm = new THREE.Group()
        arm.position.copy(onSurface(middle, r1, new THREE.Vector3(side, 0.15, 0)))
        arm.rotation.z = side * -1.05
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.2, 6), wood)
        stick.position.y = 0.55
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.36, 5), wood)
        twig.position.set(side * -0.08, 0.85, 0)
        twig.rotation.z = side * 0.6
        arm.add(stick, twig)
        group.add(arm)
        pop(arm, 0)
      }
    }
    if (item === 'coins') {
      const gold = new THREE.MeshLambertMaterial({ color: '#e8b04a', emissive: '#5a3a08' })
      const pebble = new THREE.MeshLambertMaterial({ color: '#2c2f42' })
      const coin = new THREE.CylinderGeometry(0.075, 0.075, 0.025, 20)
      const place = (center: THREE.Vector3, radius: number, dir: THREE.Vector3, delay: number, size = 1) => {
        const mesh = new THREE.Mesh(coin, gold)
        const position = onSurface(center, radius, dir)
        mesh.position.copy(position)
        mesh.lookAt(position.clone().add(dir))
        mesh.rotateX(Math.PI / 2)
        mesh.scale.setScalar(size)
        group.add(mesh)
        pop(mesh, delay)
      }
      place(head, r2, new THREE.Vector3(-0.34, 0.22, 0.9), 0, 1.15)
      place(head, r2, new THREE.Vector3(0.34, 0.22, 0.9), 0.08, 1.15)
      place(middle, r1, new THREE.Vector3(0, 0.38, 0.92), 0.2, 1.4)
      place(middle, r1, new THREE.Vector3(0, 0.02, 1), 0.28, 1.4)
      place(middle, r1, new THREE.Vector3(0, -0.34, 0.94), 0.36, 1.4)
      for (let i = 0; i < 5; i++) {
        const x = -0.3 + i * 0.15
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), pebble)
        mesh.position.copy(onSurface(head, r2, new THREE.Vector3(x, -0.18 - 0.12 * (1 - (x / 0.3) ** 2), 0.92)))
        group.add(mesh)
        pop(mesh, 0.1 + i * 0.05)
      }
    }
    if (item === 'helmet') {
      const helmet = new THREE.Group()
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(r2 * 1.34, 32, 20),
        new THREE.MeshPhongMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.26, shininess: 140, specular: '#ffffff', depthWrite: false }),
      )
      const white = new THREE.MeshLambertMaterial({ color: '#f4f4f6' })
      const collar = new THREE.Mesh(new THREE.TorusGeometry(r2 * 1.12, 0.1, 10, 32), white)
      collar.rotation.x = Math.PI / 2
      collar.position.y = -r2 * 0.88
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), white)
      antenna.position.set(r2 * 0.5, r2 * 1.35, 0)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff4a3d' }))
      tip.position.set(r2 * 0.5, r2 * 1.35 + 0.2, 0)
      helmet.add(glass, collar, antenna, tip)
      helmet.position.copy(head)
      group.add(helmet)
      if (animate) {
        this.tween(1.1, (k) => {
          const t = k < 0.7 ? easeIn(k / 0.7) : 1
          const bounce = k >= 0.7 ? Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.12 : 0
          helmet.position.y = head.y + (1 - t) * 3 + bounce
        })
      }
    }
  }

  // --------------------------------------------------------------- Kamera

  private followBall(follow: number): void {
    const r = this.radius
    const target = new THREE.Vector3(this.position.x, 3.2 + r * 2.6, this.position.z + 5.4 + r * 3.4)
    this.camera.position.lerp(target, follow)
    this.lookAt.lerp(new THREE.Vector3(this.position.x, r * 0.6, this.position.z - 0.5), follow)
  }

  private aimCamera(follow: number): void {
    const top = HEIGHTS[this.ballIndex] + this.radius
    // Etwas erhöht und seitlich: Man sieht die Kugel vorn und oben den Platz, auf dem sie landen soll.
    const target = new THREE.Vector3(this.base.x + 2.4, top + 1.3, this.base.z + TARGET_RADII[0] + this.radius + 6.2)
    this.camera.position.lerp(target, follow)
    this.lookAt.lerp(new THREE.Vector3(this.base.x, top * 0.5, this.base.z + 0.8), follow)
  }

  private placeDecorCamera(instant: boolean): void {
    this.orbit = 0
    if (instant) {
      this.camera.position.set(this.base.x, 2.6, this.base.z + 6.4)
      this.lookAt.set(this.base.x, 2.2, this.base.z)
    }
  }

  // ------------------------------------------------------------ Bild für Bild

  private tween(duration: number, update: (k: number) => void, done?: () => void): void {
    this.tweens.push({ elapsed: 0, duration, update, done })
  }

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.time.value += dt

    for (const tween of [...this.tweens]) {
      tween.elapsed += dt
      const k = Math.min(1, tween.elapsed / tween.duration)
      tween.update(k)
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tween), 1)
        tween.done?.()
      }
    }

    if (this.stage === 'intro') this.updateIntro(dt)
    else this.updateMoon(dt)

    this.camera.lookAt(this.lookAt)
    this.renderer.render(this.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  private updateIntro(dt: number): void {
    this.introTime += dt
    const t = this.introTime
    const rocket = this.rocket
    const flame = rocket.getObjectByName('flame')!
    flame.scale.set(1, 0.8 + Math.random() * 0.5, 1)

    // Erst senkrecht hoch, dann im Bogen Richtung Mond.
    const top = this.chimney.clone().setY(this.chimney.y + 0.5)
    const climb = top.clone().setY(top.y + 7)
    const p1 = climb.clone().add(new THREE.Vector3(0, 10, 0))
    const previous = rocket.position.clone()
    if (t < 1) {
      // Wackelnd aus dem Schornstein heraus
      rocket.position.copy(this.chimney).setY(this.chimney.y - 1.4 + easeInOut(t) * 1.9)
      rocket.position.x += Math.sin(t * 60) * 0.03
    } else if (t < 2.2) {
      rocket.position.copy(top).lerp(climb, easeIn((t - 1) / 1.2))
    } else {
      const k = Math.min(1, (t - 2.2) / 2.6)
      const a = climb.clone().lerp(p1, k)
      const b = p1.clone().lerp(this.moonSpot, k)
      rocket.position.copy(a.lerp(b, k))
    }
    const direction = rocket.position.clone().sub(previous)
    if (t > 2.2 && direction.lengthSq() > 1e-6) {
      rocket.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), 0.2)
    }

    // Rauch aus dem Schornstein und hinter der Rakete
    if (t > 0.5 && Math.random() < 0.8) {
      const puff = this.puffs.find((p) => p.life <= 0)
      if (puff) {
        puff.life = 1.4
        puff.mesh.visible = true
        puff.mesh.position.copy(rocket.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.2, (Math.random() - 0.5) * 0.2))
      }
    }
    for (const puff of this.puffs) {
      if (puff.life <= 0) continue
      puff.life -= dt
      const k = 1 - puff.life / 1.4
      puff.mesh.scale.setScalar(0.6 + k * 2.4)
      ;(puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k)
      if (puff.life <= 0) puff.mesh.visible = false
    }

    // Die Kamera schaut der Rakete hinterher.
    const look = new THREE.Vector3(0, 4.6, 0).lerp(rocket.position, Math.min(1, Math.max(0, (t - 0.6) / 1.4)))
    this.lookAt.lerp(look, 1 - Math.exp(-dt * 5))
    this.camera.position.lerp(new THREE.Vector3(2.5, 4.2 + Math.min(4, Math.max(0, t - 1) * 1.2), 15), 1 - Math.exp(-dt * 2))

    if (t > 5.3 && !this.flashed) {
      this.flashed = true
      this.callbacks.onFlash()
    }
    if (t > 5.7) this.landOnMoon()
  }

  private updateMoon(dt: number): void {
    this.earth.rotation.y += dt * 0.05
    const follow = 1 - Math.exp(-dt * 4)

    if (this.stage === 'rolling' && this.ball) {
      const speed = 1 - Math.exp(-dt * 6)
      this.velocity.x += (this.drive.x * MAX_SPEED - this.velocity.x) * speed
      this.velocity.z += (this.drive.z * MAX_SPEED - this.velocity.z) * speed
      const target = TARGET_RADII[this.ballIndex]
      const obstacle = this.stacked > 0 ? { point: this.base, radius: TARGET_RADII[0] } : null
      const next = keepInside(
        { x: this.position.x + this.velocity.x * dt, z: this.position.z + this.velocity.z * dt },
        this.radius,
        obstacle,
      )
      this.roll(next)
      this.radius = grow(this.radius, rollStep(this.field, this.position, next, this.radius), target)
      this.stampTrail(this.position, next, this.radius)
      this.position = next
      this.updateBall()
      this.reportSize(target)
      if (this.radius >= target - 1e-6) this.ballDone()
      this.followBall(follow)
    } else if (this.stage === 'moving' && this.ball) {
      const goal = this.path[0]
      const dx = goal.x - this.position.x
      const dz = goal.z - this.position.z
      const distance = Math.hypot(dx, dz)
      const step = Math.min(distance, 3.2 * dt)
      const next = distance > 0 ? { x: this.position.x + (dx / distance) * step, z: this.position.z + (dz / distance) * step } : goal
      this.roll(next)
      this.position = next
      this.updateBall()
      if (distance <= step + 1e-4) {
        this.path.shift()
        if (this.path.length === 0) this.setStage('aiming')
      }
      this.aimCamera(follow)
    } else if (this.stage === 'aiming' || this.stage === 'flying') {
      this.aimCamera(follow)
    } else if (this.stage === 'decorate' || this.stage === 'done') {
      if (this.stage === 'done') this.orbit += dt * 0.25
      const radius = 6.4
      const target = new THREE.Vector3(this.base.x + Math.sin(this.orbit) * radius, 2.6, this.base.z + Math.cos(this.orbit) * radius)
      this.camera.position.lerp(target, follow)
      this.lookAt.lerp(new THREE.Vector3(this.base.x, 2.2, this.base.z), follow)
    }

    // Nur ein paar Mal pro Sekunde neu hochladen – das Hochladen ist der teuerste Teil.
    if (this.surfaceDirty && this.time.value - this.lastUpload > 1 / SURFACE_HZ) {
      this.surfaceDirty = false
      this.lastUpload = this.time.value
      this.uploadSurface()
    }
  }

  /** Dreht die Kugel passend zur zurückgelegten Strecke. */
  private roll(next: Point): void {
    if (!this.ball) return
    const dx = next.x - this.position.x
    const dz = next.z - this.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 1e-6) return
    const axis = new THREE.Vector3(dz, 0, -dx).normalize()
    this.ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, distance / this.radius))
  }

  private updateBall(): void {
    if (!this.ball) return
    this.ball.scale.setScalar(this.radius)
    this.ball.position.set(this.position.x, this.radius, this.position.z)
    this.shadow.scale.setScalar(this.radius * 1.05)
    this.shadow.position.set(this.position.x - this.radius * 0.25, 0.01, this.position.z - this.radius * 0.2)
  }

  private reportSize(target: number): void {
    const progress = Math.round(sizeProgress(this.radius, target) * 100) / 100
    if (progress === this.sizeReported) return
    this.sizeReported = progress
    this.callbacks.onSize(progress)
  }

  /** Welt (x, z) → Leinwand-Pixel. Leinwandzeile 0 liegt hinten (−z), wie die Textur auf dem Boden. */
  private toSurface(point: Point): [number, number] {
    return [(point.x + FIELD.half) * PX_PER_M, (point.z + FIELD.half) * PX_PER_M]
  }

  /** Frische Staubdecke: weiche Buckel, feine Körnung und flacher Auslauf zum Kraterrand. */
  private paintFreshDust(): void {
    const ctx = this.surfaceContext
    const gray = (v: number, a = 1) => `rgba(${v}, ${v}, ${v}, ${a})`
    ctx.fillStyle = gray(SHADE.bare)
    ctx.fillRect(0, 0, SURFACE_PX, SURFACE_PX)
    const [cx, cy] = this.toSurface({ x: 0, z: 0 })
    const rim = (PLAY_RADIUS + 0.8) * PX_PER_M
    const deck = ctx.createRadialGradient(cx, cy, rim - 1.2 * PX_PER_M, cx, cy, rim)
    deck.addColorStop(0, gray(SHADE.fresh))
    deck.addColorStop(1, gray(SHADE.bare))
    ctx.fillStyle = deck
    ctx.beginPath()
    ctx.arc(cx, cy, rim, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, rim - 1.2 * PX_PER_M, 0, Math.PI * 2)
    ctx.clip()
    // Sanfte Dünen
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * SURFACE_PX
      const y = Math.random() * SURFACE_PX
      const r = (0.4 + Math.random() * 1.6) * PX_PER_M
      const lift = Math.random() < 0.5 ? 255 : 150
      const blob = ctx.createRadialGradient(x, y, 0, x, y, r)
      blob.addColorStop(0, gray(lift, 0.12))
      blob.addColorStop(1, gray(lift, 0))
      ctx.fillStyle = blob
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // Feine Körnung – gibt dem Staub im Streiflicht Struktur.
    for (let i = 0; i < 12000; i++) {
      const v = Math.random() < 0.5 ? 240 : 170
      ctx.fillStyle = gray(v, 0.18)
      const size = 1 + Math.random() * 2
      ctx.fillRect(Math.random() * SURFACE_PX, Math.random() * SURFACE_PX, size, size)
    }
    // Ein paar kleine Krater im Staub
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.random() * (PLAY_RADIUS - 2)
      const [x, y] = this.toSurface({ x: Math.cos(a) * d, z: Math.sin(a) * d })
      const r = (0.25 + Math.random() * 0.5) * PX_PER_M
      // Weiche Mulde mit leicht erhöhtem Rand
      const bowl = ctx.createRadialGradient(x, y, 0, x, y, r * 1.35)
      bowl.addColorStop(0, gray(SHADE.fresh - 36, 0.8))
      bowl.addColorStop(0.62, gray(SHADE.fresh - 10, 0.5))
      bowl.addColorStop(0.78, gray(SHADE.rim, 0.55))
      bowl.addColorStop(1, gray(SHADE.fresh, 0))
      ctx.fillStyle = bowl
      ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8)
    }
    ctx.restore()
    this.uploadSurface()
  }

  private uploads = 0

  private uploadSurface(): void {
    this.surfaceTexture.needsUpdate = true
    // Die Höhe braucht weniger Takt und keine Weichzeichnung: Gröber als das Gitter verkleinert, bleiben die Kanten ohne Treppen.
    if (this.uploads++ % RELIEF_EVERY === 0) {
      const relief = this.relief.getContext('2d')!
      relief.imageSmoothingQuality = 'medium'
      relief.drawImage(this.surface, 0, 0, RELIEF_PX, RELIEF_PX)
      this.reliefTexture.needsUpdate = true
    }
  }

  /** Malt die Rinne, die die Kugel gerade gezogen hat – mit aufgeschobenem Staubwall am Rand. */
  private stampTrail(from: Point, to: Point, radius: number): void {
    if (from.x === to.x && from.z === to.z) return
    const ctx = this.surfaceContext
    const gray = (v: number) => `rgb(${v}, ${v}, ${v})`
    const stroke = (track: { from: Point; to: Point; radius: number }, scale: number, shade: number) => {
      const [x0, y0] = this.toSurface(track.from)
      const [x1, y1] = this.toSurface(track.to)
      const width = trackHalfWidth(track.radius) * 2 * PX_PER_M
      ctx.lineWidth = width * scale
      ctx.strokeStyle = gray(shade)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    const track = { from, to, radius }
    this.recentTracks.push(track)
    // So weit nach hinten reicht der runde Wall des neuen Stücks (plus Weichzeichnung).
    const reach = trackHalfWidth(radius) * 1.3 + 0.05
    let length = 0
    let keep = this.recentTracks.length
    while (keep > 1 && length < reach) {
      const t = this.recentTracks[--keep]
      length += Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z)
    }
    this.recentTracks = this.recentTracks.slice(Math.max(0, keep - 1)).slice(-80)
    const dug = this.recentTracks
    ctx.save()
    ctx.lineCap = 'round'
    // Nur deckende Farben mit „aufhellen“/„abdunkeln“: Mehrfaches Überrollen ergibt so
    // keine Streifen. Der neue Wall reicht ein Stück nach hinten in die frische Rinne –
    // die wird deshalb über diese Strecke nachgegraben.
    ctx.globalCompositeOperation = 'lighten'
    stroke(track, 1.3, SHADE.rim)
    ctx.globalCompositeOperation = 'darken'
    for (const t of dug) stroke(t, 0.95, SHADE.bare + 30)
    for (const t of dug) stroke(t, 0.7, SHADE.bare)
    ctx.restore()
    this.surfaceDirty = true
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
