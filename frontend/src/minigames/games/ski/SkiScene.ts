import * as THREE from 'three'
import { createSnowfall } from '../../../scene/particles.ts'
import { createSkier } from '../../../scene/skier.ts'
import { createSky } from '../../../scene/sky.ts'
import { buildSkiWorld } from './courseArt.ts'
import {
  COURSE, FINISH_RUNOUT, GRADE, RAMP_HEIGHT, RAMP_LENGTH, advanceRun, createRun, duckAmount, laneX, motionFraction,
  rampFraction, skiHeight, slopeHeight, spinFraction, trigger,
} from './model.ts'
import type { CourseFeature, RunEvent, SkiAction, SkiProgress } from './model.ts'

export type SkiStage = 'intro' | 'ready' | 'running' | 'paused' | 'finished'

export interface SkiMeter {
  distance: number
  styleJumps: number
  cue: CourseFeature | 'spin' | null
}

interface SkiCallbacks {
  onStage(stage: SkiStage): void
  onMeter(meter: SkiMeter): void
  onEvent(event: RunEvent): void
  onSave(progress: SkiProgress): void
}

const INTRO_SECONDS = 5.15
const RUNOUT_SECONDS = 7.6
const SHADOW_RADIUS = 0.45
const START_FACING = 2.91

function createSpray() {
  const particles = Array.from({ length: 92 }, () => ({ x: 0, y: 0, z: 0, life: 0, vx: 0, vy: 0 }))
  const positions = new Float32Array(particles.length * 3)
  positions.fill(-1000)
  const geometry = new THREE.BufferGeometry()
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#f9f7ff', size: 0.085,
    transparent: true, depthWrite: false, opacity: 0.67 }))
  points.frustumCulled = false
  let cursor = 0

  return {
    points,
    emit(x: number, y: number, z: number, amount: number) {
      for (let index = 0; index < amount; index++) {
        const particle = particles[cursor]
        const side = cursor % 2 ? 1 : -1
        cursor = (cursor + 1) % particles.length
        particle.x = x + side * (0.19 + Math.random() * 0.14)
        particle.y = y + 0.075
        particle.z = z + 0.47 + Math.random() * 0.40
        particle.life = 0.24 + Math.random() * 0.24
        particle.vx = side * (0.32 + Math.random() * 1.35)
        particle.vy = 0.65 + Math.random() * 1.8
      }
    },
    update(dt: number) {
      particles.forEach((particle, index) => {
        if (particle.life > 0) {
          particle.life -= dt
          particle.x += particle.vx * dt
          particle.y += particle.vy * dt
          particle.z += dt * 0.7
          particle.vy -= dt * 7.2
        }
        attribute.setXYZ(index, particle.x, particle.life > 0 ? particle.y : -1000, particle.z)
      })
      attribute.needsUpdate = true
    },
  }
}

export class SkiScene {
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(51, 1, 0.14, 360)
  private readonly lookAt = new THREE.Vector3()
  private readonly landingPosition = new THREE.Vector3()
  private readonly landingLook = new THREE.Vector3()
  private readonly time = { value: 0 }
  private readonly world: ReturnType<typeof buildSkiWorld>
  private readonly sky: ReturnType<typeof createSky>
  private readonly snowfall: ReturnType<typeof createSnowfall>
  private readonly skier: ReturnType<typeof createSkier>
  private readonly spray = createSpray()
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  private readonly flight: THREE.CatmullRomCurve3
  private readonly run: ReturnType<typeof createRun>
  private readonly observer: ResizeObserver
  private readonly callbacks: SkiCallbacks
  private readonly ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  private stage: SkiStage
  private frame = 0
  private last = 0
  private introTime = 0
  private runoutTime = 0
  private sprayTime = 0
  private facing = START_FACING
  private followX = 0
  private followY = 0
  private carve = 0
  private rampTilt = 0
  private cameraReady = 1
  private back = 6.7
  private height = 1
  private meter: SkiMeter | undefined
  private disposed = false

  constructor(canvas: HTMLCanvasElement, day: number, progress: SkiProgress, moonPhase: number, callbacks: SkiCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.ratio)
    this.world = buildSkiWorld(day, this.time)
    this.run = createRun(progress)
    this.sky = createSky(this.time)
    this.sky.setPixelRatio(this.ratio)
    this.sky.setMoonPhase(moonPhase)
    this.snowfall = createSnowfall(this.time, 820)
    this.snowfall.setAmount(0.22)
    this.skier = createSkier(this.world.material)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(SHADOW_RADIUS, 24),
      new THREE.MeshBasicMaterial({ color: '#4f6e98', transparent: true, opacity: 0.23, depthWrite: false }))
    this.shadow.rotation.x = -Math.PI / 2
    this.world.scene.add(this.sky.group, this.snowfall.points, this.shadow, this.skier.group, this.spray.points)

    const { roof, depth, startZ } = this.world
    this.flight = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.5, 3.45, 16.7),
      new THREE.Vector3(1.3, 4.2, 13.5),
      new THREE.Vector3(2.4, roof + 1.45, 5.5),
      new THREE.Vector3(2.1, roof + 2.9, -depth * 0.59),
      new THREE.Vector3(2.85, 6.45, startZ + 6.9),
      new THREE.Vector3(1.84, 4.15, startZ + 6.75),
    ])
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.stage = progress.finished ? 'finished' : progress.checkpoint > 0 || reducedMotion ? 'ready' : 'intro'
    if (progress.finished) {
      this.runoutTime = RUNOUT_SECONDS
      this.cameraReady = 0
    }
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(canvas)
    document.addEventListener('visibilitychange', this.visibilityChanged)
    this.resize()
    this.positionCamera(0)
    this.frame = requestAnimationFrame(this.tick)
    queueMicrotask(() => {
      if (this.disposed) return
      this.callbacks.onStage(this.stage)
      this.reportMeter()
    })
  }

  skipIntro(): void {
    if (this.stage === 'intro') this.setStage('ready')
  }

  start(): void {
    if (this.stage === 'ready' || this.stage === 'paused') this.setStage('running')
  }

  pause(): void {
    if (this.stage === 'running') this.setStage('paused')
  }

  act(action: SkiAction): void {
    if (this.stage === 'running') trigger(this.run, action)
  }

  private visibilityChanged = () => {
    if (document.hidden) this.pause()
  }

  private setStage(stage: SkiStage): void {
    this.stage = stage
    this.callbacks.onStage(stage)
  }

  private reportMeter(): void {
    const { distance, styleJumps, motion, nextFeature } = this.run
    const next = COURSE[nextFeature]
    let cue: SkiMeter['cue'] = null
    if (motion?.kind === 'ramp' && motion.spinAt === null && motion.time < 0.72) cue = 'spin'
    else if (next && next.distance - distance < 17) cue = next

    const meters = Math.floor(distance)
    if (this.meter?.distance === meters && this.meter.styleJumps === styleJumps && this.meter.cue === cue) return
    this.meter = { distance: meters, styleJumps, cue }
    this.callbacks.onMeter(this.meter)
  }

  private updateRun(dt: number): void {
    const previous = this.run.checkpoint
    const event = advanceRun(this.run, dt)
    if (event) {
      this.callbacks.onEvent(event)
      this.spray.emit(this.run.x, slopeHeight(this.run.distance), this.world.startZ - this.run.distance, event === 'bump' ? 26 : 18)
    }
    if (previous !== this.run.checkpoint || this.run.finished) {
      const { checkpoint, styleJumps, finished } = this.run
      this.callbacks.onSave({ checkpoint, styleJumps, finished })
    }
    this.reportMeter()
  }

  private updateRunout(dt: number): void {
    this.runoutTime = Math.min(RUNOUT_SECONDS, this.runoutTime + dt)
    if (this.run.motion) {
      this.run.motion.time += dt
      if (motionFraction(this.run) >= 1) this.run.motion = null
    }
  }

  private tick = (now: number) => {
    if (this.disposed) return
    const elapsed = this.last > 0 ? Math.min(0.12, (now - this.last) / 1000) : 1 / 60
    const dt = Math.min(elapsed, 0.052)
    this.last = now
    this.time.value += elapsed
    if (this.stage === 'intro') {
      this.introTime += elapsed
      if (this.introTime >= INTRO_SECONDS) this.skipIntro()
    } else if (this.stage === 'running') {
      this.updateRun(dt)
    } else if (this.stage === 'finished') {
      this.updateRunout(dt)
    }

    this.positionSkier(dt)
    // Hold the last chase-camera pose as the skier rides out beyond the finish.
    if (this.stage !== 'finished') this.positionCamera(dt)
    if (this.stage === 'running' && this.run.finished) this.setStage('finished')
    this.spray.update(dt)
    this.sky.follow(this.camera, this.time.value)
    const pixelsPerUnit = this.height * this.ratio / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
    this.snowfall.update(this.camera, pixelsPerUnit, this.ratio)
    this.renderer.render(this.world.scene, this.camera)
    this.frame = requestAnimationFrame(this.tick)
  }

  private positionSkier(dt: number): void {
    if (this.runoutTime >= RUNOUT_SECONDS) {
      this.skier.group.visible = false
      this.shadow.visible = false
      return
    }

    const finishing = this.stage === 'finished'
    const runout = this.runoutTime / RUNOUT_SECONDS
    const distance = this.run.distance + FINISH_RUNOUT * runout * (0.71 + 0.29 * runout)
    const x = this.run.x * (1 - THREE.MathUtils.smoothstep(this.runoutTime, 0, 1.65))
    const { lane, motion, recovery } = this.run
    const z = this.world.startZ - distance
    const y = slopeHeight(distance)
    const air = skiHeight(this.run)
    const fraction = motionFraction(this.run)
    const lift = Math.sin(Math.PI * fraction)
    const style = motion?.kind === 'ramp' ? lift : 0
    const skiing = this.stage === 'running' || this.stage === 'paused' || finishing
    const targetX = finishing ? 0 : laneX(lane)
    const desiredCarve = THREE.MathUtils.clamp((targetX - x) * 0.98, -1, 1)
    this.carve = THREE.MathUtils.damp(this.carve, desiredCarve, 9, dt)
    const facing = skiing ? 0 : START_FACING
    this.facing = THREE.MathUtils.damp(this.facing, facing, 8.5, dt)
    const pitchScale = motion?.kind === 'ramp' ? Math.max(0, 1 - fraction * 2.5) : motion?.kind === 'hop' ? 0 : rampFraction(this.run)
    this.rampTilt = THREE.MathUtils.damp(this.rampTilt, Math.atan(2 * RAMP_HEIGHT * pitchScale / RAMP_LENGTH), 14, dt)
    this.skier.group.position.set(x, y + air, z)
    this.skier.group.rotation.x = -GRADE + this.rampTilt + Math.sin(recovery * 22) * recovery * 0.16
    this.skier.pose({
      duck: duckAmount(this.run), jump: motion?.kind === 'duck' ? 0 : lift, style, spin: spinFraction(this.run),
      carve: this.carve, facing: this.facing, time: this.time.value,
    })
    this.shadow.position.set(x, y + 0.052, z + 0.082)
    this.shadow.scale.set(1 + air * 0.25, 1.83 + air * 0.34, 1)
    this.shadow.material.opacity = 0.28 / (1 + air * 0.62)
    if ((this.stage === 'running' || finishing) && air < 0.2) {
      this.sprayTime += dt
      if (this.sprayTime > 0.029) {
        this.spray.emit(x, y, z, Math.abs(this.carve) > 0.25 ? 5 : 2)
        this.sprayTime = 0
      }
    }
  }

  private positionCamera(dt: number): void {
    const { distance, x } = this.run
    const air = skiHeight(this.run)
    this.followX = THREE.MathUtils.damp(this.followX, x, 7, dt)
    this.followY = THREE.MathUtils.damp(this.followY, air, 5, dt)
    const z = this.world.startZ - distance
    const y = slopeHeight(distance)
    const ready = this.stage === 'intro' || this.stage === 'ready'
    this.cameraReady = THREE.MathUtils.damp(this.cameraReady, ready ? 1 : 0, 5, dt)
    this.landingPosition.set(this.followX * 0.5 + 0.33 + this.cameraReady * 0.92, y + 3.38 + this.followY * 0.34, z + this.back)
    this.landingLook.set(this.followX * 0.34, slopeHeight(distance + 5.2) + 1.10 - this.cameraReady * 2.38 + this.followY * 0.24, z - 5.2)
    if (this.stage === 'intro') {
      const fraction = this.introTime / INTRO_SECONDS
      const k = fraction * fraction * (3 - 2 * fraction)
      this.flight.getPoint(k, this.camera.position)
      this.camera.position.z += (this.back - 6.7) * (1 - THREE.MathUtils.smoothstep(k, 0.05, 0.42))
      this.camera.position.lerp(this.landingPosition, THREE.MathUtils.smoothstep(k, 0.77, 1))
      this.lookAt.set(0, 3.74 + 1.1 * k, -0.61 - this.world.depth * k * 0.24)
      this.lookAt.lerp(this.landingLook, THREE.MathUtils.smoothstep(k, 0.40, 0.87))
    } else {
      this.camera.position.copy(this.landingPosition)
      this.lookAt.copy(this.landingLook)
    }
    this.camera.lookAt(this.lookAt)
  }

  private resize = () => {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width <= 0 || height <= 0) return
    this.height = height
    const aspect = width / height
    this.back = 6.7 + Math.max(0, 0.87 - aspect) * 5.7
    this.camera.aspect = aspect
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(0.47 / aspect)), 47, 68)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    document.removeEventListener('visibilitychange', this.visibilityChanged)
    this.sky.group.removeFromParent()
    this.snowfall.points.removeFromParent()
    this.sky.dispose()
    this.snowfall.dispose()

    const resources = new Set<{ dispose(): void }>()
    this.world.scene.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) resources.add(object)
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return
      resources.add(object.geometry)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        resources.add(material)
        if (material.map instanceof THREE.Texture) resources.add(material.map)
      }
    })
    for (const resource of resources) resource.dispose()
    this.renderer.dispose()
  }
}
