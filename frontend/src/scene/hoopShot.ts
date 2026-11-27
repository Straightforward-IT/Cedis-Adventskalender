import * as THREE from 'three'
import { isDevPreview } from '../lib/devPreview.ts'
import { createRandom, hashSeed } from '../lib/rng.ts'
import { GARAGE, HOOP } from './garage.ts'

/**
 * Easter Egg nach „Weihnachtskugelball“ (Haus 14): Wer auf der Straße den Korb über der Garage
 * antippt, wirft eine Christbaumkugel hindurch. Unten zerspringt sie – und die Scherben bleiben
 * für immer in der Einfahrt liegen. Sie werden auf dem Gerät gemerkt und beim nächsten Besuch
 * an genau denselben Stellen wieder hingelegt.
 */

const STORAGE_KEY = 'weihnachtsstrasse:kugelscherben'
const COLORS = ['#d23a3a', '#e8b33a', '#2f7fd1', '#2f9a5c', '#c9ccd8', '#b54bb0']
const SHARDS_PER_BALL = 16
/** Höchstens so viele Würfe liegen herum – danach ersetzen neue Scherben die ältesten. */
const MAX_THROWS = 150
const BALL_RADIUS = 0.085
const GRAVITY = 9.81

/** Scherbe i von Wurf n: Wo sie liegen bleibt (relativ zur Garagenmitte) und wie sie gedreht ist. */
function restingShard(throwIndex: number, shard: number): { x: number; z: number; turn: THREE.Euler; size: number } {
  const rnd = createRandom(hashSeed('kugelscherbe', throwIndex, shard))
  const angle = rnd.range(0, Math.PI * 2)
  const radius = 0.08 + rnd.next() ** 0.7 * 1.1
  const x = HOOP.x + Math.cos(angle) * radius
  // Nicht in die Garagenwand hinein
  const z = Math.max(GARAGE.front + 0.06, HOOP.z + Math.sin(angle) * radius * 0.9)
  return {
    x,
    z,
    turn: new THREE.Euler(rnd.range(0, Math.PI), rnd.range(0, Math.PI * 2), rnd.range(0, Math.PI)),
    size: rnd.range(0.6, 1.4),
  }
}

function loadCount(): number {
  if (isDevPreview()) return 0
  try {
    const value = Number(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 0)
    return Number.isInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function saveCount(count: number): void {
  // In der Dev-Vorschau bleibt nichts auf dem Gerät hängen.
  if (isDevPreview()) return
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(count))
  } catch {
    // Ohne Speicher liegen die Scherben eben nur bis zum Neuladen.
  }
}

interface Flying {
  mesh: THREE.Mesh
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
  duration: number
  slot: number
  rest: { x: number; z: number; turn: THREE.Euler; size: number }
}

export class HoopShot {
  readonly group = new THREE.Group()
  private readonly ballMaterials = COLORS.map(
    (color) => new THREE.MeshPhongMaterial({ color, shininess: 110, specular: '#ffffff', emissive: new THREE.Color(color).multiplyScalar(0.18) }),
  )
  private readonly capMaterial = new THREE.MeshPhongMaterial({ color: '#d9b45a', shininess: 80 })
  private readonly ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 20, 14)
  private readonly capGeometry = new THREE.CylinderGeometry(0.022, 0.026, 0.03, 10)
  private readonly shardGeometry = new THREE.TetrahedronGeometry(0.03)
  private readonly shardMaterial = new THREE.MeshPhongMaterial({ shininess: 90, specular: '#ffffff' })
  private readonly pile: THREE.InstancedMesh
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly flying: Flying[] = []
  private ball: { group: THREE.Group; position: THREE.Vector3; velocity: THREE.Vector3; scored: boolean; color: number } | null = null
  private count: number
  private readonly matrix = new THREE.Matrix4()

  /** `x`: Mitte der Garage auf der Straße (Weltkoordinaten). */
  constructor(x: number) {
    this.group.position.x = x
    this.pile = new THREE.InstancedMesh(this.shardGeometry, this.shardMaterial, SHARDS_PER_BALL * MAX_THROWS)
    this.pile.frustumCulled = false
    this.pile.count = 0
    this.group.add(this.pile)
    this.count = loadCount()
    // Die Scherben vergangener Würfe gleich wieder hinlegen
    for (let n = Math.max(0, this.count - MAX_THROWS); n < this.count; n++) {
      for (let i = 0; i < SHARDS_PER_BALL; i++) this.place(n, i, restingShard(n, i))
    }
  }

  /** Liegt der Finger auf Korb oder Brett? */
  hits(clientX: number, clientY: number, canvas: HTMLCanvasElement, camera: THREE.Camera): boolean {
    if (!this.group.visible) return false
    const rect = canvas.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, camera)
    const center = new THREE.Vector3(HOOP.x, HOOP.y + 0.15, (HOOP.z + 0.02) / 2).add(this.group.position)
    // Großzügig – auf dem Handy ist der Korb klein.
    return this.raycaster.ray.intersectsSphere(new THREE.Sphere(center, 0.85))
  }

  /** Wirft eine Kugel von der Kamera aus durch den Korb. Gibt false zurück, wenn gerade schon eine fliegt. */
  shoot(camera: THREE.Camera): boolean {
    if (this.ball || !this.group.visible) return false
    const start = camera.localToWorld(new THREE.Vector3(0.3, -0.5, -1.2)).sub(this.group.position)
    // Ziel: knapp über der Ringmitte, steil von oben hinein
    const target = new THREE.Vector3(HOOP.x, HOOP.y + 0.02, HOOP.z)
    const duration = THREE.MathUtils.clamp(start.distanceTo(target) / 8, 0.8, 1.7)
    const velocity = target.clone().sub(start).divideScalar(duration)
    velocity.y += 0.5 * GRAVITY * duration
    const color = this.count % COLORS.length
    const group = new THREE.Group()
    group.add(new THREE.Mesh(this.ballGeometry, this.ballMaterials[color]))
    const cap = new THREE.Mesh(this.capGeometry, this.capMaterial)
    cap.position.y = BALL_RADIUS + 0.005
    group.add(cap)
    group.position.copy(start)
    this.group.add(group)
    this.ball = { group, position: start, velocity, scored: false, color }
    return true
  }

  update(dt: number): void {
    const ball = this.ball
    if (ball) {
      const prevY = ball.position.y
      ball.velocity.y -= GRAVITY * dt
      ball.position.addScaledVector(ball.velocity, dt)
      // Durch den Ring: Das Netz bremst, die Kugel fällt senkrecht weiter.
      if (!ball.scored && prevY >= HOOP.y && ball.position.y < HOOP.y) {
        ball.scored = true
        ball.position.x = HOOP.x
        ball.position.z = HOOP.z
        ball.velocity.set(0, ball.velocity.y * 0.6, 0)
      }
      ball.group.position.copy(ball.position)
      ball.group.rotation.x -= dt * 6
      if (ball.position.y <= BALL_RADIUS) this.shatter(ball.position.clone(), ball.color)
    }

    for (const shard of [...this.flying]) {
      shard.t = Math.min(1, shard.t + dt / shard.duration)
      const k = shard.t
      shard.mesh.position.lerpVectors(shard.from, shard.to, k)
      shard.mesh.position.y += Math.sin(k * Math.PI) * (0.35 + shard.duration * 0.3) * (1 - k * 0.3)
      shard.mesh.rotation.x += dt * 12
      shard.mesh.rotation.z += dt * 9
      if (k < 1) continue
      // Liegen geblieben – ab jetzt für immer Teil des Scherbenhaufens.
      this.group.remove(shard.mesh)
      this.flying.splice(this.flying.indexOf(shard), 1)
      const throwIndex = Math.floor(shard.slot / SHARDS_PER_BALL)
      this.place(throwIndex, shard.slot % SHARDS_PER_BALL, shard.rest)
    }
  }

  dispose(): void {
    for (const material of [...this.ballMaterials, this.capMaterial, this.shardMaterial]) material.dispose()
    for (const geometry of [this.ballGeometry, this.capGeometry, this.shardGeometry]) geometry.dispose()
    this.pile.dispose()
    this.group.removeFromParent()
  }

  private shatter(at: THREE.Vector3, color: number): void {
    if (this.ball) this.group.remove(this.ball.group)
    this.ball = null
    const throwIndex = this.count++
    saveCount(this.count)
    for (let i = 0; i < SHARDS_PER_BALL; i++) {
      const rest = restingShard(throwIndex, i)
      const mesh = new THREE.Mesh(this.shardGeometry, this.ballMaterials[color])
      mesh.position.copy(at)
      this.group.add(mesh)
      const to = new THREE.Vector3(rest.x, 0.025, rest.z)
      this.flying.push({ mesh, from: at.clone().setY(0.05), to, t: 0, duration: 0.35 + to.distanceTo(at) * 0.35, slot: throwIndex * SHARDS_PER_BALL + i, rest })
    }
  }

  /** Legt Scherbe `shard` von Wurf `throwIndex` an ihren festen Platz im Haufen. */
  private place(throwIndex: number, shard: number, rest: { x: number; z: number; turn: THREE.Euler; size: number }): void {
    const slot = (throwIndex % MAX_THROWS) * SHARDS_PER_BALL + shard
    this.matrix.compose(
      new THREE.Vector3(rest.x, 0.025, rest.z),
      new THREE.Quaternion().setFromEuler(rest.turn),
      new THREE.Vector3(rest.size, rest.size * 0.45, rest.size),
    )
    this.pile.setMatrixAt(slot, this.matrix)
    this.pile.setColorAt(slot, new THREE.Color(COLORS[throwIndex % COLORS.length]))
    this.pile.count = Math.max(this.pile.count, slot + 1)
    this.pile.instanceMatrix.needsUpdate = true
    if (this.pile.instanceColor) this.pile.instanceColor.needsUpdate = true
  }
}
