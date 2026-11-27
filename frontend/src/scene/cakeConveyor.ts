import * as THREE from 'three'
import type { ShowcaseWindow } from './houseBuilder.ts'

/** Meter pro Sekunde, mit denen das Band läuft. */
const SPEED = 0.32
/** Abstand der Kuchen auf dem Band (Meter). */
const SPACING = 0.78
/** Bildpunkte pro Meter auf der Leinwand. */
const PX_PER_M = 260
/** Kuchengröße – groß genug, dass man sie von der Straße aus erkennt. */
const CAKE_SIZE = 1.75

const CAKES = [
  { sponge: '#e9b97a', cream: '#fff6ea', top: '#d33b33' },
  { sponge: '#8a5a36', cream: '#f7c6d4', top: '#fff6ea' },
  { sponge: '#f1d39a', cream: '#c9e4f5', top: '#e8b04a' },
  { sponge: '#c97d5a', cream: '#fff0c8', top: '#3f8a4f' },
] as const

export interface CakeConveyor {
  group: THREE.Group
  update(time: number): void
  dispose(): void
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawCake(ctx: CanvasRenderingContext2D, cx: number, base: number, scale: number, variant: number) {
  const cake = CAKES[variant % CAKES.length]
  const w = 0.3 * scale
  const h = 0.17 * scale
  // Teller
  ctx.fillStyle = '#f4f1ee'
  rounded(ctx, cx - w * 0.68, base - 0.025 * scale, w * 1.36, 0.03 * scale, 0.015 * scale)
  ctx.fill()
  // Biskuit mit Cremeschicht
  ctx.fillStyle = cake.sponge
  rounded(ctx, cx - w / 2, base - h, w, h, 0.02 * scale)
  ctx.fill()
  ctx.fillStyle = cake.cream
  ctx.fillRect(cx - w / 2, base - h * 0.55, w, h * 0.13)
  // Glasur mit Tropfen
  rounded(ctx, cx - w / 2 - 0.006 * scale, base - h - 0.03 * scale, w + 0.012 * scale, 0.05 * scale, 0.025 * scale)
  ctx.fill()
  for (let i = 0; i < 5; i++) {
    const dx = cx - w / 2 + (w * (i + 0.5)) / 5
    rounded(ctx, dx - 0.014 * scale, base - h, 0.028 * scale, (0.03 + ((i * 7) % 3) * 0.018) * scale, 0.014 * scale)
    ctx.fill()
  }
  // Kirsche, Beere oder Blatt obendrauf
  ctx.fillStyle = cake.top
  ctx.beginPath()
  ctx.arc(cx, base - h - 0.055 * scale, 0.032 * scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.arc(cx - 0.01 * scale, base - h - 0.065 * scale, 0.009 * scale, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Ein Förderband hinter einer Reihe von Schaufenstern: Kuchen fahren von links nach
 * rechts daran vorbei. Gemalt wird auf eine gemeinsame Leinwand über die ganze Reihe,
 * jedes Fenster zeigt seinen Ausschnitt – so verschwinden die Kuchen sauber hinter der Wand.
 */
export function createCakeConveyor(windows: readonly ShowcaseWindow[]): CakeConveyor {
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
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) === 0 ? u0 : u1, uv.getY(i) === 0 ? v0 : v1)
    }
    const mesh = new THREE.Mesh(geometry, material)
    // Vor dem Fensterlicht (z 0,09), hinter den Sprossen (z 0,1).
    mesh.position.set(window.x, window.y + window.height / 2, 0.094)
    group.add(mesh)
    geometries.push(geometry)
  }

  // Hintergrund im Lichtton des Fensters, damit der Übergang zum Bogen nicht auffällt.
  const [lightBottom, lightTop] = windows[0].light
  const background = ctx.createLinearGradient(0, canvas.height, 0, 0)
  background.addColorStop(0, `#${lightBottom.getHexString()}`)
  background.addColorStop(1, `#${lightTop.getHexString()}`)

  let lastDrawn = -1
  const update = (time: number) => {
    // 30 Bilder pro Sekunde reichen für ein gemütliches Band.
    const frame = Math.floor(time * 30)
    if (frame === lastDrawn) return
    lastDrawn = frame
    const s = PX_PER_M
    const w = canvas.width
    const h = canvas.height
    const shift = (time * SPEED) % SPACING

    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)

    // Band: Gestell, laufende Rollen, Gurt
    const beltTop = h - 0.15 * s
    ctx.fillStyle = '#6d5a52'
    ctx.fillRect(0, beltTop + 0.05 * s, w, 0.08 * s)
    ctx.fillStyle = '#4b3b35'
    const rollerGap = 0.12
    const rollerShift = (time * SPEED) % rollerGap
    for (let x = -rollerGap + rollerShift; x < span + rollerGap; x += rollerGap) {
      ctx.beginPath()
      ctx.arc(x * s, beltTop + 0.075 * s, 0.022 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#3a2f2b'
    ctx.fillRect(0, beltTop, w, 0.035 * s)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    for (let x = -0.08 + ((time * SPEED) % 0.08); x < span; x += 0.08) ctx.fillRect(x * s, beltTop, 0.03 * s, 0.008 * s)

    // Kuchen – jeder behält seine Sorte, während er weiterfährt
    const first = Math.floor((time * SPEED) / SPACING)
    for (let i = -1; i * SPACING < span + SPACING; i++) {
      const x = (i * SPACING + shift) * s
      drawCake(ctx, x, beltTop, s * CAKE_SIZE, first - i + 1000)
    }
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
