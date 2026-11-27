import * as THREE from 'three'
import { createNightStreet, disposeScene } from './nightStreet.ts'

export type ChimneyCue = 'dark' | 'done'

const HOUSE_DAY = 12

/** Zeitplan des Vorspanns (Sekunden). */
const HOLD = 1.1
const RISE_END = 3.3
const OVER_END = 4.5
const DIVE_END = 5.3
/** Ab hier wird es im Schornstein dunkel – die Oberfläche blendet ab. */
const DARK_AT = 4.75

const START = new THREE.Vector3(0, 2.8, 15)
const START_LOOK = new THREE.Vector3(0, 4.2, 0)

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const easeIn = (t: number) => t * t * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const phase = (t: number, from: number, to: number) => clamp01((t - from) / (to - from))

export interface ChimneyCallbacks {
  onCue(cue: ChimneyCue): void
}

/**
 * Der Vorspann: vor Haus 12 auf der Straße, dann hinauf zum Schornstein, hinüber und
 * kopfüber hinein. Wenn es dunkel wird, übernimmt das Wohnzimmer.
 */
export class ChimneyScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.05, 500)
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: ChimneyCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly chimney: THREE.Vector3
  private readonly puffs: { mesh: THREE.Mesh; phase: number }[] = []
  private readonly look = new THREE.Vector3()
  private readonly from = new THREE.Vector3()
  private readonly to = new THREE.Vector3()
  private clock = 0
  private readonly cues = new Set<ChimneyCue>()
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, callbacks: ChimneyCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))

    const { scene, home } = createNightStreet(HOUSE_DAY, this.time)
    this.scene = scene
    // Der Schornstein von Haus 12 – Haus 12 steht im Ursprung.
    this.chimney = (home.smoke ?? new THREE.Vector3(0.7, home.height, -2)).clone()

    // Die Öffnung: ein rußschwarzer Schacht, in den man hineinfällt (innen sichtbar).
    const soot = new THREE.MeshBasicMaterial({ color: '#141010', side: THREE.BackSide, fog: false })
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), soot)
    shaft.position.set(this.chimney.x, this.chimney.y - 0.09 - 2, this.chimney.z)
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ color: '#1a1412', fog: false }))
    hole.rotation.x = -Math.PI / 2
    hole.position.set(this.chimney.x, this.chimney.y - 0.085, this.chimney.z)
    scene.add(shaft, hole)

    // Ein paar Rauchwölkchen steigen auf – man fliegt mitten hindurch.
    const smoke = new THREE.MeshBasicMaterial({ color: '#e9ecf6', transparent: true, opacity: 0.5, depthWrite: false })
    const puffGeometry = new THREE.SphereGeometry(0.28, 10, 8)
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(puffGeometry, smoke.clone())
      this.puffs.push({ mesh, phase: i / 7 })
      scene.add(mesh)
    }

    this.camera.position.copy(START)
    this.look.copy(START_LOOK)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.update(0)
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __chimney: this })
  }

  /** Springt ans Ende des Vorspanns. */
  skip(): void {
    this.clock = DIVE_END
    this.update(0)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    disposeScene(this.scene)
    this.renderer.dispose()
  }

  private readonly tick = (now: number): void => {
    if (this.disposed) return
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60
    this.last = now
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    if (this.clock < DIVE_END + 0.3) this.frame = requestAnimationFrame(this.tick)
  }

  private cue(cue: ChimneyCue): void {
    if (this.cues.has(cue)) return
    this.cues.add(cue)
    this.callbacks.onCue(cue)
  }

  private update(dt: number): void {
    this.clock += dt
    this.time.value += dt
    const t = this.clock
    const c = this.chimney

    // Stationen der Kamerafahrt: Straße → schräg über dem Dach → senkrecht über der Öffnung → hinein.
    const above = new THREE.Vector3(c.x + 0.3, c.y + 2.0, c.z + 2.6)
    const overTop = new THREE.Vector3(c.x, c.y + 0.9, c.z + 0.01)
    const inside = new THREE.Vector3(c.x, c.y - 1.8, c.z + 0.01)
    const camera = this.camera.position
    if (t < RISE_END) {
      const k = easeInOut(phase(t, HOLD, RISE_END))
      camera.lerpVectors(START, above, k)
      this.from.copy(START_LOOK)
      this.to.copy(c)
      this.look.lerpVectors(this.from, this.to, k)
    } else if (t < OVER_END) {
      const k = easeInOut(phase(t, RISE_END, OVER_END))
      camera.lerpVectors(above, overTop, k)
      // Der Blick kippt nach unten, bis man senkrecht in die Öffnung schaut.
      this.look.lerpVectors(c, new THREE.Vector3(c.x, c.y - 6, c.z), k)
    } else {
      const k = easeIn(phase(t, OVER_END, DIVE_END))
      camera.lerpVectors(overTop, inside, k)
      this.look.set(c.x, c.y - 6, c.z)
    }
    // Beim Blick senkrecht nach unten braucht lookAt eine eindeutige Oben-Richtung.
    this.camera.up.set(0, 1, 0)
    if (t >= RISE_END) this.camera.up.set(0, 0, -1).lerp(new THREE.Vector3(0, 1, 0), 1 - phase(t, RISE_END, OVER_END)).normalize()
    this.camera.lookAt(this.look)

    for (const puff of this.puffs) {
      const life = (this.time.value * 0.35 + puff.phase) % 1
      puff.mesh.position.set(c.x + Math.sin(life * 6 + puff.phase * 9) * 0.25, c.y + life * 4, c.z + life * 0.6)
      puff.mesh.scale.setScalar(0.6 + life * 2.4)
      // Kurz bevor man über der Öffnung schwebt, verzieht sich der Rauch.
      const clear = 1 - phase(t, RISE_END - 0.8, RISE_END + 0.2)
      ;(puff.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - life) * 0.45 * clear
    }

    if (t >= DARK_AT) this.cue('dark')
    if (t >= DIVE_END) this.cue('done')
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
