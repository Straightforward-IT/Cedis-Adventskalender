import { COOKIE, cookieX, PRESENT, SANTA, WIDTH } from './model.ts'
import type { Cookie, CookieKind, Present, World } from './model.ts'

/** Wie die Welt auf die Leinwand kommt: `scale` Pixel pro Einheit, y wächst nach oben. */
export interface View {
  width: number
  height: number
  scale: number
}

const PRESENT_COLORS = [
  ['#d23a3a', '#ffd45e'],
  ['#2f7fd1', '#f6f1ff'],
  ['#2f9a5c', '#d23a3a'],
  ['#b54bb0', '#ffd45e'],
  ['#e8b33a', '#d23a3a'],
  ['#f2ede4', '#2f9a5c'],
] as const

const COOKIE_LOOK: Record<CookieKind, { dough: string; edge: string }> = {
  butter: { dough: '#ecc07a', edge: '#c48a3e' },
  ginger: { dough: '#b06a34', edge: '#7a4321' },
  star: { dough: '#f2d49a', edge: '#c99a4f' },
  choc: { dough: '#e3b77d', edge: '#b0773d' },
}

export interface Sparkle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  t: number
  color: string
}

/** Feste Sterne und Schneeflocken – einmal ausgewürfelt. */
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 0.6180339) % 1, y: (i * 0.7548776) % 1, r: 0.6 + ((i * 37) % 10) / 10 }))
const FLAKES = Array.from({ length: 46 }, (_, i) => ({ x: (i * 0.381966) % 1, y: (i * 0.5698403) % 1, s: 0.5 + ((i * 13) % 10) / 12 }))

function toScreen(view: View, camera: number, x: number, y: number): [number, number] {
  return [x * view.scale, view.height - (y - camera) * view.scale]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawSky(ctx: CanvasRenderingContext2D, view: View, world: World): void {
  const { width, height } = view
  // Je höher, desto tiefer das Nachtblau
  const depth = Math.min(1, world.camera / 160)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, mix('#2a2e62', '#0f1233', depth))
  gradient.addColorStop(1, mix('#4a4f93', '#232764', depth))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Sterne mit leichter Parallaxe
  ctx.fillStyle = '#fff8e6'
  for (const star of STARS) {
    const y = ((star.y * height + world.camera * view.scale * 0.08) % height + height) % height
    ctx.globalAlpha = 0.45 + 0.4 * Math.sin(world.time * 2 + star.x * 40) ** 2
    ctx.beginPath()
    ctx.arc(star.x * width, y, star.r * (view.scale / 40), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Mond
  const moonY = height * 0.16 + world.camera * view.scale * 0.03
  if (moonY < height + 60) {
    ctx.fillStyle = '#fff3c9'
    ctx.beginPath()
    ctx.arc(width * 0.8, moonY, view.scale * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = mix('#2a2e62', '#0f1233', depth)
    ctx.beginPath()
    ctx.arc(width * 0.8 - view.scale * 0.4, moonY - view.scale * 0.15, view.scale * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Unten zu Beginn: die verschneiten Dächer der Weihnachtsstraße. */
function drawRooftops(ctx: CanvasRenderingContext2D, view: View, world: World): void {
  const base = toScreen(view, world.camera, 0, -0.3)[1]
  if (base - view.scale * 6 > view.height) return
  const roofs = [
    { x: -0.5, w: 3, h: 3.2, color: '#c96a5a' },
    { x: 2.3, w: 2.6, h: 4.2, color: '#6f9bc2' },
    { x: 4.8, w: 2.8, h: 3.4, color: '#e2c58f' },
    { x: 7.4, w: 3.1, h: 4, color: '#8bb59a' },
  ]
  for (const roof of roofs) {
    const left = roof.x * view.scale
    const right = (roof.x + roof.w) * view.scale
    const top = base - roof.h * view.scale
    ctx.fillStyle = roof.color
    ctx.fillRect(left, top + view.scale * 1.1, right - left, base - top)
    // Giebel
    ctx.beginPath()
    ctx.moveTo(left - view.scale * 0.2, top + view.scale * 1.2)
    ctx.lineTo((left + right) / 2, top)
    ctx.lineTo(right + view.scale * 0.2, top + view.scale * 1.2)
    ctx.closePath()
    ctx.fillStyle = '#f3f6ff'
    ctx.fill()
    // Fenster mit warmem Licht
    ctx.fillStyle = '#ffd77a'
    for (let i = 0; i < 2; i++) {
      roundRect(ctx, left + (0.45 + i * (roof.w - 1.3)) * view.scale, top + 1.7 * view.scale, 0.55 * view.scale, 0.7 * view.scale, 4)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#f3f6ff'
  ctx.fillRect(0, base, view.width, view.height)
}

function drawCookie(ctx: CanvasRenderingContext2D, view: View, world: World, cookie: Cookie): void {
  const [cx, top] = toScreen(view, world.camera, cookieX(cookie, world.time), cookie.y + COOKIE.height)
  const w = COOKIE.width * view.scale
  const h = COOKIE.height * view.scale * 1.25
  if (top > view.height + h || top < -h) return
  const look = COOKIE_LOOK[cookie.kind]
  const x = cx - w / 2

  // Schatten, Rand, Teig
  ctx.fillStyle = 'rgba(10, 10, 40, 0.25)'
  roundRect(ctx, x + 3, top + 4, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = look.edge
  roundRect(ctx, x, top, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = look.dough
  roundRect(ctx, x + 2, top + 1, w - 4, h - 5, (h - 5) / 2)
  ctx.fill()

  // Verzierung je nach Sorte
  const dots = 5
  if (cookie.kind === 'ginger') {
    ctx.strokeStyle = '#fff8ee'
    ctx.lineWidth = Math.max(1.5, view.scale * 0.05)
    ctx.beginPath()
    for (let i = 0; i <= 8; i++) {
      const px = x + w * 0.12 + (w * 0.76 * i) / 8
      const py = top + h * (i % 2 ? 0.3 : 0.6)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  } else if (cookie.kind === 'choc') {
    ctx.fillStyle = '#4a2a18'
    for (let i = 0; i < dots; i++) {
      ctx.beginPath()
      ctx.arc(x + w * (0.18 + i * 0.16), top + h * (i % 2 ? 0.35 : 0.55), view.scale * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (cookie.kind === 'star') {
    const colors = ['#d23a3a', '#2f9a5c', '#2f7fd1', '#ffd45e']
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(x + w * (0.12 + i * 0.12), top + h * (i % 2 ? 0.3 : 0.55), view.scale * 0.07, view.scale * 0.04)
    }
  } else {
    ctx.fillStyle = look.edge
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x + w * (0.3 + i * 0.2), top + h * 0.45, view.scale * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Gleitende Plätzchen glitzern mit Zuckerrand
  if (cookie.move) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.setLineDash([3, 4])
    ctx.lineWidth = 2
    roundRect(ctx, x - 2, top - 2, w + 4, h + 4, h / 2 + 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawPresent(ctx: CanvasRenderingContext2D, view: View, world: World, present: Present): void {
  const bob = Math.sin(world.time * 3 + present.id) * 0.06
  const [cx, bottom] = toScreen(view, world.camera, present.x, present.y + bob)
  const s = PRESENT.size * view.scale
  if (bottom < -s || bottom > view.height + s) return
  const [paper, ribbon] = PRESENT_COLORS[present.color % PRESENT_COLORS.length]
  // Leuchten, damit man Geschenke von weitem sieht
  const glow = ctx.createRadialGradient(cx, bottom - s / 2, 0, cx, bottom - s / 2, s * 1.2)
  glow.addColorStop(0, 'rgba(255, 230, 150, 0.55)')
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - s * 1.2, bottom - s * 1.7, s * 2.4, s * 2.4)
  ctx.fillStyle = paper
  roundRect(ctx, cx - s / 2, bottom - s, s, s, 3)
  ctx.fill()
  ctx.fillStyle = ribbon
  ctx.fillRect(cx - s * 0.08, bottom - s, s * 0.16, s)
  ctx.fillRect(cx - s / 2, bottom - s * 0.58, s, s * 0.16)
  // Schleife
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(cx + side * s * 0.17, bottom - s - s * 0.08, s * 0.17, s * 0.1, side * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Santa, gezeichnet um seine Fußmitte. */
function drawSanta(ctx: CanvasRenderingContext2D, view: View, world: World, x: number): void {
  const santa = world.santa
  const [sx, sy] = toScreen(view, world.camera, x, santa.y)
  const u = view.scale
  // Stauchen beim Aufkommen, Strecken im Flug
  const squash = santa.bounce < 0.12 ? 1 - (1 - santa.bounce / 0.12) * 0.22 : 1 + Math.min(0.1, Math.abs(santa.vy) * 0.006)
  ctx.save()
  ctx.translate(sx, sy)
  ctx.scale(santa.facing * (2 - squash) * 0.5 + santa.facing * 0.5, squash)
  const w = SANTA.width * u
  const h = SANTA.height * u

  // Stiefel
  ctx.fillStyle = '#2a1a14'
  for (const side of [-1, 1]) {
    roundRect(ctx, side * w * 0.22 - w * 0.14 + (side > 0 ? w * 0.04 : 0), -h * 0.14, w * 0.3, h * 0.14, 4)
    ctx.fill()
  }
  // Mantel
  ctx.fillStyle = '#d23a3a'
  roundRect(ctx, -w * 0.42, -h * 0.66, w * 0.84, h * 0.56, w * 0.3)
  ctx.fill()
  // Fellbesatz unten und vorn
  ctx.fillStyle = '#fff8ee'
  roundRect(ctx, -w * 0.44, -h * 0.17, w * 0.88, h * 0.09, 5)
  ctx.fill()
  // Gürtel mit goldener Schnalle
  ctx.fillStyle = '#2a1a14'
  ctx.fillRect(-w * 0.42, -h * 0.38, w * 0.84, h * 0.08)
  ctx.strokeStyle = '#ffd45e'
  ctx.lineWidth = Math.max(2, u * 0.05)
  ctx.strokeRect(-w * 0.09, -h * 0.385, w * 0.18, h * 0.09)
  // Arm, der nach vorn zeigt, mit Handschuh
  ctx.fillStyle = '#c23030'
  roundRect(ctx, w * 0.2, -h * 0.6, w * 0.38, h * 0.13, 6)
  ctx.fill()
  ctx.fillStyle = '#2a1a14'
  ctx.beginPath()
  ctx.arc(w * 0.6, -h * 0.535, w * 0.09, 0, Math.PI * 2)
  ctx.fill()

  // Kopf, Bart, Nase, Auge
  ctx.fillStyle = '#f6c9a3'
  ctx.beginPath()
  ctx.arc(0, -h * 0.76, w * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(w * 0.03, -h * 0.66, w * 0.3, w * 0.24, 0, 0, Math.PI)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.06, -h * 0.71, w * 0.17, w * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e88f73'
  ctx.beginPath()
  ctx.arc(w * 0.2, -h * 0.75, w * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a1a14'
  ctx.beginPath()
  ctx.arc(w * 0.12, -h * 0.8, w * 0.035, 0, Math.PI * 2)
  ctx.fill()
  // Mütze mit Bommel, nach hinten wehend
  ctx.fillStyle = '#d23a3a'
  ctx.beginPath()
  ctx.moveTo(-w * 0.27, -h * 0.84)
  ctx.quadraticCurveTo(-w * 0.05, -h * 1.12, -w * 0.48, -h * 1.02)
  ctx.lineTo(w * 0.24, -h * 0.86)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff8ee'
  roundRect(ctx, -w * 0.3, -h * 0.9, w * 0.58, h * 0.08, 5)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-w * 0.5, -h * 1.02, w * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Aufgefangen: ein Schneewölkchen unter den Füßen
  if (world.rescue > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    for (const [dx, r] of [[-0.45, 0.32], [0, 0.42], [0.45, 0.32]] as const) {
      ctx.beginPath()
      ctx.arc(sx + dx * u, sy + 0.2 * u, r * u, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawFlakes(ctx: CanvasRenderingContext2D, view: View, world: World): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  for (const flake of FLAKES) {
    const y = ((flake.y * view.height + world.time * 30 * flake.s + world.camera * view.scale * 0.25) % view.height + view.height) % view.height
    const x = (flake.x * view.width + Math.sin(world.time + flake.y * 20) * 12 + view.width) % view.width
    ctx.beginPath()
    ctx.arc(x, y, 1.2 + flake.s * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSparkles(ctx: CanvasRenderingContext2D, sparkles: Sparkle[]): void {
  for (const s of sparkles) {
    const k = s.t / s.life
    ctx.globalAlpha = Math.max(0, 1 - k)
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(s.x, s.y, 2.5 + (1 - k) * 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function drawWorld(ctx: CanvasRenderingContext2D, view: View, world: World, sparkles: Sparkle[]): void {
  drawSky(ctx, view, world)
  drawRooftops(ctx, view, world)
  for (const cookie of world.cookies) drawCookie(ctx, view, world, cookie)
  for (const present of world.presents) if (!present.taken) drawPresent(ctx, view, world, present)
  // Am Rand doppelt zeichnen, damit Santa sanft hinüberwechselt
  const x = world.santa.x
  drawSanta(ctx, view, world, x)
  if (x < SANTA.width) drawSanta(ctx, view, world, x + WIDTH)
  if (x > WIDTH - SANTA.width) drawSanta(ctx, view, world, x - WIDTH)
  drawSparkles(ctx, sparkles)
  drawFlakes(ctx, view, world)
}

/** Funkeln an der Stelle eines eingesammelten Geschenks (in Bildschirmkoordinaten). */
export function presentSparkles(view: View, world: World, present: Present): Sparkle[] {
  const [x, y] = toScreen(view, world.camera, present.x, present.y + PRESENT.size / 2)
  const colors = ['#ffd45e', '#fff3c9', PRESENT_COLORS[present.color % PRESENT_COLORS.length][0]]
  return Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    const speed = 80 + (i % 4) * 40
    return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.6 + (i % 3) * 0.15, t: 0, color: colors[i % colors.length] }
  })
}

function mix(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`
}
