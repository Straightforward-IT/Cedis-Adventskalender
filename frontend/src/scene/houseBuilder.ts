import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import type { Random } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import type { Glow, Point } from './batch.ts'
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  GROUND_FLOOR,
  UPPER_FLOOR,
  bodyHeight,
  columnSpacing,
  columnX,
  ridgeHeight,
  wreathSpot,
} from './houseSpec.ts'
import type { HouseSpec } from './houseSpec.ts'
import {
  BULB_COLORS,
  DARK_GLASS,
  GOLD,
  ICE,
  IRON,
  PINE,
  SNOW,
  STONE,
  WINDOW_LIGHTS,
  WOOD_DARK,
  col,
  shade,
} from './palette.ts'
import {
  addAdventWreath,
  addBulb,
  addBush,
  addCandyCane,
  addFir,
  addGiftPile,
  addMound,
  addSled,
  addSnowman,
  addWallLantern,
  decoGlow,
  haloOf,
} from './props.ts'
import type { Builders } from './props.ts'

const ROOF_THICKNESS = 0.14
const FRONT_OVERHANG = 0.3
const SIDE_OVERHANG = 0.24
const HINGE_Z = 0.06
const WINDOW_HALO = '#ffb65a'
const CHIMNEY_BRICK = '#9c5c4b'
/** Adventssonntage: Hausnummer und Anzahl der brennenden Kerzen. */
/** Häuser mit Adventskranz (die Adventssonntage 2026). Wie viele Kerzen brennen, entscheidet das Datum. */
const ADVENT_WREATHS = new Set([6, 13, 20])
/**
 * Schaufenster: In diesem Stockwerk bleiben die Fenster ohne Deko und immer hell –
 * dahinter fährt nach dem Lösen ein Förderband mit Kuchen (Haus 1, Weihnachtsbäckerei)
 * oder hüpft ein kleiner Santa von Keks zu Keks (Haus 15, oberstes Stockwerk).
 */
const SHOWCASE_FLOORS: Partial<Record<number, number | 'top'>> = { 1: 1, 15: 'top' }
/**
 * Kaminfenster: oberstes Stockwerk, rechte Fensterachse – immer hell und ohne Deko.
 * Dahinter sitzt nach dem Holzhacken (Haus 10) ein Wichtel am Kamin.
 */
const HEARTH_HOUSES = new Set([10])
/**
 * Häuser mit Balkon zur Straße: Im ersten Obergeschoss wird das rechte Fenster zur
 * Balkontür, davor ein schneebedeckter Balkon mit Geländer (Haus 12 – dort geht es
 * im Spiel über den Balkon wieder hinaus – und Haus 16).
 */
const BALCONY_HOUSES = new Set([12, 16])
const BALCONY_DEPTH = 0.95
/** Abstand der Zuckerstangen von der Türmitte – außerhalb des Schwenkbereichs der Tür. */
const CANE_BESIDE = 1.2

/** Rechteckiger Teil eines Schaufensters samt seinem Lichtverlauf (unten, oben). */
export interface ShowcaseWindow {
  x: number
  y: number
  width: number
  height: number
  light: readonly [THREE.Color, THREE.Color]
}

/** Stellen am Haus, die die Szene später braucht (alle im Koordinatensystem des Hauses). */
export interface HouseAnchors {
  /** Höchster Punkt des Dachs. */
  height: number
  /** Scharnier der Haustür – um diesen Punkt schwingt sie auf. */
  hinge: THREE.Vector3
  doorX: number
  plaque: { x: number; y: number; z: number; radius: number }
  photo: { x: number; y: number; z: number }
  /** Schornsteinöffnung, aus der Rauch aufsteigt. */
  smoke: THREE.Vector3 | null
  /** Schaufenster eines Stockwerks (von links nach rechts), sonst leer. */
  showcase: ShowcaseWindow[]
  /** Fenster oben rechts, hinter dem der Kamin brennt (nur bei Häusern in `HEARTH_HOUSES`). */
  hearth: ShowcaseWindow | null
  /** Vordere Dachkante (von links nach rechts) – dort hängt z. B. die Lichterkette aus Haus 3. */
  eaves: { points: Point[]; z: number }
  /** Mitte des Balkonbodens (Oberkante), falls das Haus einen Balkon hat. */
  balcony: THREE.Vector3 | null
  /** Alle Fenster der Fassade – z. B. für die vereisten Scheiben von Haus 9. */
  windows: WindowRect[]
}

/** Ein Fenster der Fassade: Mitte unten (x, Brüstung y), Breite und Gesamthöhe samt Bogen. */
export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
  arched: boolean
}

export interface HouseGeometry {
  solid: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  halo: THREE.BufferGeometry
  /** Türblatt, relativ zum Scharnier. */
  door: THREE.BufferGeometry
  doorGlow: THREE.BufferGeometry | null
  /** Flammen der vier Adventskerzen von links nach rechts (falls das Haus einen Adventskranz hat). */
  candles: { glow: THREE.BufferGeometry; halo: THREE.BufferGeometry }[] | null
  anchors: HouseAnchors
}

/** Verlängert ein Dachprofil an beiden Enden um den Dachüberstand (waagerecht gemessen). */
export function extendEaves(profile: readonly Point[], overhang: number): Point[] {
  const extended = profile.map(([x, y]): [number, number] => [x, y])
  const stretch = (end: [number, number], inner: Point) => {
    const dx = end[0] - inner[0]
    const factor = overhang / Math.abs(dx)
    end[1] += (end[1] - inner[1]) * factor
    end[0] += dx * factor
  }
  stretch(extended[0], profile[1])
  stretch(extended[extended.length - 1], profile[profile.length - 2])
  return extended
}

/** Gleichmäßig verteilte Punkte entlang eines Linienzugs (z. B. für eine Lichterkette). */
export function samplePolyline(points: readonly Point[], spacing: number): Point[] {
  const samples: Point[] = []
  let offset = spacing / 2
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const length = Math.hypot(x1 - x0, y1 - y0)
    while (offset <= length) {
      const t = offset / length
      samples.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
      offset += spacing
    }
    offset -= length
  }
  return samples
}

class HouseBuilder {
  private readonly spec: HouseSpec
  private readonly rnd: Random
  private readonly solid = new Builder()
  private readonly glow = new Builder()
  private readonly halo = new Builder()
  private readonly door = new Builder()
  private readonly doorGlow = new Builder()
  /** Kerzenflammen am Adventskranz – je Kerze eigene Geometrie, angezündet wird nach Datum. */
  private readonly flames = Array.from({ length: 4 }, () => ({ glow: new Builder(), halo: new Builder() }))
  private readonly builders: Builders

  private readonly w: number
  private readonly d: number
  private readonly bodyH: number
  private readonly doorX: number
  private readonly wall: THREE.Color
  private readonly trim: THREE.Color
  private readonly roofColor: THREE.Color
  private readonly snow = col(SNOW)
  private readonly bulbs: readonly THREE.Color[]

  /** Vordere Dachkante – an ihr hängen Lichterketten und Eiszapfen. */
  private edge: { points: Point[]; z: number } = { points: [], z: 0 }
  private readonly windowRects: WindowRect[] = []
  private readonly showcase: ShowcaseWindow[] = []
  private hearth: ShowcaseWindow | null = null
  private balcony: THREE.Vector3 | null = null
  private smoke: THREE.Vector3 | null = null
  private top: number

  constructor(spec: HouseSpec) {
    this.spec = spec
    this.rnd = createRandom(hashSeed(spec.seed, 'bau'))
    this.builders = { solid: this.solid, glow: this.glow, halo: this.halo, rnd: this.rnd }
    this.w = spec.width
    this.d = spec.depth
    this.bodyH = bodyHeight(spec)
    this.doorX = columnX(spec, spec.door.column)
    this.wall = col(spec.wall.color)
    this.trim = col(spec.wall.trim)
    this.roofColor = col(spec.roof.color)
    this.bulbs = BULB_COLORS[spec.lights.palette].map(col)
    // Über dem First liegen noch die Schneedecke und ihr runder Wulst.
    this.top = ridgeHeight(spec) + spec.roof.snow * 1.3 + 0.2
  }

  build(): HouseGeometry {
    this.body()
    this.roof()
    this.wallDetails()
    this.facade()
    const plaque = this.doorway()
    const photo = this.wreath()
    this.lights()
    this.icicles()
    this.chimney()
    this.peakStar()
    this.yard()

    return {
      solid: this.solid.batch.build('lit'),
      glow: this.glow.batch.build('glow'),
      halo: this.halo.batch.build('glow'),
      door: this.door.batch.build('lit'),
      doorGlow: this.doorGlow.batch.isEmpty ? null : this.doorGlow.batch.build('glow'),
      candles: this.flames[0].glow.batch.isEmpty
        ? null
        : this.flames.map((flame) => ({ glow: flame.glow.batch.build('glow'), halo: flame.halo.batch.build('glow') })),
      anchors: {
        height: this.top,
        hinge: new THREE.Vector3(this.doorX - DOOR_WIDTH / 2, 0, HINGE_Z),
        doorX: this.doorX,
        plaque,
        photo,
        smoke: this.smoke,
        showcase: this.showcase,
        hearth: this.hearth,
        balcony: this.balcony,
        eaves: this.edge,
        windows: this.windowRects,
      },
    }
  }

  private interiorGlow(twinkle = 0.05): Glow {
    return { phase: this.rnd.range(0, 60), twinkle, interior: 1 }
  }

  /** Verschiebt alles, was `build` hinzufügt, nach hinten/vorn (für Gauben). */
  private shifted(z: number, build: () => void): void {
    const shift = new THREE.Matrix4().makeTranslation(0, 0, z)
    this.solid.within(shift, () => this.glow.within(shift, () => this.halo.within(shift, build)))
  }

  private body(): void {
    const { spec, w, d, bodyH } = this
    this.wallBox(0, bodyH / 2, -d / 2, w, bodyH, d, this.wall)
    const masonry = spec.wall.style === 'brick' || spec.wall.style === 'timber'
    // Anteilig abdunkeln statt fest: Bei dunklen Wänden würde ein fester Abzug den Sockel schwarz machen.
    const plinth = masonry ? col(STONE) : col(spec.wall.color).clone().multiplyScalar(0.7)
    this.wallBox(0, 0.17, 0.03, w + 0.06, 0.34, 0.1, plinth)
  }

  /** Wandquader mit echter Türöffnung – auch Sockel und Fassadenleisten sparen den Eingang aus. */
  private wallBox(
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    paint: THREE.Color,
  ): void {
    const left = x - width / 2
    const right = x + width / 2
    const bottom = y - height / 2
    const top = y + height / 2
    const doorLeft = this.doorX - DOOR_WIDTH / 2
    const doorRight = this.doorX + DOOR_WIDTH / 2
    if (right <= doorLeft || left >= doorRight || bottom >= DOOR_HEIGHT || top <= 0) {
      this.solid.box(x, y, z, width, height, depth, paint)
      return
    }

    const piece = (x0: number, x1: number, y0: number, y1: number) => {
      if (x1 - x0 <= 1e-6 || y1 - y0 <= 1e-6) return
      this.solid.box((x0 + x1) / 2, (y0 + y1) / 2, z, x1 - x0, y1 - y0, depth, paint)
    }
    piece(left, Math.min(right, doorLeft), bottom, top)
    piece(Math.max(left, doorRight), right, bottom, top)
    const middleLeft = Math.max(left, doorLeft)
    const middleRight = Math.min(right, doorRight)
    piece(middleLeft, middleRight, bottom, Math.min(top, 0))
    piece(middleLeft, middleRight, Math.max(bottom, DOOR_HEIGHT), top)
  }

  private wallDetails(): void {
    const { solid, spec, rnd, w, bodyH, trim } = this
    const floorLines = Array.from(
      { length: spec.floors - 1 },
      (_, index) => GROUND_FLOOR + index * UPPER_FLOOR,
    )
    const wallMiddle = (bodyH + 0.34) / 2
    const wallSpan = bodyH - 0.34

    switch (spec.wall.style) {
      case 'plaster': {
        for (const y of floorLines) this.wallBox(0, y, 0.02, w + 0.04, 0.1, 0.05, trim)
        if (rnd.chance(0.5)) {
          for (const side of [-1, 1]) {
            this.wallBox(side * (w / 2 - 0.09), wallMiddle, 0.015, 0.18, wallSpan, 0.03, trim)
          }
        }
        break
      }
      case 'timber': {
        const beam = col(spec.wall.beam)
        for (const y of [0.42, ...floorLines, bodyH - 0.07]) this.wallBox(0, y, 0.013, w, 0.14, 0.03, beam)
        const posts = [-w / 2 + 0.06, w / 2 - 0.06]
        for (let column = 1; column < spec.columns; column++) {
          posts.push(columnX(spec, column) - columnSpacing(spec) / 2)
        }
        for (const x of posts) this.wallBox(x, wallMiddle, 0.013, 0.12, wallSpan, 0.03, beam)
        // Andreaskreuze unter den Fenstern der oberen Stockwerke
        for (const base of floorLines) {
          for (let column = 0; column < spec.columns; column++) {
            for (const lean of [-1, 1]) {
              solid.box(columnX(spec, column), base + 0.3, 0.013, 0.92, 0.08, 0.03, beam, {
                z: lean * 0.42,
              })
            }
          }
        }
        break
      }
      case 'brick': {
        for (const y of floorLines) this.wallBox(0, y, 0.02, w + 0.04, 0.1, 0.05, trim)
        for (let i = 0; i < 16; i++) {
          const tone = shade(spec.wall.color, rnd.pick([-0.06, 0.05, 0.08]))
          const x = rnd.range(-w / 2 + 0.35, w / 2 - 0.35)
          this.wallBox(x, rnd.range(0.5, bodyH - 0.2), 0.004, 0.34, 0.13, 0.014, tone)
        }
        // Eckquader
        for (let y = 0.52, row = 0; y < bodyH - 0.1; y += 0.42, row++) {
          const length = row % 2 === 0 ? 0.32 : 0.2
          for (const side of [-1, 1]) {
            this.wallBox(side * (w / 2 - length / 2), y, 0.014, length, 0.3, 0.03, trim)
          }
        }
        break
      }
      case 'planks': {
        const batten = shade(spec.wall.color, -0.06)
        for (let x = -w / 2 + 0.32; x < w / 2 - 0.2; x += 0.42) {
          this.wallBox(x, wallMiddle, 0.011, 0.05, wallSpan, 0.024, batten)
          // Im Giebel laufen die Leisten bis unters Dach weiter.
          const gableTop = this.gableHeightAt(x) - 0.06
          if (gableTop > bodyH + 0.1) {
            this.wallBox(x, (bodyH + gableTop) / 2, 0.011, 0.05, gableTop - bodyH, 0.024, batten)
          }
        }
        for (const side of [-1, 1]) this.wallBox(side * (w / 2 - 0.07), bodyH / 2, 0.018, 0.14, bodyH, 0.04, trim)
        for (const y of floorLines) this.wallBox(0, y, 0.02, w, 0.08, 0.045, trim)
        break
      }
    }
  }

  // ---------------------------------------------------------------- Dach

  /** Dachprofil eines Giebels zur Straße, relativ zur Oberkante der Fassade. */
  private frontProfile(): Point[] {
    const half = this.w / 2
    const height = this.spec.roof.height
    if (this.spec.roof.type === 'gambrel') {
      return [
        [-half, 0],
        [-half * 0.6, height * 0.62],
        [0, height],
        [half * 0.6, height * 0.62],
        [half, 0],
      ]
    }
    return [
      [-half, 0],
      [0, height],
      [half, 0],
    ]
  }

  /** Höhe der Giebelwand an der Stelle x (für Häuser ohne Giebel: Fassadenhöhe). */
  private gableHeightAt(x: number): number {
    const { type } = this.spec.roof
    if (type !== 'gable' && type !== 'gambrel') return this.bodyH
    const profile = this.frontProfile()
    for (let i = 0; i < profile.length - 1; i++) {
      const [x0, y0] = profile[i]
      const [x1, y1] = profile[i + 1]
      if (x >= x0 && x <= x1) return this.bodyH + y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
    return this.bodyH
  }

  /** Höhe der Dachfläche dort, wo der Schornstein steht. */
  private roofHeightAt(x: number): number {
    const { type, height } = this.spec.roof
    const slope = 1 - Math.abs(x) / (this.w / 2)
    switch (type) {
      case 'gable':
      case 'gambrel':
        return this.gableHeightAt(x)
      case 'stepped':
        return this.bodyH + height * 0.84 * slope
      case 'hip':
        return this.bodyH + height * slope
      case 'side':
        return this.bodyH + height * 0.8
      case 'flat':
        return this.bodyH + height
    }
  }

  /** Dachhaut samt Schneedecke entlang eines Profils, zwischen zFront und zBack. */
  private roofSurface(profile: readonly Point[], zFront: number, zBack: number, scale = 1): void {
    const { solid } = this
    const snowDepth = this.spec.roof.snow * scale
    const thickness = ROOF_THICKNESS * scale
    const outward = zFront > zBack ? 1 : -1
    for (let i = 0; i < profile.length - 1; i++) {
      solid.slab(profile[i], profile[i + 1], thickness, zFront, zBack, this.roofColor)
      solid.slab(
        profile[i],
        profile[i + 1],
        snowDepth,
        zFront + outward * 0.05,
        zBack - outward * 0.05,
        this.snow,
        thickness,
      )
    }

    // Runde Schneewülste an Traufen, Knicken und First kaschieren die Stöße der Platten.
    const middle = (zFront + zBack) / 2
    const length = Math.abs(zFront - zBack) + 0.1
    const last = profile.length - 1
    profile.forEach((point, i) => {
      const before = profile[Math.max(i - 1, 0)]
      const after = profile[Math.min(i + 1, last)]
      const angleIn = Math.atan2(point[1] - before[1], point[0] - before[0])
      const angleOut = Math.atan2(after[1] - point[1], after[0] - point[0])
      const angle = i === 0 ? angleOut : i === last ? angleIn : (angleIn + angleOut) / 2
      const lift = thickness + snowDepth * 0.45
      const radius = snowDepth * (i === 0 || i === last ? 0.6 : 0.85)
      solid.cylinder(
        point[0] - Math.sin(angle) * lift,
        point[1] + Math.cos(angle) * lift,
        middle,
        radius,
        radius,
        length,
        7,
        this.snow,
        { x: Math.PI / 2 },
      )
    })
  }

  private roof(): void {
    switch (this.spec.roof.type) {
      case 'gable':
      case 'gambrel':
        return this.frontGableRoof()
      case 'stepped':
        return this.steppedRoof()
      case 'side':
        return this.sideRoof()
      case 'hip':
        return this.hipRoof()
      case 'flat':
        return this.flatRoof()
    }
  }

  private frontGableRoof(): void {
    const { solid, bodyH, d } = this
    const raise = (points: readonly Point[]): Point[] => points.map(([x, y]) => [x, y + bodyH])
    const base = this.frontProfile()
    const profile = raise(extendEaves(base, SIDE_OVERHANG))
    this.roofSurface(profile, FRONT_OVERHANG, -d - 0.15)
    const inner = base.slice(1, -1).reverse()
    solid.polygon(raise([base[0], base[base.length - 1], ...inner]), 0, this.wall)
    this.edge = { points: profile, z: FRONT_OVERHANG }
  }

  /** Treppengiebel: gestufte Schauwand vor einem normalen Satteldach. */
  private steppedRoof(): void {
    const { solid, spec, w, d, bodyH, trim } = this
    const steps = spec.columns === 2 ? 4 : 5
    const stepHeight = spec.roof.height / steps
    const topWidth = 0.95
    const widths = Array.from(
      { length: steps },
      (_, step) => w - (step * (w - topWidth)) / (steps - 1),
    )

    const left: Point[] = []
    widths.forEach((width, step) => {
      const y = bodyH + step * stepHeight
      solid.box(0, y + stepHeight / 2, -0.15, width, stepHeight, 0.3, this.wall)
      const inner = widths[step + 1] ?? 0
      const ledge = (width - inner) / 2
      for (const side of [-1, 1]) {
        const x = side * (inner / 2 + ledge / 2)
        solid.box(x, y + stepHeight + 0.04, -0.15, ledge + 0.08, 0.08, 0.38, trim)
        solid.box(x, y + stepHeight + 0.13, -0.15, ledge + 0.02, 0.11, 0.34, this.snow)
      }
      left.push([-width / 2, y], [-width / 2, y + stepHeight])
    })

    const ridge = bodyH + spec.roof.height * 0.84
    this.roofSurface(
      [
        [-w / 2, bodyH],
        [0, ridge],
        [w / 2, bodyH],
      ],
      -0.3,
      -d - 0.15,
    )
    const right = left.map(([x, y]): Point => [-x, y]).reverse()
    this.edge = { points: [...left, ...right], z: 0.03 }
    this.top = bodyH + spec.roof.height + 0.4
  }

  /** Satteldach mit First parallel zur Straße – vorn sieht man die Dachfläche mit Gauben. */
  private sideRoof(): void {
    const { solid, spec, w, d, bodyH } = this
    const height = spec.roof.height
    // Dreht das Profil aus der x-y-Ebene in die Tiefe: lokales x läuft nach hinten, lokales z nach rechts.
    const sideways = new THREE.Matrix4().makeRotationY(Math.PI / 2)
    const raise = (points: readonly Point[]): Point[] => points.map(([x, y]) => [x, y + bodyH])
    const base: Point[] = [
      [0, 0],
      [d / 2, height],
      [d, 0],
    ]
    const profile = raise(extendEaves(base, FRONT_OVERHANG))
    const gableEnd = raise([base[0], base[2], base[1]])

    solid.within(sideways, () => {
      this.roofSurface(profile, w / 2 + SIDE_OVERHANG, -w / 2 - SIDE_OVERHANG)
      solid.polygon(gableEnd, w / 2, this.wall)
      solid.polygon(gableEnd, -w / 2, this.wall, { flip: true })
    })

    const eave = profile[0][1]
    this.edge = {
      points: [
        [-w / 2 - SIDE_OVERHANG, eave],
        [w / 2 + SIDE_OVERHANG, eave],
      ],
      z: FRONT_OVERHANG,
    }

    for (const side of [-1, 1]) this.dormer(side * columnSpacing(spec), 0.6, height / (d / 2))
  }

  /** Kleine Gaube mit erleuchtetem Fenster; `slope` ist die Steigung der Dachfläche. */
  private dormer(x: number, setback: number, slope: number): void {
    const { solid, bodyH } = this
    const base = bodyH + setback * slope - 0.15
    const top = base + 1.1
    solid.box(x, (base + top) / 2, -setback - 0.7, 1, top - base, 1.4, this.wall)
    solid.polygon(
      [
        [x - 0.5, top],
        [x + 0.5, top],
        [x, top + 0.32],
      ],
      -setback,
      this.wall,
    )
    this.roofSurface(
      [
        [x - 0.64, top - 0.03],
        [x, top + 0.38],
        [x + 0.64, top - 0.03],
      ],
      -setback + 0.14,
      -setback - 1.5,
      0.6,
    )
    this.shifted(-setback, () => this.window(x, base + 0.34, 0.56, 0.6, true, { plain: true }))
  }

  private hipRoof(): void {
    const { solid, spec, w, d, bodyH } = this
    const width = w + 2 * SIDE_OVERHANG
    const depth = d + 2 * FRONT_OVERHANG
    solid.pyramid(0, bodyH, -d / 2, width, spec.roof.height, depth, this.roofColor)
    // Die Schneehaube ist etwas kleiner und sitzt höher – an der Traufe schaut das Dach hervor.
    solid.pyramid(
      0,
      bodyH + spec.roof.snow * 0.9,
      -d / 2,
      width * 0.93,
      spec.roof.height * 0.97,
      depth * 0.93,
      this.snow,
    )
    this.edge = {
      points: [
        [-width / 2, bodyH],
        [width / 2, bodyH],
      ],
      z: FRONT_OVERHANG,
    }
  }

  private flatRoof(): void {
    const { solid, spec, rnd, w, d, bodyH } = this
    const parapet = spec.roof.height
    solid.box(0, bodyH + parapet / 2, -d / 2 + 0.02, w + 0.3, parapet, d + 0.34, this.trim)
    solid.box(0, bodyH + parapet + spec.roof.snow / 2, -d / 2, w + 0.16, spec.roof.snow, d + 0.2, this.snow)
    for (let i = 0; i < 4; i++) {
      solid.sphere(
        rnd.range(-w / 2, w / 2),
        bodyH + parapet + spec.roof.snow,
        rnd.range(-0.5, 0.05),
        rnd.range(0.4, 0.8),
        rnd.range(0.12, 0.22),
        0.35,
        this.snow,
      )
    }
    this.edge = {
      points: [
        [-w / 2 - 0.15, bodyH + 0.02],
        [w / 2 + 0.15, bodyH + 0.02],
      ],
      z: 0.2,
    }
  }

  private chimney(): void {
    const { solid, spec, w, d } = this
    if (spec.chimney === null) return
    const x = spec.chimney * w
    const z = spec.roof.type === 'side' ? -d * 0.66 : -d * 0.55
    const top = this.roofHeightAt(x) + 1
    solid.box(x, top - 0.8, z, 0.52, 1.6, 0.52, col(CHIMNEY_BRICK))
    solid.box(x, top + 0.04, z, 0.66, 0.1, 0.66, col(STONE))
    solid.box(x, top + 0.14, z, 0.6, 0.12, 0.6, this.snow)
    this.smoke = new THREE.Vector3(x, top + 0.3, z)
    this.top = Math.max(this.top, top + 0.3)
  }

  private peakStar(): void {
    const { solid, glow, halo, spec, rnd, d } = this
    if (!spec.peakStar) return
    const hip = spec.roof.type === 'hip'
    const z = hip ? -d / 2 : FRONT_OVERHANG - 0.12
    const y = ridgeHeight(spec) + spec.roof.snow + 0.6
    const light = decoGlow(rnd, 0.25)
    const gold = col(GOLD)
    solid.box(0, y - 0.4, z, 0.05, 0.5, 0.05, col(IRON))
    glow.star(0, y, z, 0.36, 0.16, 5, gold, light)
    // Ein zweiter, quer stehender Stern – so ist er auch beim Blick die Straße entlang zu sehen.
    const crossed = new THREE.Matrix4()
      .makeTranslation(0, y, z)
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
    glow.within(crossed, () => glow.star(0, 0, 0, 0.36, 0.16, 5, gold, light))
    halo.billboard(0, y, z, 2.4, 2.4, haloOf(gold, 0.45), light)
    this.top = Math.max(this.top, y + 0.4)
  }

  // ------------------------------------------------------------- Fassade

  private facade(): void {
    const { spec, rnd } = this
    const spot = wreathSpot(spec)
    const width = spec.windows.shutters ? 0.8 : 0.9
    for (let floor = 0; floor < spec.floors; floor++) {
      const base = floor === 0 ? 0 : GROUND_FLOOR + (floor - 1) * UPPER_FLOOR
      const sill = base + (floor === 0 ? 1.05 : 0.6)
      const height = floor === 0 ? 1.3 : 1.2
      for (let column = 0; column < spec.columns; column++) {
        if (floor === 0 && column === spec.door.column) continue
        // Dieses Feld bleibt frei für den Kranz.
        if (!spot.inGable && floor === spec.floors - 1 && column === 1) continue
        const x = columnX(spec, column)
        const hearth = HEARTH_HOUSES.has(spec.day) && floor === spec.floors - 1 && column === spec.columns - 1
        const balcony = BALCONY_HOUSES.has(spec.day) && floor === 1 && column === spec.columns - 1
        const showcaseFloor = SHOWCASE_FLOORS[spec.day]
        const showcase = showcaseFloor === floor || (showcaseFloor === 'top' && floor === spec.floors - 1)
        const lit = rnd.chance(0.82) || showcase || hearth || balcony
        if (balcony) {
          // Die Balkontür reicht fast bis zum Boden des Geschosses.
          const doorSill = base + 0.08
          const doorHeight = 1.9
          this.window(x, doorSill, width, doorHeight, lit, { balcony: true })
          this.windowRects.push({ x, y: doorSill, width, height: doorHeight, arched: false })
          this.addBalcony(x, base)
          continue
        }
        this.window(x, sill, width, height, lit, { spill: floor === 0, showcase, hearth })
        this.windowRects.push({ x, y: sill, width, height, arched: spec.windows.style === 'arched' && !hearth })
      }
    }
  }

  /** Balkon vor der Balkontür: Bodenplatte mit Konsolen, Geländer mit Stäben, Schnee obendrauf. */
  private addBalcony(x: number, base: number): void {
    const { solid, trim, snow } = this
    const width = 1.75
    const depth = BALCONY_DEPTH
    const floorTop = base + 0.06
    const z = depth / 2
    const iron = col(IRON)
    solid.box(x, floorTop - 0.07, z, width, 0.14, depth, trim)
    solid.box(x, floorTop + 0.02, z, width - 0.04, 0.05, depth - 0.04, snow)
    for (const side of [-1, 1]) {
      // Konsolen unter der Platte
      solid.box(x + side * (width / 2 - 0.15), floorTop - 0.3, depth * 0.35, 0.1, 0.32, depth * 0.6, trim)
    }
    // Geländer: Handlauf vorn und an den Seiten, Stäbe dazwischen
    const railY = floorTop + 0.92
    solid.box(x, railY, depth - 0.04, width, 0.06, 0.07, iron)
    solid.box(x, floorTop + 0.12, depth - 0.04, width, 0.04, 0.05, iron)
    solid.box(x, railY + 0.05, depth - 0.04, width - 0.02, 0.05, 0.09, snow)
    for (const side of [-1, 1]) {
      solid.box(x + side * (width / 2 - 0.03), railY, z, 0.06, 0.06, depth, iron)
      solid.box(x + side * (width / 2 - 0.03), floorTop + 0.46, depth - 0.04, 0.07, 0.92, 0.07, iron)
      for (let k = 1; k < 4; k++) solid.box(x + side * (width / 2 - 0.03), floorTop + 0.46, (depth * k) / 4, 0.03, 0.9, 0.03, iron)
    }
    for (let i = 1; i < 10; i++) {
      solid.box(x - width / 2 + (width * i) / 10, floorTop + 0.5, depth - 0.04, 0.03, 0.8, 0.03, iron)
    }
    this.balcony = new THREE.Vector3(x, floorTop + 0.045, z)
  }

  private windowLight(): readonly [THREE.Color, THREE.Color] {
    const [bottom, top] = this.rnd.pick(WINDOW_LIGHTS)
    return [col(bottom), col(top)]
  }

  private window(
    x: number,
    sill: number,
    width: number,
    height: number,
    lit: boolean,
    options: { plain?: boolean; spill?: boolean; showcase?: boolean; hearth?: boolean; balcony?: boolean } = {},
  ): void {
    const { solid, glow, halo, spec, trim } = this
    // Ins Kaminfenster soll man ungestört hineinschauen – ohne Sprossen.
    const style = options.plain || options.hearth ? 'plain' : options.balcony ? 'cross' : spec.windows.style
    const arched = style === 'arched'
    const rectHeight = arched ? height - width / 2 : height
    const middle = sill + rectHeight / 2
    const top = sill + rectHeight
    const halfCircle = { segments: 14, start: 0, length: Math.PI }

    solid.box(x, middle, 0.04, width + 0.18, rectHeight + 0.18, 0.08, trim)
    if (arched) solid.disc(x, top, 0.082, width / 2 + 0.09, trim, halfCircle)

    if (lit) {
      const light = this.windowLight()
      const shine = this.interiorGlow()
      glow.quad(x, middle, 0.09, width, rectHeight, light, undefined, shine)
      if (arched) glow.disc(x, top, 0.09, width / 2, light[1], { ...halfCircle, glow: shine })
      if (options.showcase) {
        this.showcase.push({ x, y: sill, width, height: rectHeight, light })
        this.skipDecoRandom(spec.windows.deco)
      } else if (options.balcony) {
        // Balkontür: ohne Fensterdeko, dieselben Zufallszahlen wie sonst.
        this.skipDecoRandom(spec.windows.deco)
      } else if (options.hearth) {
        this.hearth = { x, y: sill, width, height: rectHeight, light }
        this.skipDecoRandom(spec.windows.deco)
      }
      else this.windowDeco(x, sill, width, rectHeight, options.plain ? 'none' : spec.windows.deco, light[0])
      const warm = col(WINDOW_HALO)
      halo.quad(x, sill + height / 2, 0.32, width + 1.2, height + 1.2, haloOf(warm, 0.3), undefined, shine)
      if (options.spill) {
        halo.quad(x, 0.05, 1, width + 1.3, 1.7, haloOf(warm, 0.2), { x: -Math.PI / 2 }, shine)
      }
    } else {
      const dark = col(DARK_GLASS)
      solid.quad(x, middle, 0.09, width, rectHeight, dark)
      if (arched) solid.disc(x, top, 0.09, width / 2, dark, halfCircle)
    }

    // Sprossen
    const bar = 0.05
    if (style === 'cross' || style === 'grid' || arched) {
      solid.box(x, middle, 0.1, bar, rectHeight, 0.02, trim)
    }
    if (style === 'cross') solid.box(x, sill + rectHeight * 0.62, 0.1, width, bar, 0.02, trim)
    if (style === 'grid') {
      for (const part of [1 / 3, 2 / 3]) solid.box(x, sill + rectHeight * part, 0.1, width, bar, 0.02, trim)
    }
    if (arched) solid.box(x, top, 0.1, width, bar, 0.02, trim)

    // Fensterbank mit Schnee
    solid.box(x, sill - 0.07, 0.11, width + 0.34, 0.08, 0.22, trim)
    solid.box(x, sill - 0.01, 0.12, width + 0.3, 0.07, 0.2, this.snow)

    if (spec.windows.shutters && !options.plain) {
      const paint = col(spec.windows.shutters)
      const slat = shade(spec.windows.shutters, -0.07)
      for (const side of [-1, 1]) {
        const sx = x + side * (width / 2 + 0.23)
        solid.box(sx, middle, 0.035, 0.27, rectHeight + 0.1, 0.05, paint)
        for (const part of [0.3, 0.7]) {
          solid.box(sx, sill + rectHeight * part, 0.063, 0.19, 0.05, 0.01, slat)
        }
      }
    }
  }

  /** Verbraucht dieselben Zufallszahlen wie die weggelassene Deko – so bleibt der Rest des Hauses unverändert. */
  private skipDecoRandom(deco: HouseSpec['windows']['deco']): void {
    if (deco === 'star') this.rnd.pick([0, 1, 2])
    if (deco !== 'none') this.interiorGlow()
  }

  /** Was man durchs erleuchtete Fenster sieht: Schwibbogen, Stern oder Vorhänge. */
  private windowDeco(
    x: number,
    sill: number,
    width: number,
    height: number,
    deco: HouseSpec['windows']['deco'],
    light: THREE.Color,
  ): void {
    const { solid, glow } = this
    const top = sill + height
    switch (deco) {
      case 'candles': {
        // Schwibbogen: dunkler Bogen mit Kerzen vor dem hellen Fenster
        const radius = width * 0.3
        const wood = col(WOOD_DARK)
        const arch = { segments: 10, start: 0, length: Math.PI }
        solid.disc(x, sill + 0.03, 0.097, radius, wood, arch)
        glow.disc(x, sill + 0.03, 0.099, radius * 0.6, light, { ...arch, glow: this.interiorGlow() })
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * (i + 0.5)) / 5
          solid.box(
            x + Math.cos(angle) * radius * 0.86,
            sill + 0.07 + Math.sin(angle) * radius * 0.86,
            0.1,
            0.03,
            0.11,
            0.01,
            wood,
          )
        }
        break
      }
      case 'star': {
        const paint = col(this.rnd.pick(['#ff8a5c', '#fff3bf', '#ff6f61']))
        glow.star(x, sill + height * 0.6, 0.097, 0.21, 0.09, 8, paint, this.interiorGlow(0.12))
        break
      }
      case 'curtains': {
        const cloth = col('#f0a25c')
        const shine = this.interiorGlow()
        const left = x - width / 2
        const right = x + width / 2
        glow.polygon(
          [
            [left, top],
            [left, top - height * 0.72],
            [left + width * 0.36, top],
          ],
          0.095,
          cloth,
          { glow: shine },
        )
        glow.polygon(
          [
            [right, top],
            [right - width * 0.36, top],
            [right, top - height * 0.72],
          ],
          0.095,
          cloth,
          { glow: shine },
        )
        break
      }
      case 'none':
        break
    }
  }

  /** Haustür mit Rahmen, Stufe und Schmuck. Liefert die Stelle des Hausnummernschilds. */
  private doorway(): HouseAnchors['plaque'] {
    const { solid, glow, halo, spec, trim, doorX, builders } = this
    const arch = spec.door.style === 'arch'
    const half = DOOR_WIDTH / 2

    for (const side of [-1, 1]) {
      solid.box(doorX + side * (half + 0.06), (DOOR_HEIGHT + 0.06) / 2, 0.05, 0.12, DOOR_HEIGHT + 0.06, 0.1, trim)
    }
    solid.box(doorX, DOOR_HEIGHT + 0.06, 0.05, DOOR_WIDTH + 0.24, 0.12, 0.1, trim)

    let plaque = { x: doorX, y: 2.68, z: 0.13, radius: 0.3 }
    if (arch) {
      // Oberlicht: ein leuchtender Halbkreis, in dem das Hausnummernschild sitzt
      const base = DOOR_HEIGHT + 0.12
      const halfCircle = { segments: 16, start: 0, length: Math.PI }
      solid.disc(doorX, base, 0.06, half + 0.14, trim, halfCircle)
      glow.disc(doorX, base, 0.07, half + 0.02, this.windowLight()[0], {
        ...halfCircle,
        glow: this.interiorGlow(),
      })
      plaque = { x: doorX, y: base + 0.31, z: 0.13, radius: 0.26 }
    }
    solid.disc(plaque.x, plaque.y, 0.115, plaque.radius + 0.045, col(WOOD_DARK), { segments: 24 })

    // Stufe, links und rechts verschneit
    solid.box(doorX, 0.05, 0.36, DOOR_WIDTH + 0.7, 0.1, 0.62, col(STONE))
    for (const side of [-1, 1]) {
      solid.box(doorX + side * (half + 0.2), 0.12, 0.36, 0.34, 0.07, 0.6, this.snow)
    }
    halo.quad(doorX, 0.11, 0.9, 2.2, 1.6, haloOf(col(WINDOW_HALO), 0.16), { x: -Math.PI / 2 }, this.interiorGlow())

    this.doorLeaf()

    if (spec.door.garland) {
      const frame: Point[] = [
        [doorX - half - 0.2, 0.25],
        [doorX - half - 0.2, DOOR_HEIGHT + 0.2],
        [doorX + half + 0.2, DOOR_HEIGHT + 0.2],
        [doorX + half + 0.2, 0.25],
      ]
      samplePolyline(frame, 0.17).forEach(([x, y], i) => {
        solid.sphere(x, y, 0.15, 0.1, 0.1, 0.08, col(PINE[i % 2]))
        if (i % 3 === 1) addBulb(builders, x, y, 0.25, this.bulbs[i % this.bulbs.length], 0.05)
      })
    }

    const beside = spec.door.garland ? 1 : 0.86
    for (const side of [-1, 1]) {
      switch (spec.door.deco) {
        case 'trees':
          addFir(builders, doorX + side * 0.97, 0.46, 1.15, { lights: this.bulbs, pot: true })
          break
        case 'canes':
          // Weit genug neben der Tür und mit dem Haken nach außen – sonst schwingt die
          // geöffnete Tür durch die Zuckerstangen hindurch.
          addCandyCane(builders, doorX + side * CANE_BESIDE, 0.42, -side)
          break
        case 'lanterns':
          addWallLantern(builders, doorX + side * beside, 1.85, 0.12)
          break
        case 'none':
          break
      }
    }
    return plaque
  }

  /** Türblatt im Koordinatensystem des Scharniers (x von 0 bis Türbreite). */
  private doorLeaf(): void {
    const { door, doorGlow, spec, trim } = this
    const paint = col(spec.door.color)
    const panel = shade(spec.door.color, -0.07)
    const middle = DOOR_WIDTH / 2
    door.box(middle, DOOR_HEIGHT / 2, 0, DOOR_WIDTH, DOOR_HEIGHT, 0.06, paint)

    const panels = (rows: readonly [y: number, height: number][]) => {
      for (const [y, height] of rows) {
        for (const x of [0.28, 0.72]) door.box(x, y, 0.035, 0.32, height, 0.012, panel)
      }
    }

    switch (spec.door.style) {
      case 'panel':
      case 'arch':
        panels([
          [0.62, 0.66],
          [1.5, 0.78],
        ])
        break
      case 'glass': {
        panels([[0.62, 0.66]])
        const shine = this.interiorGlow()
        door.box(middle, 1.52, 0.035, 0.68, 0.74, 0.012, trim)
        doorGlow.quad(middle, 1.52, 0.043, 0.58, 0.64, this.windowLight(), undefined, shine)
        door.box(middle, 1.52, 0.048, 0.045, 0.64, 0.008, trim)
        door.box(middle, 1.52, 0.048, 0.58, 0.045, 0.008, trim)
        break
      }
      case 'plank': {
        for (const x of [0.25, 0.5, 0.75]) door.box(x, DOOR_HEIGHT / 2, 0.032, 0.022, DOOR_HEIGHT - 0.1, 0.006, panel)
        door.torus(middle, 1.58, 0.035, 0.2, 0.035, trim)
        doorGlow.disc(middle, 1.58, 0.04, 0.18, this.windowLight()[0], {
          segments: 16,
          glow: this.interiorGlow(),
        })
        break
      }
    }
    door.sphere(DOOR_WIDTH - 0.14, 1.02, 0.06, 0.05, 0.05, 0.05, col(GOLD))
  }

  /** Optionaler Kranz mit Schleife und Lämpchen; die Selfie-Position bleibt an jedem Haus erhalten. */
  private wreath(): HouseAnchors['photo'] {
    const { x, y } = wreathSpot(this.spec)
    return ADVENT_WREATHS.has(this.spec.day)
      ? addAdventWreath(this.builders, x, y, this.flames)
      : { x, y, z: 0.07 }
  }

  // ---------------------------------------------------- Lichter und Deko

  private lights(): void {
    const { spec, builders, bulbs, edge, w, bodyH } = this
    let index = 0
    const next = () => bulbs[index++ % bulbs.length]

    switch (spec.lights.style) {
      case 'roofline':
        for (const [x, y] of samplePolyline(edge.points, 0.36)) {
          addBulb(builders, x, y - 0.13, edge.z + 0.05, next())
        }
        break
      case 'icicle':
        samplePolyline(edge.points, 0.3).forEach(([x, y], strand) => {
          const length = [2, 4, 3, 5, 2, 3][strand % 6]
          for (let i = 0; i < length; i++) {
            addBulb(builders, x, y - 0.14 - i * 0.15, edge.z + 0.05, next(), 0.048)
          }
        })
        break
      case 'scallop': {
        const anchors = [-w / 2 + 0.12, w / 2 - 0.12]
        for (let column = 1; column < spec.columns; column++) {
          anchors.splice(column, 0, columnX(spec, column) - columnSpacing(spec) / 2)
        }
        const rows = [{ y: bodyH - 0.1, skipDoor: false }]
        if (spec.floors > 1) rows.push({ y: GROUND_FLOOR - 0.12, skipDoor: true })
        for (const row of rows) {
          for (let span = 0; span < anchors.length - 1; span++) {
            if (row.skipDoor && span === spec.door.column) continue
            const from = anchors[span]
            const to = anchors[span + 1]
            const count = Math.round((to - from) / 0.21)
            for (let i = 0; i < count; i++) {
              const t = i / count
              addBulb(builders, from + (to - from) * t, row.y - 1.04 * t * (1 - t), 0.14, next())
            }
          }
        }
        break
      }
      case 'windows':
        for (const { x, y, width, height } of this.windowRects) {
          const left = x - width / 2 - 0.16
          const right = x + width / 2 + 0.16
          const bottom = y - 0.02
          const top = y + height + 0.16
          const outline: Point[] = [
            [left, bottom],
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
          ]
          for (const [bx, by] of samplePolyline(outline, 0.27)) addBulb(builders, bx, by, 0.24, next(), 0.05)
        }
        break
      case 'none':
        break
    }
  }

  private icicles(): void {
    const { solid, spec, rnd, edge } = this
    if (!spec.icicles) return
    for (const [x, y] of samplePolyline(edge.points, 0.31)) {
      if (rnd.chance(0.3)) continue
      const length = rnd.range(0.14, 0.42)
      solid.cylinder(x, y - 0.04 - length / 2, edge.z - 0.03, 0.036, 0, length, 5, col(ICE), {
        x: Math.PI,
      })
    }
  }

  private yard(): void {
    const { spec, rnd, builders, doorX, w } = this
    const accent = col(spec.windows.shutters ?? spec.door.color)
    let slot = 0
    for (let column = 0; column < spec.columns; column++) {
      if (column === spec.door.column) continue
      const x = columnX(spec, column)
      const away = x >= doorX ? 1 : -1
      switch (spec.yard[slot++]) {
        case 'snowman':
          addSnowman(builders, x + away * 0.1, 0.85, accent, rnd.range(0.82, 0.98))
          break
        case 'gifts':
          addGiftPile(builders, x, 0.62)
          break
        case 'sled':
          addSled(builders, x + away * 0.25, 0.46)
          break
        case 'bush':
          addBush(builders, x, 0.55, this.bulbs)
          break
        case 'fir':
          addFir(builders, x + away * 0.42, 0.85, rnd.range(1.6, 2.15), { lights: this.bulbs })
          break
        default:
          break
      }
    }

    // Schneewehen am Sockel – sie bleiben vor dem eigenen Haus und lassen die Tür frei.
    for (let i = 0; i < 4; i++) {
      const radius = rnd.range(0.5, 0.95)
      const reach = w / 2 + 0.4 - radius
      const x = rnd.range(-reach, reach)
      if (Math.abs(x - doorX) < 1) continue
      addMound(builders, x, 0.12, radius, rnd.range(0.16, 0.3), 0.32)
    }
  }
}

/** Baut die komplette Geometrie eines Hauses aus seinem Bauplan. */
export function buildHouse(spec: HouseSpec): HouseGeometry {
  return new HouseBuilder(spec).build()
}
