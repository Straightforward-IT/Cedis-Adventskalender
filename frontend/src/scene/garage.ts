import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import { BERRY, BULB_COLORS, GOLD, PINE, SNOW, WOOD, WOOD_DARK, col } from './palette.ts'
import { addBulb, addFir, addGift } from './props.ts'
import type { Builders } from './props.ts'

/**
 * Die Garage in der Einfahrt zwischen Haus 14 und 15 – mit Basketballkorb über dem Tor
 * („Weihnachtskugelball“). Ursprung am Boden in der Mitte der Lücke, auf Höhe der Hausfronten
 * (z = 0); das Tor zeigt zur Straße (+z).
 */
export const GARAGE = {
  width: 3.8,
  /** Vorderwand mit dem Tor. */
  front: -0.6,
  back: -6.1,
  wallHeight: 2.55,
  ridge: 3.4,
  doorWidth: 2.7,
  doorHeight: 2.15,
  /** So weit ist das Tor hochgeschoben (Spalt unten). */
  doorOpen: 0.58,
}

/** Hausnummernschild am rechten Torpfeiler – die Garage gehört zu Haus 14. */
export const GARAGE_PLAQUE = { x: 1.66, y: 1.62, z: GARAGE.front + 0.02, radius: 0.18 }

/** Brett und Korb über dem Garagentor (Korbmitte, Radius, Rohrstärke). */
export const HOOP = { x: 0, y: 3.05, z: 0.4, radius: 0.23, tube: 0.018 }
export const BOARD = { width: 1.1, bottom: 2.75, top: 3.5, front: 0.02, back: -0.02 }

const WALL = '#d9cdbf'
const WALL_DARK = '#b8a996'
const DOOR = '#f3ede2'
const DOOR_GROOVE = '#d3c8b8'
const ROOF = '#7a4a3a'
const INSIDE = '#5b4c44'

function addBuilding({ solid }: Builders): void {
  const { width, front, back, wallHeight, ridge } = GARAGE
  const depth = front - back
  const midZ = (front + back) / 2
  const wall = col(WALL)
  const dark = col(WALL_DARK)
  const snow = col(SNOW)

  // Hohl gebaut, damit man durch das halb offene Tor hineinschauen kann:
  // Seiten- und Rückwand, Decke, Boden und eine Vorderwand mit Toröffnung.
  const inside = col(INSIDE)
  const t = 0.12
  for (const side of [-1, 1]) solid.box(side * (width / 2 - t / 2), wallHeight / 2, midZ, t, wallHeight, depth, [dark, wall])
  solid.box(0, wallHeight / 2, back + t / 2, width, wallHeight, t, [dark, wall])
  solid.box(0, wallHeight - 0.04, midZ, width - 2 * t, 0.08, depth - 2 * t, inside)
  solid.quad(0, 0.012, midZ, width - 2 * t, depth - 2 * t, col('#8c8a94'), { x: -Math.PI / 2 })
  // Innen etwas dunkler – die Wände von innen
  for (const side of [-1, 1]) solid.quad(side * (width / 2 - t - 0.001), wallHeight / 2, midZ, depth - 2 * t, wallHeight, inside, { y: -side * Math.PI / 2 })
  solid.quad(0, wallHeight / 2, back + t + 0.001, width - 2 * t, wallHeight, inside)
  const doorHalf = GARAGE.doorWidth / 2 + 0.07
  const pier = width / 2 - doorHalf
  for (const side of [-1, 1]) solid.box(side * (doorHalf + pier / 2), wallHeight / 2, front - t / 2, pier, wallHeight, t, [dark, wall])
  const lintel = wallHeight - GARAGE.doorHeight - 0.08
  solid.box(0, wallHeight - lintel / 2, front - t / 2, doorHalf * 2, lintel, t, wall)
  for (const side of [-1, 1]) solid.box(side * (doorHalf + pier / 2), 0.12, front + 0.01, pier + 0.02, 0.24, 0.04, dark)

  // Giebel vorn und hinten (Dreiecke) und das Satteldach mit Schnee
  for (const z of [front + 0.001, back - 0.001]) {
    solid.polygon([[-width / 2, wallHeight], [width / 2, wallHeight], [0, ridge]], z, wall, { flip: z < front })
  }
  const run = width / 2 + 0.25
  const rise = ridge - wallHeight
  const slope = Math.atan2(rise, run)
  const length = Math.hypot(run, rise)
  for (const side of [-1, 1]) {
    const cx = (side * run) / 2
    const cy = wallHeight + rise / 2 - 0.02
    solid.box(cx, cy, midZ, length, 0.08, depth + 0.5, col(ROOF), { z: -side * slope })
    solid.box(cx, cy + 0.08, midZ, length - 0.05, 0.08, depth + 0.45, snow, { z: -side * slope })
  }

  // Sektionaltor, ein Stück hochgeschoben: Unten bleibt ein Spalt, durch den man hineinlugt.
  const door = col(DOOR)
  const groove = col(DOOR_GROOVE)
  const dz = front - 0.02
  const open = GARAGE.doorOpen
  const top = GARAGE.doorHeight + 0.02
  const frame = col(WALL_DARK)
  for (const side of [-1, 1]) solid.box(side * (GARAGE.doorWidth / 2 + 0.04), top / 2, front + 0.005, 0.07, top, 0.03, frame)
  solid.box(0, top + 0.03, front + 0.005, GARAGE.doorWidth + 0.15, 0.06, 0.03, frame)
  solid.box(0, (open + top) / 2, dz, GARAGE.doorWidth, top - open, 0.03, door)
  for (let i = 1; i < 4; i++) solid.box(0, open + ((top - open) * i) / 4, dz + 0.017, GARAGE.doorWidth - 0.04, 0.025, 0.01, groove)
  solid.box(0, open + 0.03, dz + 0.017, GARAGE.doorWidth - 0.02, 0.05, 0.012, col('#8b93a8'))
  solid.box(0, open + 0.16, dz + 0.03, 0.34, 0.05, 0.04, col('#8b93a8'))

  // Holzscheibe für das Nummernschild (die Nummer selbst malt die Straße aus dem Nummernatlas)
  solid.disc(GARAGE_PLAQUE.x, GARAGE_PLAQUE.y, GARAGE_PLAQUE.z - 0.01, GARAGE_PLAQUE.radius + 0.04, col(WOOD_DARK), { segments: 24 })

  // Einfahrt: gepflasterter Streifen bis zum Gehweg
  solid.quad(0, 0.016, (front + 1.3) / 2, GARAGE.doorWidth + 0.5, 1.3 - front, col('#c3c8da'), { x: -Math.PI / 2 })
  for (let z = front + 0.4; z < 1.3; z += 0.45) solid.quad(0, 0.018, z, GARAGE.doorWidth + 0.5, 0.03, col('#b0b6ca'), { x: -Math.PI / 2 })
}

function addHoop({ solid }: Builders): void {
  const white = col('#fbfbff')
  const red = col(BERRY)
  const metal = col('#596074')

  // Halterung von der Wand zum Brett
  for (const side of [-1, 1]) {
    solid.box(side * 0.35, BOARD.bottom + 0.15, (GARAGE.front + BOARD.back) / 2, 0.05, 0.05, BOARD.back - GARAGE.front, metal)
  }
  // Brett mit rotem Quadrat
  const boardY = (BOARD.bottom + BOARD.top) / 2
  const boardH = BOARD.top - BOARD.bottom
  solid.box(0, boardY, (BOARD.front + BOARD.back) / 2, BOARD.width, boardH, BOARD.front - BOARD.back, white)
  const sq = { y: HOOP.y + 0.2, w: 0.46, h: 0.34, t: 0.03 }
  const fz = BOARD.front + 0.004
  solid.box(0, sq.y + sq.h / 2, fz, sq.w, sq.t, 0.006, red)
  solid.box(0, sq.y - sq.h / 2 + 0.01, fz, sq.w, sq.t, 0.006, red)
  for (const side of [-1, 1]) solid.box((side * sq.w) / 2, sq.y, fz, sq.t, sq.h, 0.006, red)
  // Rand des Bretts
  solid.box(0, BOARD.top, fz, BOARD.width, 0.03, 0.008, red)
  solid.box(0, BOARD.bottom, fz, BOARD.width, 0.03, 0.008, red)

  // Ring wie eine Zuckerstange: rot-weiß gestreift, waagerecht
  const ring = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(HOOP.x, HOOP.y, HOOP.z)
  solid.within(ring, () => solid.torus(0, 0, 0, HOOP.radius, HOOP.tube, red))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    solid.sphere(HOOP.x + Math.cos(a) * HOOP.radius, HOOP.y, HOOP.z + Math.sin(a) * HOOP.radius, 0.022, 0.022, 0.022, white)
  }
  solid.box(0, HOOP.y - 0.03, (BOARD.front + HOOP.z - HOOP.radius) / 2, 0.08, 0.04, HOOP.z - HOOP.radius - BOARD.front + 0.02, red)

  // Netz: zwölf Schnüre, die sich nach unten verjüngen, und zwei Querringe
  const top = HOOP.y - 0.01
  const bottom = HOOP.y - 0.42
  const r2 = HOOP.radius * 0.6
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const m = new THREE.Matrix4().makeRotationY(-a).setPosition(HOOP.x, 0, HOOP.z)
    solid.within(m, () => {
      const tilt = -Math.atan((HOOP.radius - r2) / (top - bottom))
      solid.cylinder((HOOP.radius + r2) / 2, (top + bottom) / 2, 0, 0.005, 0.005, Math.hypot(top - bottom, HOOP.radius - r2), 4, white, { z: tilt })
    })
  }
  for (const [y, r] of [[top - 0.16, HOOP.radius * 0.84], [bottom + 0.02, r2]] as const) {
    solid.within(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(HOOP.x, y, HOOP.z), () => solid.torus(0, 0, 0, r, 0.005, white))
  }
}

/**
 * Was durch den Torspalt zu sehen ist: ein roter Holzschlitten mit Geschenk, schräg geparkt,
 * dazu Schneeschaufel und Skier an der Wand.
 */
function addInterior(b: Builders): void {
  const { solid } = b
  const red = col(BERRY)
  const wood = col(WOOD)
  const woodDark = col(WOOD_DARK)
  const sled = new THREE.Matrix4().makeRotationY(-0.45).setPosition(0.35, 0, GARAGE.front - 1.35)
  solid.within(sled, () => {
    // Kufen mit hochgebogener Spitze
    for (const side of [-1, 1]) {
      solid.box(side * 0.24, 0.04, 0, 0.05, 0.05, 1.1, red)
      solid.box(side * 0.24, 0.14, 0.6, 0.05, 0.05, 0.24, red, { x: -0.9 })
      solid.sphere(side * 0.24, 0.24, 0.66, 0.035, 0.035, 0.035, red)
      for (const z of [-0.35, 0, 0.35]) solid.box(side * 0.24, 0.17, z, 0.04, 0.22, 0.04, woodDark)
    }
    // Sitzfläche aus Latten
    for (let i = 0; i < 5; i++) solid.box(0, 0.3, -0.42 + i * 0.2, 0.6, 0.04, 0.15, wood)
    solid.box(0, 0.33, 0.42, 0.62, 0.05, 0.05, red)
  })
  addGift(b, 0.25, 0.32, GARAGE.front - 1.4, 0.3, 0.24, 0.26)
  // Schaufel und Skier an der linken Wand
  const wallX = -GARAGE.width / 2 + 0.2
  solid.box(wallX, 0.75, GARAGE.front - 0.9, 0.04, 1.3, 0.04, woodDark, { z: -0.12 })
  solid.box(wallX + 0.08, 0.14, GARAGE.front - 0.9, 0.04, 0.28, 0.32, col('#c9ccd8'), { z: -0.12 })
  for (const [dz, color] of [[-1.5, '#2f7fd1'], [-1.62, '#d9a441']] as const) {
    solid.box(wallX, 0.85, GARAGE.front + dz, 0.03, 1.7, 0.09, col(color), { z: -0.1 })
  }
}

/** Tannenzweige, Schleife und Lichter an Brett und Ring. */
function addHoopDecoration(b: Builders): void {
  const { solid, rnd } = b
  const pine = PINE.map(col)
  const bulbs = BULB_COLORS.multi.map(col)

  // Tannenzweige auf der Oberkante des Bretts und rund um den Ring
  for (let i = 0; i <= 14; i++) {
    const x = -BOARD.width / 2 + (i / 14) * BOARD.width
    solid.sphere(x, BOARD.top + 0.05, BOARD.front, 0.08, 0.06, 0.07, pine[i % pine.length])
    if (i % 2 === 0) addBulb(b, x, BOARD.top + 0.03, BOARD.front + 0.07, bulbs[(i / 2) % bulbs.length], 0.035, 0.6)
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI + Math.PI
    // Zweige nur auf der hinteren Hälfte des Rings, damit Würfe frei durchgehen
    solid.sphere(HOOP.x + Math.cos(a) * (HOOP.radius + 0.04), HOOP.y + 0.02, HOOP.z + Math.sin(a) * (HOOP.radius + 0.04) - 0.02, 0.05, 0.035, 0.05, pine[i % pine.length])
  }
  // Rote Schleife oben auf dem Brett
  for (const side of [-1, 1]) solid.sphere(side * 0.1, BOARD.top + 0.14, BOARD.front + 0.04, 0.1, 0.07, 0.03, col(BERRY))
  solid.sphere(0, BOARD.top + 0.14, BOARD.front + 0.06, 0.045, 0.045, 0.04, col('#9c2f28'))
  for (const side of [-1, 1]) solid.box(side * 0.06, BOARD.top + 0.02, BOARD.front + 0.05, 0.05, 0.2, 0.012, col(BERRY), { z: side * 0.35 })

  // ein paar Zufallsflöckchen Schnee auf der Halterung
  for (let i = 0; i < 4; i++) solid.sphere(rnd.range(-0.4, 0.4), BOARD.bottom + 0.18, BOARD.back - 0.15, 0.04, 0.02, 0.04, col(SNOW))
}

/** Girlanden, Lichter, Tännchen und Geschenke an der Garage. */
function addDecoration(b: Builders): void {
  const { solid } = b
  const pine = PINE.map(col)
  const bulbs = BULB_COLORS.multi.map(col)
  const warm = col('#ffd27a')

  // Girlande mit Lichtern entlang der Dachkanten vorn
  const { width, wallHeight, ridge, front } = GARAGE
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const side = t < 0.5 ? -1 : 1
    const k = t < 0.5 ? t * 2 : (1 - t) * 2
    const x = side * (width / 2 + 0.2) * (1 - k)
    const y = wallHeight - 0.02 + (ridge - wallHeight) * k
    solid.sphere(x, y, front + 0.08, 0.09, 0.07, 0.07, pine[i % pine.length])
    if (i % 2 === 1) addBulb(b, x, y - 0.06, front + 0.16, warm, 0.04, 0.4)
  }
  // Girlande über dem Tor
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const x = -GARAGE.doorWidth / 2 + t * GARAGE.doorWidth
    const y = GARAGE.doorHeight + 0.12 - Math.sin(t * Math.PI * 2) ** 2 * 0.12
    solid.sphere(x, y, front + 0.09, 0.07, 0.06, 0.06, pine[i % pine.length])
    if (i % 2 === 0) addBulb(b, x, y - 0.05, front + 0.15, bulbs[(i / 2) % bulbs.length], 0.035, 0.6)
  }

  // Tännchen in Kübeln links und rechts des Tors, Geschenke daneben
  for (const side of [-1, 1]) {
    const x = side * (GARAGE.doorWidth / 2 + 0.38)
    addFir(b, x, front + 0.35, 1.15, { lights: [warm], pot: true })
  }
  addGift(b, -GARAGE.doorWidth / 2 - 0.15, 0, front + 0.85, 0.32, 0.26, 0.3)
  addGift(b, GARAGE.doorWidth / 2 + 0.1, 0, front + 0.9, 0.26, 0.22, 0.26)

  // Lampe über dem Tor-Eck und ein Stern im Giebel
  solid.box(-1.55, 2.1, front + 0.08, 0.12, 0.2, 0.12, col(WOOD_DARK))
  addBulb(b, -1.55, 2.0, front + 0.16, warm, 0.06, 0.1)
  solid.star(0, ridge - 0.32, front + 0.02, 0.18, 0.08, 5, col(GOLD))
}

/**
 * Der Korb samt Brett, Halterung und Schmuck als eigene Geometrie – er hängt erst ab Tag 14
 * an der Garage (im Spiel schlägt ihn ein Hammer an). Koordinaten wie die Garage.
 */
export function buildHoop(): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry; halo: THREE.BufferGeometry } {
  const b: Builders = { solid: new Builder(), glow: new Builder(), halo: new Builder(), rnd: createRandom(hashSeed(14, 'korb')) }
  addHoop(b)
  addHoopDecoration(b)
  return { solid: b.solid.batch.build('lit'), glow: b.glow.batch.build('glow'), halo: b.halo.batch.build('glow') }
}

/** Hier ist die Halterung an der Wand verschraubt – um diesen Punkt kippt der Korb beim Anbringen. */
export const HOOP_MOUNT = new THREE.Vector3(0, BOARD.bottom + 0.15, GARAGE.front)

/** Baut Garage und Weihnachtsschmuck (ohne Korb) bei `x` in die Umgebung ein. */
export function addGarage(builders: Builders, x: number): void {
  const at = new THREE.Matrix4().makeTranslation(x, 0, 0)
  // Alle drei Sammler (Flächen, Lichter, Lichthöfe) werden gemeinsam verschoben.
  builders.solid.within(at, () =>
    builders.glow.within(at, () =>
      builders.halo.within(at, () => {
        addBuilding(builders)
        addInterior(builders)
        addDecoration(builders)
      }),
    ),
  )
}
