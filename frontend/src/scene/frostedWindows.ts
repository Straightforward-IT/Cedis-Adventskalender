import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import type { WindowRect } from './houseBuilder.ts'

/**
 * Vereiste, zugeschneite Fenster für Haus 9 („Eingeschneit!“): Bis das Haus gelöst ist,
 * liegen Eisblumen und ein Schneehaufen auf jeder Scheibe. Erst danach sieht man hinein –
 * und der Wichtel lugt um die Ecke.
 */

const SIZE = 256

export interface FrostedWindows {
  group: THREE.Group
  dispose(): void
}

/** Eine Scheibe voller Eisblumen, unten zugeschneit; `arched` schneidet oben einen Bogen aus. */
function paintFrost(arched: boolean, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE * 1.4
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const rnd = createRandom(hashSeed('eisblumen', seed))

  ctx.save()
  if (arched) {
    // Nur innerhalb des Rundbogens malen
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, w / 2)
    ctx.arc(w / 2, w / 2, w / 2, Math.PI, 0)
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.clip()
  }

  // Milchiger Reif über der ganzen Scheibe, zur Mitte hin etwas durchsichtiger
  const frost = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.1, w / 2, h * 0.45, h * 0.75)
  frost.addColorStop(0, 'rgba(226, 238, 255, 0.72)')
  frost.addColorStop(1, 'rgba(240, 247, 255, 0.95)')
  ctx.fillStyle = frost
  ctx.fillRect(0, 0, w, h)

  // Eisblumen: verästelte Linien aus den Ecken und Rändern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineCap = 'round'
  const fern = (x: number, y: number, angle: number, length: number, depth: number) => {
    if (depth === 0 || length < 4) return
    const x2 = x + Math.cos(angle) * length
    const y2 = y + Math.sin(angle) * length
    ctx.lineWidth = Math.max(1, depth * 0.9)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    for (const t of [0.35, 0.6, 0.85]) {
      const bx = x + (x2 - x) * t
      const by = y + (y2 - y) * t
      fern(bx, by, angle + 0.7 + rnd.range(-0.15, 0.15), length * 0.38, depth - 1)
      fern(bx, by, angle - 0.7 + rnd.range(-0.15, 0.15), length * 0.38, depth - 1)
    }
  }
  // Jede Scheibe friert anders: Eisblumen wachsen von zufälligen Stellen am Rand aus,
  // unterschiedlich viele, lang und schräg.
  const edges: (() => [number, number, number])[] = [
    () => [0, rnd.range(0, h * 0.6), rnd.range(-0.5, 0.9)],
    () => [w, rnd.range(0, h * 0.6), Math.PI - rnd.range(-0.5, 0.9)],
    () => [rnd.range(0, w), 0, rnd.range(0.7, 2.4)],
  ]
  const count = rnd.int(3, 7)
  for (let i = 0; i < count; i++) {
    const [x, y, angle] = rnd.pick(edges)()
    fern(x, y, angle, w * rnd.range(0.22, 0.5), rnd.int(3, 4))
  }
  // Ein paar einzelne Eissterne mitten auf der Scheibe
  for (let i = rnd.int(0, 3); i > 0; i--) {
    const cx = rnd.range(w * 0.2, w * 0.8)
    const cy = rnd.range(h * 0.15, h * 0.45)
    for (let k = 0; k < 6; k++) fern(cx, cy, (k / 6) * Math.PI * 2 + rnd.range(0, 0.3), w * rnd.range(0.06, 0.11), 2)
  }

  // Schneehaufen: mal höher, mal niedriger, mal zur Seite geweht
  ctx.fillStyle = '#f7faff'
  ctx.beginPath()
  ctx.moveTo(0, h)
  const base = h * rnd.range(0.48, 0.74)
  const drift = rnd.range(-0.12, 0.12)
  const hump = rnd.range(0.03, 0.12)
  const ripple = rnd.range(0.01, 0.045)
  const phase = rnd.range(0, Math.PI * 2)
  const edgeY = (x: number) =>
    base - Math.sin((x / w) * Math.PI) * h * hump - (x / w - 0.5) * h * drift - Math.sin(x * 0.05 + phase) * h * ripple
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, edgeY(x))
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  // Schatten unter der Schneekante
  ctx.strokeStyle = 'rgba(170, 190, 225, 0.6)'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let x = 0; x <= w; x += 8) {
    if (x === 0) ctx.moveTo(x, edgeY(x) + 6)
    else ctx.lineTo(x, edgeY(x) + 6)
  }
  ctx.stroke()
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createFrostedWindows(windows: readonly WindowRect[]): FrostedWindows {
  const group = new THREE.Group()
  // Jedes Fenster bekommt seine eigene, zufällig vereiste Scheibe.
  const textures = windows.map((window, i) => paintFrost(window.arched, i + 1))
  const materials = textures.map((map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: true }))
  const geometries: THREE.BufferGeometry[] = []
  windows.forEach((window, i) => {
    const geometry = new THREE.PlaneGeometry(window.width, window.height)
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, materials[i])
    // Vor dem Glas (z 0,09), hinter den Sprossen (z 0,1) – die Sprossen bleiben sichtbar.
    mesh.position.set(window.x, window.y + window.height / 2, 0.095)
    mesh.renderOrder = 1
    group.add(mesh)
  })
  return {
    group,
    dispose() {
      for (const texture of textures) texture.dispose()
      for (const material of materials) material.dispose()
      for (const geometry of geometries) geometry.dispose()
    },
  }
}
