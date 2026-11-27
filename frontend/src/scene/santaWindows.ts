import * as THREE from 'three'
import type { ShowcaseWindow } from './houseBuilder.ts'

/**
 * Easter Egg nach dem „Plätzchen-Hüpfer“ (Haus 15): Hinter den Fenstern im obersten Stockwerk
 * hüpft ein kleiner Santa von Plätzchen zu Plätzchen hin und her. Gemalt wird – wie beim
 * Kuchenband in Haus 1 – auf eine gemeinsame Leinwand über die ganze Fensterreihe; jedes Fenster
 * zeigt seinen Ausschnitt, dazwischen verschwindet Santa hinter der Wand.
 */

const PX_PER_M = 240
/** Ein Hüpfer von Plätzchen zu Plätzchen dauert so lange (Sekunden) … */
const HOP_TIME = 0.62
/** … und geht so hoch (Meter). */
const HOP_HEIGHT = 0.42
/** Santa ist im Fenster etwa so groß (Meter). */
const SANTA_HEIGHT = 0.5

export interface SantaWindows {
  group: THREE.Group
  update(time: number): void
  dispose(): void
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Ein Plätzchen als Sprungbrett, `cx`/`top` in Pixeln. */
function drawCookie(ctx: CanvasRenderingContext2D, cx: number, top: number, s: number, variant: number) {
  const w = 0.34 * s
  const h = 0.07 * s
  const dough = ['#ecc07a', '#b06a34', '#f2d49a', '#e3b77d'][variant % 4]
  const edge = ['#c48a3e', '#7a4321', '#c99a4f', '#b0773d'][variant % 4]
  ctx.fillStyle = edge
  rounded(ctx, cx - w / 2, top, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = dough
  rounded(ctx, cx - w / 2 + 2, top + 1, w - 4, h - 4, (h - 4) / 2)
  ctx.fill()
  ctx.fillStyle = variant % 2 ? '#fff8ee' : '#4a2a18'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(cx - w * 0.25 + i * w * 0.25, top + h * 0.42, 0.012 * s, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Kleiner Santa um seine Fußmitte; `facing` −1/1, `squash` < 1 beim Aufkommen. */
function drawSanta(ctx: CanvasRenderingContext2D, x: number, feet: number, s: number, facing: number, squash: number) {
  const h = SANTA_HEIGHT * s
  const w = h * 0.72
  ctx.save()
  ctx.translate(x, feet)
  ctx.scale(facing * (1.5 - squash / 2), squash)
  ctx.fillStyle = '#2a1a14'
  for (const side of [-1, 1]) {
    rounded(ctx, side * w * 0.22 - w * 0.14, -h * 0.14, w * 0.3, h * 0.14, 3)
    ctx.fill()
  }
  ctx.fillStyle = '#d23a3a'
  rounded(ctx, -w * 0.42, -h * 0.66, w * 0.84, h * 0.56, w * 0.3)
  ctx.fill()
  ctx.fillStyle = '#fff8ee'
  rounded(ctx, -w * 0.44, -h * 0.17, w * 0.88, h * 0.09, 4)
  ctx.fill()
  ctx.fillStyle = '#2a1a14'
  ctx.fillRect(-w * 0.42, -h * 0.38, w * 0.84, h * 0.08)
  ctx.strokeStyle = '#ffd45e'
  ctx.lineWidth = Math.max(2, h * 0.03)
  ctx.strokeRect(-w * 0.09, -h * 0.385, w * 0.18, h * 0.09)
  // Beide Arme vor Freude in die Höhe
  ctx.strokeStyle = '#c23030'
  ctx.lineWidth = w * 0.14
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * w * 0.32, -h * 0.58)
    ctx.lineTo(side * w * 0.55, -h * 0.82)
    ctx.stroke()
  }
  ctx.fillStyle = '#f6c9a3'
  ctx.beginPath()
  ctx.arc(0, -h * 0.76, w * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(w * 0.03, -h * 0.66, w * 0.3, w * 0.24, 0, 0, Math.PI)
  ctx.fill()
  ctx.fillStyle = '#e88f73'
  ctx.beginPath()
  ctx.arc(w * 0.2, -h * 0.75, w * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a1a14'
  ctx.beginPath()
  ctx.arc(w * 0.12, -h * 0.8, w * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d23a3a'
  ctx.beginPath()
  ctx.moveTo(-w * 0.27, -h * 0.84)
  ctx.quadraticCurveTo(-w * 0.05, -h * 1.12, -w * 0.48, -h * 1.02)
  ctx.lineTo(w * 0.24, -h * 0.86)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff8ee'
  rounded(ctx, -w * 0.3, -h * 0.9, w * 0.58, h * 0.08, 4)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-w * 0.5, -h * 1.02, w * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function createSantaWindows(windows: readonly ShowcaseWindow[]): SantaWindows {
  const left = Math.min(...windows.map((w) => w.x - w.width / 2))
  const right = Math.max(...windows.map((w) => w.x + w.width / 2))
  const height = Math.max(...windows.map((w) => w.height))
  const bottom = Math.min(...windows.map((w) => w.y))
  const span = right - left

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(span * PX_PER_M)
  canvas.height = Math.ceil(height * PX_PER_M)
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, fog: true })

  const group = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  for (const window of windows) {
    const geometry = new THREE.PlaneGeometry(window.width, window.height)
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
    const u0 = (window.x - window.width / 2 - left) / span
    const u1 = (window.x + window.width / 2 - left) / span
    const v0 = (window.y - bottom) / height
    const v1 = (window.y + window.height - bottom) / height
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) === 0 ? u0 : u1, uv.getY(i) === 0 ? v0 : v1)
    const mesh = new THREE.Mesh(geometry, material)
    // Vor dem Fensterlicht (z 0,09), hinter den Sprossen (z 0,1).
    mesh.position.set(window.x, window.y + window.height / 2, 0.094)
    group.add(mesh)
    geometries.push(geometry)
  }

  // Raum im Lichtton der Fenster mit einer Girlande oben
  const [lightBottom, lightTop] = windows[0].light
  const background = ctx.createLinearGradient(0, canvas.height, 0, 0)
  background.addColorStop(0, `#${lightBottom.getHexString()}`)
  background.addColorStop(1, `#${lightTop.getHexString()}`)

  // Sprungbretter: in gleichen Abständen, leicht unterschiedlich hoch
  const s = PX_PER_M
  const margin = 0.25
  const count = Math.max(3, Math.round((span - margin * 2) / 0.45) + 1)
  const step = (span - margin * 2) / (count - 1)
  const pads = Array.from({ length: count }, (_, i) => ({
    x: margin + i * step,
    y: 0.14 + ((i * 7) % 3) * 0.09,
    variant: i,
  }))

  let lastDrawn = -1
  const update = (time: number) => {
    const frame = Math.floor(time * 30)
    if (frame === lastDrawn) return
    lastDrawn = frame
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)

    // Girlande unter der Decke
    for (let x = 0; x < span; x += 0.09) {
      const y = 0.06 + Math.sin((x / span) * Math.PI * 6) ** 2 * 0.05
      ctx.fillStyle = ['#2f6650', '#3a755a', '#28594a'][Math.round(x / 0.09) % 3]
      ctx.beginPath()
      ctx.arc(x * s, y * s, 0.045 * s, 0, Math.PI * 2)
      ctx.fill()
      if (Math.round(x / 0.09) % 3 === 0) {
        ctx.fillStyle = ['#ff6b5b', '#ffd45e', '#6fb8ff'][Math.round(x / 0.27) % 3]
        ctx.beginPath()
        ctx.arc(x * s, (y + 0.05) * s, 0.018 * s, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (const pad of pads) drawCookie(ctx, pad.x * s, h - pad.y * s, s, pad.variant)

    // Santa hüpft von Plätzchen zu Plätzchen – am Ende kehrt er um.
    const hop = time / HOP_TIME
    const index = Math.floor(hop)
    const k = hop - index
    const cycle = (count - 1) * 2
    const at = (n: number) => {
      const m = ((n % cycle) + cycle) % cycle
      return m < count ? m : cycle - m
    }
    const from = pads[at(index)]
    const to = pads[at(index + 1)]
    const x = THREE.MathUtils.lerp(from.x, to.x, k)
    const ground = THREE.MathUtils.lerp(from.y, to.y, k)
    const y = ground + 4 * HOP_HEIGHT * k * (1 - k)
    const squash = k < 0.12 ? 0.8 + (k / 0.12) * 0.2 : 1
    drawSanta(ctx, x * s, h - y * s, s, to.x >= from.x ? 1 : -1, squash)
    texture.needsUpdate = true
  }

  return {
    group,
    update,
    dispose() {
      texture.dispose()
      material.dispose()
      for (const geometry of geometries) geometry.dispose()
    },
  }
}
