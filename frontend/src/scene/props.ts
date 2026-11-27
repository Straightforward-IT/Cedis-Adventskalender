import * as THREE from 'three'
import type { Random } from '../lib/rng.ts'
import type { Builder, Glow } from './batch.ts'
import { BERRY, GOLD, IRON, PINE, SNOW, WOOD, WOOD_DARK, col, shade } from './palette.ts'

/** Die drei Sammler, aus denen ein Haus (oder die Umgebung) besteht. */
export interface Builders {
  /** Beleuchtete Oberflächen. */
  solid: Builder
  /** Selbstleuchtende Flächen: Fenster, Lämpchen. */
  glow: Builder
  /** Lichthöfe (additiv). */
  halo: Builder
  rnd: Random
}

const COAL = '#2b2b33'
const CARROT = '#e8843a'
const TERRACOTTA = '#b5654a'
const LANTERN_LIGHT = '#ffd27a'
const GIFT_COLORS = ['#c4463c', '#3f7a5f', '#efe2cb', '#6f9bc2', '#d9a441', '#b77fb0']

const dimmed = new Map<string, THREE.Color>()

/** Abgedunkelte Farbe für den Lichthof einer Lichtquelle. */
export function haloOf(color: THREE.Color, strength: number): THREE.Color {
  const key = `${color.getHexString()}|${strength}`
  let result = dimmed.get(key)
  if (!result) {
    result = color.clone().multiplyScalar(strength)
    dimmed.set(key, result)
  }
  return result
}

/** Funkelndes Deko-Licht (Lichterkette). */
export function decoGlow(rnd: Random, twinkle = 0.55): Glow {
  return { phase: rnd.range(0, 60), twinkle, interior: 0 }
}

/** Ein Lämpchen samt kleinem Lichthof. */
export function addBulb(
  { glow, halo, rnd }: Builders,
  x: number,
  y: number,
  z: number,
  color: THREE.Color,
  size = 0.062,
  twinkle = 0.55,
  /** Teil einer Lichterkette (leuchtet erst nach Haus 3)? Einzelne Lampen übergeben false. */
  string = true,
): void {
  const light = { ...decoGlow(rnd, twinkle), string }
  glow.bulb(x, y, z, size, color, light)
  halo.billboard(x, y, z, size * 8, size * 8, haloOf(color, 0.42), light)
}

/** Tanne aus gestapelten Kegeln mit Schnee auf den Zweigen. `lights` schmückt sie. */
export function addFir(
  builders: Builders,
  x: number,
  z: number,
  height: number,
  options: { lights?: readonly THREE.Color[]; pot?: boolean; star?: boolean } = {},
): void {
  const { solid, glow, halo, rnd } = builders
  const base = options.pot ? 0.24 : 0
  if (options.pot) solid.cylinder(x, 0.13, z, 0.2, 0.25, 0.26, 8, col(TERRACOTTA))
  solid.cylinder(x, base + height * 0.08, z, height * 0.05, height * 0.04, height * 0.16, 6, col(WOOD_DARK))

  const tiers = 3
  const radius = height * 0.3
  const tierHeight = height * 0.42
  const tierBase = (tier: number) => base + height * (0.12 + 0.26 * tier)
  const tierRadius = (tier: number) => radius * (1 - 0.27 * tier)
  for (let tier = 0; tier < tiers; tier++) {
    solid.cone(x, tierBase(tier), z, tierRadius(tier), tierHeight, 8, col(PINE[tier % PINE.length]))
    solid.cone(
      x,
      tierBase(tier) + tierHeight * 0.45,
      z,
      tierRadius(tier) * 0.57,
      tierHeight * 0.57,
      8,
      col(SNOW),
    )
  }

  if (options.lights) {
    const count = Math.round(height * 7)
    for (let i = 0; i < count; i++) {
      const y = base + height * (0.2 + (0.7 * (i + 0.5)) / count)
      // Die Lämpchen sitzen auf der äußersten Kegelstufe in dieser Höhe.
      let surface = 0
      for (let tier = 0; tier < tiers; tier++) {
        const t = (y - tierBase(tier)) / tierHeight
        if (t >= 0 && t <= 1) surface = Math.max(surface, tierRadius(tier) * (1 - t))
      }
      const angle = i * 2.4
      addBulb(
        builders,
        x + Math.cos(angle) * (surface + 0.04),
        y,
        z + Math.sin(angle) * (surface + 0.04),
        options.lights[i % options.lights.length],
        0.05,
      )
    }
  }

  if (options.star) {
    const top = base + height * 1.06 + 0.06
    const light = decoGlow(rnd, 0.3)
    glow.star(x, top, z, 0.14, 0.06, 5, col(GOLD), light)
    halo.billboard(x, top, z, 0.9, 0.9, haloOf(col(GOLD), 0.5), light)
  }
}

export function addSnowman(
  { solid }: Builders,
  x: number,
  z: number,
  accent: THREE.Color,
  s = 1,
): void {
  const snow = col(SNOW)
  const coal = col(COAL)
  solid.sphere(x, 0.34 * s, z, 0.4 * s, 0.37 * s, 0.4 * s, snow)
  solid.sphere(x, 0.87 * s, z, 0.3 * s, 0.28 * s, 0.3 * s, snow)
  solid.sphere(x, 1.28 * s, z, 0.22 * s, 0.21 * s, 0.22 * s, snow)

  for (const side of [-1, 1]) {
    solid.sphere(x + side * 0.08 * s, 1.33 * s, z + 0.2 * s, 0.03 * s, 0.03 * s, 0.03 * s, coal)
    solid.box(x + side * 0.43 * s, 0.99 * s, z, 0.42 * s, 0.035 * s, 0.035 * s, col(WOOD_DARK), {
      z: side * -0.5,
    })
  }
  for (const y of [0.76, 0.93]) {
    solid.sphere(x, y * s, z + 0.29 * s, 0.032 * s, 0.032 * s, 0.032 * s, coal)
  }
  solid.cylinder(x, 1.27 * s, z + 0.3 * s, 0.045 * s, 0, 0.22 * s, 6, col(CARROT), { x: Math.PI / 2 })

  // Schal und Zylinder
  solid.cylinder(x, 1.09 * s, z, 0.24 * s, 0.24 * s, 0.09 * s, 10, accent)
  solid.box(x + 0.14 * s, 0.94 * s, z + 0.21 * s, 0.09 * s, 0.3 * s, 0.04 * s, accent, { z: -0.2 })
  solid.cylinder(x, 1.47 * s, z, 0.25 * s, 0.25 * s, 0.035 * s, 10, coal)
  solid.cylinder(x, 1.6 * s, z, 0.16 * s, 0.15 * s, 0.24 * s, 10, coal)
  solid.cylinder(x, 1.52 * s, z, 0.168 * s, 0.168 * s, 0.05 * s, 10, accent)
}

export function addGift(
  { solid, rnd }: Builders,
  x: number,
  yBase: number,
  z: number,
  width: number,
  height: number,
  depth: number,
): void {
  const paper = col(rnd.pick(GIFT_COLORS))
  const ribbon = col(rnd.pick(['#f2c14e', '#fff6e6', '#c4463c']))
  const turn = { y: rnd.range(-0.4, 0.4) }
  const y = yBase + height / 2
  solid.box(x, y, z, width, height, depth, paper, turn)
  solid.box(x, y, z, width * 0.2, height + 0.012, depth + 0.012, ribbon, turn)
  solid.box(x, y, z, width + 0.012, height + 0.012, depth * 0.2, ribbon, turn)
  for (const side of [-1, 1]) {
    solid.sphere(x + side * 0.05, yBase + height + 0.03, z, 0.06, 0.04, 0.045, ribbon)
  }
}

export function addGiftPile(builders: Builders, x: number, z: number, s = 1): void {
  addGift(builders, x - 0.2 * s, 0, z, 0.44 * s, 0.4 * s, 0.4 * s)
  addGift(builders, x + 0.24 * s, 0, z + 0.06 * s, 0.34 * s, 0.26 * s, 0.32 * s)
  addGift(builders, x - 0.16 * s, 0.4 * s, z, 0.26 * s, 0.2 * s, 0.26 * s)
}

/** Schlitten, der an der Hauswand lehnt. */
export function addSled({ solid }: Builders, x: number, z: number): void {
  const lean = new THREE.Matrix4()
    .makeTranslation(x, 0, z)
    .multiply(new THREE.Matrix4().makeRotationX(-0.27))
  solid.within(lean, () => {
    for (const side of [-1, 1]) {
      solid.box(side * 0.2, 0.62, -0.05, 0.04, 1.24, 0.05, col(BERRY))
      solid.box(side * 0.2, 0.62, 0, 0.05, 1.05, 0.05, col(WOOD_DARK))
    }
    for (let slat = 0; slat < 4; slat++) {
      solid.box(0, 0.26 + slat * 0.27, 0.035, 0.52, 0.16, 0.03, col(WOOD))
    }
  })
}

export function addBush(builders: Builders, x: number, z: number, lights?: readonly THREE.Color[]): void {
  const { solid, rnd } = builders
  const lumps: [number, number, number, number][] = [
    [x - 0.26, 0.26, z, 0.34],
    [x + 0.24, 0.22, z + 0.04, 0.3],
    [x, 0.44, z - 0.06, 0.36],
  ]
  lumps.forEach(([lx, ly, lz, radius], index) => {
    solid.sphere(lx, ly, lz, radius, radius * 0.9, radius, col(PINE[index % PINE.length]))
    solid.sphere(lx, ly + radius * 0.58, lz, radius * 0.78, radius * 0.4, radius * 0.78, col(SNOW))
  })
  if (lights) {
    for (let i = 0; i < 7; i++) {
      const [lx, ly, lz, radius] = lumps[i % lumps.length]
      const angle = rnd.range(0.3, Math.PI - 0.3)
      addBulb(
        builders,
        lx + Math.cos(angle) * radius * 0.8,
        ly + rnd.range(-0.1, 0.2),
        lz + Math.sin(angle) * radius * 0.95,
        lights[i % lights.length],
        0.05,
      )
    }
  }
}

/** Zuckerstange; `side` bestimmt, wohin der Haken zeigt. */
export function addCandyCane({ solid }: Builders, x: number, z: number, side: number): void {
  const red = col('#d9483e')
  const white = col('#fff7ee')
  const radius = 0.045
  const tilt = new THREE.Matrix4()
    .makeTranslation(x, 0, z)
    .multiply(new THREE.Matrix4().makeRotationZ(side * 0.16))
  solid.within(tilt, () => {
    const segments = 7
    for (let i = 0; i < segments; i++) {
      solid.cylinder(0, 0.065 + i * 0.13, 0, radius, radius, 0.13, 6, i % 2 === 0 ? red : white)
    }
    const top = segments * 0.13
    const hook = 0.12
    for (let i = 1; i <= 5; i++) {
      const angle = (i * Math.PI) / 5.5
      solid.cylinder(
        -side * (hook - hook * Math.cos(angle)),
        top + hook * Math.sin(angle),
        0,
        radius,
        radius,
        0.085,
        6,
        i % 2 === 0 ? white : red,
        { z: side * angle },
      )
    }
  })
}

/** Kleine Laterne, die auf dem Boden steht. */
export function addGroundLantern({ solid, glow, halo, rnd }: Builders, x: number, z: number): void {
  const iron = col(IRON)
  const light = decoGlow(rnd, 0.22)
  const warm = col(LANTERN_LIGHT)
  solid.box(x, 0.03, z, 0.26, 0.06, 0.26, iron)
  glow.box(x, 0.22, z, 0.16, 0.3, 0.16, warm, undefined, light)
  for (const dx of [-0.1, 0.1]) {
    for (const dz of [-0.1, 0.1]) solid.box(x + dx, 0.22, z + dz, 0.03, 0.34, 0.03, iron)
  }
  solid.pyramid(x, 0.39, z, 0.32, 0.15, 0.32, iron)
  solid.sphere(x, 0.52, z, 0.13, 0.05, 0.13, col(SNOW))
  halo.billboard(x, 0.24, z, 1.5, 1.5, haloOf(warm, 0.5), light)
  halo.quad(x, 0.05, z + 0.15, 2, 2, haloOf(warm, 0.26), { x: -Math.PI / 2 }, light)
}

/** Laterne an der Hauswand neben der Tür. */
export function addWallLantern(
  { solid, glow, halo, rnd }: Builders,
  x: number,
  y: number,
  z: number,
): void {
  const iron = col(IRON)
  const light = decoGlow(rnd, 0.18)
  const warm = col(LANTERN_LIGHT)
  solid.box(x, y + 0.02, z - 0.06, 0.05, 0.05, 0.14, iron)
  solid.box(x, y - 0.14, z + 0.04, 0.17, 0.04, 0.17, iron)
  glow.box(x, y, z + 0.04, 0.12, 0.24, 0.12, warm, undefined, light)
  solid.pyramid(x, y + 0.12, z + 0.04, 0.22, 0.12, 0.22, iron)
  halo.billboard(x, y, z + 0.04, 1.3, 1.3, haloOf(warm, 0.5), light)
}

/** Schneehaufen (halb im Boden versunkene Kugel). */
export function addMound(
  { solid }: Builders,
  x: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
): void {
  solid.sphere(x, 0, z, rx, ry, rz, col(SNOW))
}

const WREATH_RADIUS = 0.58
const WREATH_TUBE = 0.12

/** Radius des Selfies, das im Kranz erscheint. */
export const PHOTO_RADIUS = 0.47

/**
 * Kranz mit Schleife und Lämpchen an einer nach vorn (+z) zeigenden Wand.
 * Liefert die Stelle in seiner Mitte, an der später das Selfie hängt.
 */
export function addWreath(
  builders: Builders,
  x: number,
  y: number,
  wall = 0,
): { x: number; y: number; z: number } {
  const { solid, rnd } = builders
  const z = wall + 0.1
  solid.torus(x, y, z, WREATH_RADIUS, WREATH_TUBE, col(PINE[0]))
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + rnd.range(-0.08, 0.08)
    const radius = WREATH_RADIUS + (i % 2 === 0 ? 0.05 : -0.04)
    solid.sphere(
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      z + 0.05,
      0.1,
      0.1,
      0.08,
      col(PINE[1 + (i % 2)]),
    )
  }
  for (let i = 0; i < 7; i++) {
    const angle = rnd.range(0, Math.PI * 2)
    solid.sphere(
      x + Math.cos(angle) * WREATH_RADIUS,
      y + Math.sin(angle) * WREATH_RADIUS,
      z + 0.13,
      0.045,
      0.045,
      0.045,
      col(BERRY),
    )
  }

  // Schleife
  const bow = col(BERRY)
  const knot = y - WREATH_RADIUS
  for (const side of [-1, 1]) {
    solid.box(x + side * 0.13, knot + 0.02, z + 0.14, 0.24, 0.13, 0.04, bow, { z: side * -0.45 })
    solid.box(x + side * 0.07, knot - 0.17, z + 0.13, 0.08, 0.26, 0.03, bow, { z: side * 0.25 })
  }
  solid.box(x, knot, z + 0.16, 0.1, 0.1, 0.05, shade(BERRY, -0.08))

  const warm = col('#ffe2a0')
  for (let i = 0; i < 10; i++) {
    const angle = ((i + 0.5) / 10) * Math.PI * 2
    addBulb(
      builders,
      x + Math.cos(angle) * WREATH_RADIUS,
      y + Math.sin(angle) * WREATH_RADIUS,
      z + 0.17,
      warm,
      0.045,
    )
  }
  return { x, y, z: wall + 0.07 }
}

/** Adventskranz an der Hauswand mit vier Kerzen entlang des unteren Kranzbogens. */
export function addAdventWreath(
  builders: Builders,
  x: number,
  y: number,
  /** Je Kerze (links nach rechts) eigene Builder für Flamme und Lichthof – so lässt sich jede einzeln anzünden. */
  flames: readonly { glow: Builder; halo: Builder }[],
): { x: number; y: number; z: number } {
  const photo = addWreath(builders, x, y)
  const { solid, rnd } = builders
  const wax = col(BERRY)
  const flame = col('#ffb342')
  const core = col('#fff1b0')
  const z = 0.3
  const height = 0.3

  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 0.3
    const cx = x + dx
    const base = y - Math.sqrt(WREATH_RADIUS ** 2 - dx ** 2) + 0.08
    const top = base + height
    solid.cylinder(cx, base, z, 0.1, 0.1, 0.035, 12, col(GOLD))
    solid.cylinder(cx, base + height / 2, z, 0.075, 0.075, height, 12, wax)
    solid.cylinder(cx, top, z, 0.068, 0.068, 0.012, 12, col('#f7dfb5'))
    solid.box(cx, top + 0.025, z, 0.018, 0.05, 0.018, col(COAL))

    const target = flames[i]
    if (!target) continue
    const { glow, halo } = target
    const light = decoGlow(rnd, 0.18)
    glow.cylinder(cx, top + 0.09, z, 0.055, 0, 0.16, 8, flame, undefined, light)
    glow.cylinder(cx, top + 0.065, z + 0.025, 0.028, 0, 0.1, 8, core, undefined, light)
    halo.billboard(cx, top + 0.09, z + 0.03, 0.55, 0.65, haloOf(flame, 0.35), light)
  }

  return photo
}
