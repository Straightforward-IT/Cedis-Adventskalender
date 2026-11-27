import * as THREE from 'three'
import { createNightStreet, disposeScene } from './nightStreet.ts'

/** `fade`: kurz abblenden (Schnitt), `unfade`: wieder aufblenden, `done`: fertig. */
export type BalconyCue = 'fade' | 'unfade' | 'done'

const HOUSE_DAY = 12

/** Zeitplan (Sekunden). */
const STEP_END = 1.5
const LOOK_END = 3.3
const FADE_AT = 3.25
const CUT_AT = 3.75
const UNFADE_AT = 3.8
const DONE_AT = 6.6

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const phase = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)))

export interface BalconyCallbacks {
  onCue(cue: BalconyCue): void
}

/**
 * Der Abspann: durch die offene Balkontür hinaus, an das Geländer, ein Blick die
 * verschneite Straße entlang – Schnitt – und zum Schluss ein letzter Blick von der
 * anderen Straßenseite hinauf zum Balkon von Haus 12.
 */
export class BalconyScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.05, 500)
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: BalconyCallbacks
  private readonly observer: ResizeObserver
  private readonly time = { value: 0 }
  private readonly balcony: THREE.Vector3
  private readonly look = new THREE.Vector3()
  private clock = 0
  private readonly cues = new Set<BalconyCue>()
  private frame = 0
  private last = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, callbacks: BalconyCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    const { scene, home } = createNightStreet(HOUSE_DAY, this.time)
    this.scene = scene
    this.balcony = (home.balcony ?? new THREE.Vector3(1, 3.3, 0.47)).clone()

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.update(0)
    this.frame = requestAnimationFrame(this.tick)
    if (import.meta.env.DEV) Object.assign(window, { __balcony: this })
  }

  /** Springt ans Ende – zum Blick von der Straße. */
  skip(): void {
    this.clock = DONE_AT
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
    // Weiterzeichnen, auch wenn der Abspann vorbei ist – der Schnee fällt, die Lichter funkeln.
    this.frame = requestAnimationFrame(this.tick)
  }

  private cue(cue: BalconyCue): void {
    if (this.cues.has(cue)) return
    this.cues.add(cue)
    this.callbacks.onCue(cue)
  }

  private update(dt: number): void {
    this.clock += dt
    this.time.value += dt
    const t = this.clock
    const b = this.balcony
    const eye = b.y + 1.2
    const camera = this.camera.position

    if (t < CUT_AT) {
      // Aus der Tür hinaus bis ans Geländer, den Blick auf die Straße gesenkt …
      const step = easeInOut(phase(t, 0, STEP_END))
      camera.set(b.x, eye, THREE.MathUtils.lerp(0.14, b.z - 0.08, step))
      const ahead = new THREE.Vector3(b.x, THREE.MathUtils.lerp(eye - 0.3, 1.0, step), THREE.MathUtils.lerp(10, 9, step))
      // … dann die Straße entlang schauen: erst nach links, dann nach rechts, zurück zur Mitte.
      // Mit Blick nach +z liegt links bei +x.
      const sweep = easeInOut(phase(t, STEP_END, LOOK_END))
      ahead.x = b.x + 11 * Math.sin(sweep * Math.PI * 2)
      this.look.copy(ahead)
    } else {
      // Nach dem Schnitt: von gegenüber hinauf zum Balkon, langsam zurückweichend.
      const k = easeInOut(phase(t, CUT_AT, DONE_AT))
      camera.set(THREE.MathUtils.lerp(b.x + 2.6, b.x + 3.4, k), THREE.MathUtils.lerp(1.9, 2.4, k), THREE.MathUtils.lerp(12.2, 16.5, k))
      this.look.set(b.x - 0.2, THREE.MathUtils.lerp(b.y + 0.9, b.y + 0.4, k), b.z)
    }
    this.camera.lookAt(this.look)

    if (t >= FADE_AT) this.cue('fade')
    if (t >= UNFADE_AT) this.cue('unfade')
    if (t >= DONE_AT) this.cue('done')
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
