import * as THREE from 'three'
import type { ShowcaseWindow } from './houseBuilder.ts'
import type { TimeUniform } from './materials.ts'

/** Alle so viele Sekunden wirft der Wichtel einen Scheit ins Feuer. */
export const THROW_PERIOD = 1
/** Zeitpunkt im Wurf (0–1), an dem der Scheit im Feuer landet – dann faucht auch der Schornstein. */
const LANDING = 0.72
/** Bildpunkte pro Meter auf der Leinwand. */
const PX_PER_M = 300

export interface Fireplace {
  group: THREE.Group
  update(time: number): void
  dispose(): void
}

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Ein flackernder Flammenzipfel, gemalt von unten Mitte (x, y) nach oben. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sway: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x - w / 2, y)
  ctx.bezierCurveTo(x - w * 0.6, y - h * 0.45, x + sway * 0.4 - w * 0.15, y - h * 0.7, x + sway, y - h)
  ctx.bezierCurveTo(x + sway * 0.4 + w * 0.25, y - h * 0.6, x + w * 0.65, y - h * 0.4, x + w / 2, y)
  ctx.closePath()
  ctx.fill()
}

function logShape(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = '#6b4a33'
  ctx.beginPath()
  ctx.roundRect(-16 * s, -6 * s, 32 * s, 12 * s, 5 * s)
  ctx.fill()
  ctx.fillStyle = '#ecc58c'
  ctx.beginPath()
  ctx.ellipse(16 * s, 0, 4 * s, 6 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Der Wichtel greift in den Korb … */
const GRAB = 0.12
/** … und lässt den Scheit hier los. */
const RELEASE = 0.47

/** Weich zwischen Schlüsselbildern [Zeit, Wert] überblenden. */
function keyframes(t: number, keys: readonly (readonly [number, number])[]): number {
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    const [t0, v0] = keys[i - 1]
    if (t <= t1) return v0 + (v1 - v0) * ease(clamp01((t - t0) / (t1 - t0)))
  }
  return keys[keys.length - 1][1]
}

// Arm: 0 = hängt, positiv = nach vorn zum Kamin, negativ = nach hinten/oben.
const ARM_KEYS = [[0, -0.3], [0.12, -0.8], [0.2, -0.55], [0.38, -2.6], [0.43, -2.7], [0.49, 1.3], [0.6, 1.6], [0.85, 0.15], [1, -0.3]] as const
// Oberkörper: positiv = zum Kamin geneigt.
const LEAN_KEYS = [[0, 0], [0.12, -0.32], [0.2, -0.12], [0.38, -0.2], [0.43, -0.22], [0.49, 0.26], [0.6, 0.3], [0.85, 0.02], [1, 0]] as const
// Stauchen (Hocke, Anlauf) und Strecken beim Wurf.
const SQUASH_KEYS = [[0, 0], [0.12, 0.9], [0.22, 0.1], [0.4, 0.7], [0.47, -0.5], [0.6, 0.1], [0.72, 0], [1, 0]] as const

function elfPose(cycle: number) {
  const lean = keyframes(cycle, LEAN_KEYS)
  return {
    arm: keyframes(cycle, ARM_KEYS),
    lean,
    squash: keyframes(cycle, SQUASH_KEYS),
    // Wie schnell sich der Körper gerade neigt – daran hängt der Bommel.
    swing: -(keyframes(cycle + 0.02, LEAN_KEYS) - lean) * 6,
    squint: cycle > 0.3 && cycle < 0.5,
  }
}

/** Wo die Wurfhand gerade ist – genau dieselben Schritte wie beim Zeichnen. */
function handAt(elf: { x: number; y: number }, cycle: number): { x: number; y: number } {
  const pose = elfPose(cycle)
  const m = new DOMMatrix()
    .translate(elf.x, elf.y - 30)
    .rotate((-pose.lean * 180) / Math.PI)
    .scale(1 + pose.squash * 0.05, 1 - pose.squash * 0.1)
    .translate(0, 30)
    .translate(-4, -78)
    .rotate((pose.arm * 180) / Math.PI)
  const p = m.transformPoint(new DOMPoint(0, 34))
  return { x: p.x, y: p.y }
}

/**
 * Das Kaminzimmer hinter dem Fenster oben rechts: Links prasselt der Kamin, rechts
 * steht ein Wichtel mit einem Korb Holz und wirft jede Sekunde einen Scheit hinein.
 * Gemalt wird – wie beim Kuchenband – auf eine Leinwand genau in Fenstergröße.
 */
export function createFireplaceWindow(window: ShowcaseWindow): Fireplace {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(window.width * PX_PER_M)
  canvas.height = Math.ceil(window.height * PX_PER_M)
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, fog: true })
  const geometry = new THREE.PlaneGeometry(window.width, window.height)
  const mesh = new THREE.Mesh(geometry, material)
  // Vor dem Fensterlicht (z 0,09), hinter dem Rahmen.
  mesh.position.set(window.x, window.y + window.height / 2, 0.094)
  const group = new THREE.Group()
  group.add(mesh)

  const W = canvas.width
  const H = canvas.height
  const floorY = H * 0.86
  // Kamin links, Wichtel rechts.
  const fire = { x: W * 0.34, y: floorY - 6, w: W * 0.42 }
  const elf = { x: W * 0.8, y: floorY }
  const releasePoint = handAt(elf, RELEASE)

  let lastDrawn = -1
  const update = (time: number) => {
    const frame = Math.floor(time * 30)
    if (frame === lastDrawn) return
    lastDrawn = frame

    const cycle = (time / THROW_PERIOD) % 1
    // Kurz nach der Landung lodert das Feuer auf.
    const sinceLanding = (cycle - LANDING + 1) % 1
    const flare = Math.exp(-sinceLanding * 7)
    const flicker = 0.85 + Math.sin(time * 17) * 0.06 + Math.sin(time * 29.3) * 0.05

    // Wand mit Streifentapete, im Schein des Feuers
    ctx.fillStyle = '#6e2f2c'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#5e2624'
    for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 12, floorY)
    const light = ctx.createRadialGradient(fire.x, fire.y - 30, 10, fire.x, fire.y - 30, W * (1.05 + flare * 0.2))
    light.addColorStop(0, `rgba(255, 190, 90, ${0.75 * flicker + flare * 0.2})`)
    light.addColorStop(1, 'rgba(255, 140, 60, 0)')
    ctx.fillStyle = light
    ctx.fillRect(0, 0, W, H)

    // Kranz an der Wand
    const wreath = { x: W * 0.5, y: H * 0.24, r: W * 0.17 }
    ctx.strokeStyle = '#2f6d3d'
    ctx.lineWidth = W * 0.08
    ctx.beginPath()
    ctx.arc(wreath.x, wreath.y, wreath.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#3f8a4f'
    ctx.lineWidth = W * 0.03
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(wreath.x + Math.cos(a) * wreath.r, wreath.y + Math.sin(a) * wreath.r, W * 0.03, a, a + 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#d33b33'
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4
      ctx.beginPath()
      ctx.arc(wreath.x + Math.cos(a) * wreath.r, wreath.y + Math.sin(a) * wreath.r, W * 0.018, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(wreath.x, wreath.y + wreath.r)
    ctx.lineTo(wreath.x - W * 0.08, wreath.y + wreath.r - W * 0.05)
    ctx.lineTo(wreath.x - W * 0.08, wreath.y + wreath.r + W * 0.05)
    ctx.moveTo(wreath.x, wreath.y + wreath.r)
    ctx.lineTo(wreath.x + W * 0.08, wreath.y + wreath.r - W * 0.05)
    ctx.lineTo(wreath.x + W * 0.08, wreath.y + wreath.r + W * 0.05)
    ctx.fill()

    // Dielenboden
    ctx.fillStyle = '#5a3a26'
    ctx.fillRect(0, floorY, W, H - floorY)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    for (let x = 14; x < W; x += 40) ctx.fillRect(x, floorY, 3, H - floorY)

    // Kamin: Steinumrandung, Sims mit Strumpf, dunkle Öffnung
    const fw = fire.w + 46
    const top = floorY - 150
    ctx.fillStyle = '#b9ada3'
    ctx.fillRect(fire.x - fw / 2, top, fw, floorY - top)
    ctx.fillStyle = '#9b8e84'
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        const bx = fire.x - fw / 2 + col * (fw / 5) + (row % 2) * 10
        ctx.fillRect(bx + 2, top + 12 + row * 24, fw / 5 - 6, 3)
      }
    }
    ctx.fillStyle = '#6b4a33'
    ctx.fillRect(fire.x - fw / 2 - 10, top - 12, fw + 20, 14)
    ctx.fillStyle = '#d33b33'
    ctx.beginPath()
    ctx.roundRect(fire.x + fw / 2 - 34, top + 2, 18, 30, 4)
    ctx.roundRect(fire.x + fw / 2 - 42, top + 22, 26, 12, 6)
    ctx.fill()
    ctx.fillStyle = '#fff8ee'
    ctx.fillRect(fire.x + fw / 2 - 36, top + 2, 22, 8)

    const openingTop = floorY - 104
    ctx.fillStyle = '#1d1210'
    ctx.beginPath()
    ctx.moveTo(fire.x - fire.w / 2, floorY)
    ctx.lineTo(fire.x - fire.w / 2, openingTop + 24)
    ctx.quadraticCurveTo(fire.x, openingTop - 16, fire.x + fire.w / 2, openingTop + 24)
    ctx.lineTo(fire.x + fire.w / 2, floorY)
    ctx.closePath()
    ctx.fill()

    // Glut, Scheite und Flammen
    for (const [dx, a] of [[-14, 0.25], [12, -0.2], [0, 0.05]] as const) logShape(ctx, fire.x + dx, fire.y - 2 - (a === 0.05 ? 10 : 0), a, 1.1)
    const height = (60 + flare * 46) * flicker
    flame(ctx, fire.x - 20, fire.y - 4, 30, height * 0.75, Math.sin(time * 9) * 8, '#e4572e')
    flame(ctx, fire.x + 18, fire.y - 4, 30, height * 0.8, Math.sin(time * 11 + 1) * 8, '#e4572e')
    flame(ctx, fire.x, fire.y - 4, 44, height, Math.sin(time * 7 + 2) * 10, '#f28c28')
    flame(ctx, fire.x - 4, fire.y - 4, 26, height * 0.62, Math.sin(time * 13) * 6, '#ffd23f')
    flame(ctx, fire.x + 6, fire.y - 4, 14, height * 0.4, Math.sin(time * 15) * 4, '#fff4c2')

    // Funken nach der Landung
    if (sinceLanding < 0.5) {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28
        const r = sinceLanding * (90 + (i % 3) * 30)
        ctx.fillStyle = `rgba(255, ${200 - i * 8}, 80, ${1 - sinceLanding * 2})`
        ctx.beginPath()
        ctx.arc(fire.x + Math.cos(a) * r, fire.y - 30 + Math.sin(a) * r, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Wichtel: in den Korb greifen, ausholen, schleudern, nachschwingen.
    const pose = elfPose(cycle)
    const holding = cycle >= GRAB && cycle < RELEASE
    const inFlight = cycle >= RELEASE && cycle < LANDING

    // Holzkorb neben dem Wichtel – der oberste Scheit fehlt, bis der Wichtel nachlegt.
    ctx.fillStyle = '#8a5a2e'
    ctx.beginPath()
    ctx.roundRect(elf.x - 4, floorY - 30, 44, 30, 6)
    ctx.fill()
    const basketLogs = holding || inFlight ? 2 : 3
    for (let i = 0; i < basketLogs; i++) logShape(ctx, elf.x + 8 + i * 12, floorY - 32 - (i % 2) * 6, -0.3 + i * 0.3, 0.8)

    ctx.save()
    ctx.translate(elf.x, elf.y)
    // Beine und Stiefel bleiben am Boden, nur der Oberkörper beugt sich.
    ctx.fillStyle = '#2f6d3d'
    ctx.fillRect(-14, -34, 10, 32)
    ctx.fillRect(2, -34, 10, 32)
    ctx.fillStyle = '#3a2418'
    ctx.beginPath()
    ctx.ellipse(-14, -2, 11, 5, 0, 0, Math.PI * 2)
    ctx.ellipse(2, -2, 11, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(0, -30)
    ctx.rotate(-pose.lean)
    ctx.scale(1 + pose.squash * 0.05, 1 - pose.squash * 0.1)
    ctx.translate(0, 30)
    // Kittel mit Gürtel
    ctx.fillStyle = '#3f8a4f'
    ctx.beginPath()
    ctx.moveTo(-24, -30)
    ctx.lineTo(-16, -84)
    ctx.lineTo(12, -84)
    ctx.lineTo(20, -30)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#3a2418'
    ctx.fillRect(-21, -52, 40, 6)
    ctx.fillStyle = '#e8b04a'
    ctx.fillRect(-6, -53, 9, 8)
    // Hinterer Arm hilft beim Gleichgewicht.
    ctx.save()
    ctx.translate(6, -78)
    ctx.rotate(-pose.arm * 0.35 - 0.3)
    ctx.fillStyle = '#2f6d3d'
    ctx.beginPath()
    ctx.roundRect(-4, -3, 8, 26, 4)
    ctx.fill()
    ctx.restore()
    // Kopf (schaut nach links zum Kamin) – beim Ausholen kneift er die Augen zusammen.
    ctx.fillStyle = '#f6c9a3'
    ctx.beginPath()
    ctx.arc(-2, -100, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(10, -104)
    ctx.lineTo(26, -116)
    ctx.lineTo(14, -96)
    ctx.fill()
    ctx.fillStyle = '#e88f73'
    ctx.beginPath()
    ctx.arc(-18, -99, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3a2418'
    if (pose.squint) ctx.fillRect(-14, -105, 8, 2.4)
    else {
      ctx.beginPath()
      ctx.arc(-10, -104, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    // Mütze – der Bommel schwingt der Bewegung hinterher.
    const bob = { x: 22 + Math.sin(time * 6) * 3 + pose.swing * 10, y: -138 - Math.abs(pose.swing) * 4 }
    ctx.fillStyle = '#fff8ee'
    ctx.fillRect(-20, -118, 36, 8)
    ctx.fillStyle = '#d33b33'
    ctx.beginPath()
    ctx.moveTo(-18, -116)
    ctx.quadraticCurveTo(-4, -150, bob.x, bob.y)
    ctx.lineTo(14, -116)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e8b04a'
    ctx.beginPath()
    ctx.arc(bob.x, bob.y, 5, 0, Math.PI * 2)
    ctx.fill()
    // Wurfarm mit (oder ohne) Scheit
    ctx.translate(-4, -78)
    ctx.rotate(pose.arm)
    ctx.fillStyle = '#3f8a4f'
    ctx.beginPath()
    ctx.roundRect(-5, -4, 10, 32, 5)
    ctx.fill()
    ctx.fillStyle = '#f6c9a3'
    ctx.beginPath()
    ctx.arc(0, 30, 5.5, 0, Math.PI * 2)
    ctx.fill()
    if (holding) logShape(ctx, 0, 34, 1.4, 0.85)
    ctx.restore()

    // Schwungstreifen beim Schleudern
    if (cycle > 0.42 && cycle < 0.52) {
      const fade = 1 - Math.abs(cycle - 0.47) / 0.05
      ctx.strokeStyle = `rgba(255, 240, 200, ${0.55 * fade})`
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const r of [30, 38]) {
        ctx.beginPath()
        ctx.arc(elf.x - 4, elf.y - 78 + 8, r, -Math.PI * 0.95, -Math.PI * 0.35)
        ctx.stroke()
      }
    }

    // Der fliegende Scheit: Parabel genau ab der Hand ins Feuer, wirbelnd, mit Nachzieh-Schatten.
    if (inFlight) {
      const t = (cycle - RELEASE) / (LANDING - RELEASE)
      for (const [lag, alpha] of [[0.12, 0.2], [0.06, 0.4], [0, 1]] as const) {
        const tt = Math.max(0, t - lag)
        const x = releasePoint.x + (fire.x - releasePoint.x) * tt
        const y = releasePoint.y + (fire.y - 14 - releasePoint.y) * tt - Math.sin(tt * Math.PI) * 46
        ctx.globalAlpha = alpha
        logShape(ctx, x, y, 1.4 - tt * 9, 0.85 * (1 - tt * 0.15))
      }
      ctx.globalAlpha = 1
    }

    texture.needsUpdate = true
  }

  return {
    group,
    update,
    dispose() {
      texture.dispose()
      material.dispose()
      geometry.dispose()
    },
  }
}

const FLAME_COUNT = 120

const FLAME_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPeriod;
uniform float uLanding;
attribute vec3 aSeed;
varying float vLife;
varying float vAlpha;
varying float vSpark;
void main() {
  float spark = step(0.75, aSeed.z);
  float speed = mix(1.6, 1.0, spark);
  float life = fract(uTime * speed + aSeed.x);
  // Im Takt der Würfe faucht der Schornstein: kurz nach jeder Landung schießen die Flammen hoch.
  float since = fract(uTime / uPeriod - uLanding);
  float burst = exp(-since * 5.0);
  vec3 p = position;
  float rise = mix(1.5, 3.6, spark) * (0.7 + burst * 1.2);
  p.y += life * rise;
  p.x += (aSeed.y - 0.5) * (0.22 + life * mix(0.3, 1.2, spark)) + sin(uTime * 9.0 + aSeed.x * 40.0) * 0.04 * life;
  p.z += (fract(aSeed.y * 7.13) - 0.5) * 0.16;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float size = mix(0.95 * (1.0 - life * 0.7) * (0.8 + burst * 0.8), 0.12, spark);
  gl_PointSize = size * uScale / max(-mvPosition.z, 0.1);
  vLife = life;
  vSpark = spark;
  vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - life) * mix(0.9, 1.0, spark);
  gl_Position = projectionMatrix * mvPosition;
}
`

const FLAME_FRAGMENT = /* glsl */ `
uniform float uStrength;
varying float vLife;
varying float vAlpha;
varying float vSpark;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, d) * vAlpha * uStrength * mix(0.8, 1.0, vSpark);
  if (alpha < 0.01) discard;
  vec3 hot = vec3(1.0, 0.92, 0.5);
  vec3 mid = vec3(1.0, 0.5, 0.08);
  vec3 cool = vec3(0.75, 0.1, 0.03);
  vec3 color = vLife < 0.35 ? mix(hot, mid, vLife / 0.35) : mix(mid, cool, (vLife - 0.35) / 0.65);
  color = mix(color, vec3(1.0, 0.8, 0.4), vSpark);
  // Halb deckend, halb leuchtend: Farbe bleibt erhalten und strahlt trotzdem in die Nacht.
  gl_FragColor = vec4(color * alpha, alpha * 0.55);
}
`

export interface ChimneyFlames {
  points: THREE.Points
  setStrength(strength: number): void
  update(pixelsPerUnit: number): void
  dispose(): void
}

/** Flammen und Funken, die aus dem Schornstein schlagen – im Takt der Scheite im Kamin. */
export function createChimneyFlames(origin: THREE.Vector3, time: TimeUniform): ChimneyFlames {
  const positions: number[] = []
  const seeds: number[] = []
  for (let i = 0; i < FLAME_COUNT; i++) {
    positions.push(origin.x, origin.y - 0.15, origin.z)
    const r = (n: number) => {
      const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453
      return x - Math.floor(x)
    }
    seeds.push(r(1), r(2), r(3))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 3))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uScale: { value: 1 },
      uStrength: { value: 1 },
      uPeriod: { value: THROW_PERIOD },
      uLanding: { value: LANDING },
    },
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    // Vormultipliziertes Alpha, übereinander gemalt – additiv würde alles zu Weiß verschmelzen.
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 6

  return {
    points,
    setStrength(strength) {
      material.uniforms.uStrength.value = strength
    },
    update(pixelsPerUnit) {
      material.uniforms.uScale.value = pixelsPerUnit
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
