import { HOUSE_COUNT } from '../lib/places.ts'
import { createRandom, hashSeed } from '../lib/rng.ts'
import type { Random } from '../lib/rng.ts'
import { PLAZA_RADIUS } from './world.ts'

/** Die Saat der Straße: Jede Zahl ergibt andere Häuser. */
export const STREET_SEED = 2026

export const GROUND_FLOOR = 3.2
export const UPPER_FLOOR = 2.2
export const DOOR_WIDTH = 1
export const DOOR_HEIGHT = 2.1
const FACADE_PADDING = 0.4

export type RoofType = 'gable' | 'gambrel' | 'stepped' | 'side' | 'hip' | 'flat'
export type WallStyle = 'plaster' | 'timber' | 'brick' | 'planks'
export type WindowStyle = 'cross' | 'grid' | 'arched' | 'plain'
export type WindowDeco = 'none' | 'candles' | 'star' | 'curtains'
export type DoorStyle = 'panel' | 'glass' | 'arch' | 'plank'
export type DoorDeco = 'none' | 'trees' | 'canes' | 'lanterns'
export type LightStyle = 'none' | 'roofline' | 'scallop' | 'windows' | 'icicle'
export type LightPalette = 'warm' | 'multi' | 'redgreen' | 'ice' | 'gold'
export type YardProp = 'none' | 'snowman' | 'gifts' | 'sled' | 'bush' | 'fir'

/** Bauplan eines Hauses – vollständig aus Tag und Saat abgeleitet. */
export interface HouseSpec {
  day: number
  seed: number
  width: number
  depth: number
  floors: 1 | 2 | 3
  /** Fensterachsen der Fassade. */
  columns: 2 | 3
  wall: { style: WallStyle; color: string; family: ColorFamily; trim: string; beam: string }
  roof: { type: RoofType; height: number; color: string; snow: number }
  /** Position des Schornsteins relativ zur Hausbreite (−0,5 … 0,5) oder null. */
  chimney: number | null
  door: { column: number; style: DoorStyle; color: string; deco: DoorDeco; garland: boolean }
  windows: { style: WindowStyle; deco: WindowDeco; shutters: string | null }
  lights: { style: LightStyle; palette: LightPalette }
  icicles: boolean
  peakStar: boolean
  /** Deko im Vorgarten, je eine pro Fensterachse ohne Tür (von links nach rechts). */
  yard: YardProp[]
}

type Weighted<T> = readonly (readonly [T, number])[]

/** Farbfamilien – Nachbarhäuser sollen nicht in derselben Familie gestrichen sein. */
export type ColorFamily = 'cream' | 'warm' | 'red' | 'green' | 'blue' | 'purple' | 'neutral'

const WALL_COLORS: Record<WallStyle, readonly (readonly [string, ColorFamily])[]> = {
  plaster: [
    ['#f3e4c6', 'cream'],
    ['#f0d49a', 'cream'],
    ['#d9aa52', 'cream'],
    ['#edbe9b', 'warm'],
    ['#e2a8a1', 'warm'],
    ['#cf8a76', 'red'],
    ['#b7c7a5', 'green'],
    ['#bcdac9', 'green'],
    ['#aac4db', 'blue'],
    ['#86a8ad', 'blue'],
    ['#bfb1d6', 'purple'],
    ['#d9cfc3', 'neutral'],
  ],
  timber: [
    ['#f4ead6', 'cream'],
    ['#efe0c4', 'cream'],
    ['#f3dcc4', 'warm'],
    ['#e9e2d0', 'neutral'],
  ],
  brick: [
    ['#a85b4a', 'red'],
    ['#93503f', 'red'],
    ['#b06a52', 'red'],
    ['#9c5f55', 'red'],
  ],
  planks: [
    ['#a9463c', 'red'],
    ['#6d8ea5', 'blue'],
    ['#7d9a78', 'green'],
    ['#d2a24c', 'cream'],
    ['#8a6f8f', 'purple'],
    ['#4f7a7a', 'blue'],
  ],
}
const BEAM_COLORS = ['#5d4033', '#7b3b34', '#40504b', '#4a3b52']
const LIGHT_TRIMS = ['#fbf3e4', '#f6ead7', '#fffaf0']
const COLOR_TRIMS = ['#9b6b4b', '#7d8f7a', '#b9705f', '#6f86a3', '#8a6f8f']
const ROOF_COLORS = ['#8d4b3f', '#5b4b58', '#4a526b', '#6c4b3b', '#40605f', '#7b4040']
const DOOR_COLORS = [
  '#b4403a',
  '#2f6f56',
  '#2f5079',
  '#d5a13e',
  '#7c4b2f',
  '#6c4b7b',
  '#20606a',
  '#efe2cb',
]

const WALL_STYLES: Weighted<WallStyle> = [
  ['plaster', 46],
  ['timber', 18],
  ['brick', 16],
  ['planks', 20],
]
const WINDOW_STYLES: Weighted<WindowStyle> = [
  ['cross', 34],
  ['grid', 24],
  ['arched', 22],
  ['plain', 20],
]
const WINDOW_DECOS: Weighted<WindowDeco> = [
  ['none', 22],
  ['candles', 30],
  ['star', 22],
  ['curtains', 26],
]
const DOOR_STYLES: Weighted<DoorStyle> = [
  ['panel', 34],
  ['glass', 26],
  ['arch', 24],
  ['plank', 16],
]
const DOOR_DECOS: Weighted<DoorDeco> = [
  ['none', 22],
  ['trees', 36],
  ['canes', 20],
  ['lanterns', 22],
]
const LIGHT_STYLES: Weighted<LightStyle> = [
  ['roofline', 30],
  ['scallop', 24],
  ['windows', 20],
  ['icicle', 18],
  ['none', 8],
]
const LIGHT_PALETTES: Weighted<LightPalette> = [
  ['warm', 30],
  ['multi', 28],
  ['redgreen', 14],
  ['ice', 14],
  ['gold', 14],
]
const YARD_PROPS: Weighted<YardProp> = [
  ['none', 20],
  ['snowman', 16],
  ['gifts', 14],
  ['sled', 10],
  ['bush', 18],
  ['fir', 22],
]

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = channels(a)
  const [r2, g2, b2] = channels(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function brightness(hex: string): number {
  const [r, g, b] = channels(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Wählt eine Farbe, die sich deutlich von `reference` abhebt (falls es eine solche gibt). */
function pickContrasting(
  rnd: Random,
  colors: readonly string[],
  reference: string | undefined,
  minDistance: number,
): string {
  const suitable = reference
    ? colors.filter((color) => colorDistance(color, reference) >= minDistance)
    : colors
  return rnd.pick(suitable.length > 0 ? suitable : colors)
}

function pickAvoiding<T>(rnd: Random, options: Weighted<T>, avoid: T | undefined): T {
  const others = options.filter(([option]) => option !== avoid)
  return rnd.weighted(others.length > 0 ? others : options)
}

/** Wandfarbe aus einer anderen Farbfamilie als die der beiden Häuser davor (soweit möglich). */
function pickWallColor(
  rnd: Random,
  style: WallStyle,
  [previous, beforePrevious]: readonly (ColorFamily | undefined)[],
): readonly [string, ColorFamily] {
  const colors = WALL_COLORS[style]
  const fresh = colors.filter(([, family]) => family !== previous && family !== beforePrevious)
  const different = colors.filter(([, family]) => family !== previous)
  return rnd.pick(fresh.length > 0 ? fresh : different.length > 0 ? different : colors)
}

export function isFrontGable(type: RoofType): boolean {
  return type === 'gable' || type === 'gambrel' || type === 'stepped'
}

/**
 * Welche Dächer zu einem Haus passen. Schmale und einstöckige Häuser bekommen
 * immer einen Giebel zur Straße – dort hängt später der Kranz mit dem Selfie.
 */
function roofOptions(floors: number, columns: number, wallStyle: WallStyle): Weighted<RoofType> {
  if (floors === 1) {
    return [
      ['gable', 60],
      ['gambrel', 40],
    ]
  }
  const narrow = columns === 2
  const masonry = wallStyle === 'plaster' || wallStyle === 'brick'
  const options: [RoofType, number][] = [
    ['gable', narrow ? 45 : 22],
    ['gambrel', narrow ? 25 : 10],
  ]
  if (masonry) options.push(['stepped', narrow ? 34 : 16])
  if (!narrow) {
    options.push(['side', 24], ['hip', 12])
    if (masonry) options.push(['flat', 10])
  }
  return options
}

function roofHeight(type: RoofType, width: number, floors: number, rnd: Random): number {
  const degrees = (value: number) => (value * Math.PI) / 180
  switch (type) {
    case 'gable': {
      const pitch =
        floors === 1 ? rnd.range(48, 54) : width < 4.5 ? rnd.range(43, 51) : rnd.range(36, 43)
      return Math.min((width / 2) * Math.tan(degrees(pitch)), floors === 3 ? 2.4 : 3.4)
    }
    case 'gambrel':
      return Math.min(width * rnd.range(0.5, 0.58), 2.8)
    case 'stepped':
      return Math.min(width * rnd.range(0.52, 0.6), 2.7)
    case 'side':
      return rnd.range(1.5, 2)
    case 'hip':
      return rnd.range(1.7, 2.2)
    case 'flat':
      return 0.34
  }
}

const round = (value: number) => Math.round(value * 100) / 100

function generateHouse(day: number, streetSeed: number, before: readonly HouseSpec[]): HouseSpec {
  const seed = hashSeed(streetSeed, 'haus', day)
  const rnd = createRandom(seed)
  const previous = before.at(-1)
  const beforePrevious = before.at(-2)

  const columns = rnd.chance(0.45) ? 2 : 3
  const width = round(columns === 2 ? rnd.range(3.7, 4.3) : rnd.range(4.8, 5.6))
  const depth = round(rnd.range(3.9, 4.6))

  let floors = rnd.weighted<1 | 2 | 3>([
    [1, 18],
    [2, 50],
    [3, 32],
  ])
  if (previous?.floors === floors && beforePrevious?.floors === floors) {
    floors = floors === 2 ? rnd.pick([1, 3] as const) : 2
  }

  const nearbyFamilies = [previous?.wall.family, beforePrevious?.wall.family]
  let wallStyle = rnd.weighted(WALL_STYLES)
  const repeatsStyle = wallStyle === previous?.wall.style
  const repeatsColor = WALL_COLORS[wallStyle].every(([, family]) => nearbyFamilies.includes(family))
  if (wallStyle !== 'plaster' && (repeatsStyle || repeatsColor)) wallStyle = 'plaster'
  const [wallColor, wallFamily] = pickWallColor(rnd, wallStyle, nearbyFamilies)
  const trim = rnd.pick(
    wallStyle !== 'timber' && brightness(wallColor) > 0.8 ? COLOR_TRIMS : LIGHT_TRIMS,
  )

  const roofType = pickAvoiding(rnd, roofOptions(floors, columns, wallStyle), previous?.roof.type)
  const doorStyle = rnd.weighted(DOOR_STYLES)
  const doorColor = pickContrasting(rnd, DOOR_COLORS, wallColor, 110)
  const windowStyle = rnd.weighted(WINDOW_STYLES)
  const doorColumn = columns === 2 ? rnd.int(0, 1) : rnd.weighted([[0, 30], [1, 40], [2, 30]] as const)

  const lightStyle = pickAvoiding(rnd, LIGHT_STYLES, previous?.lights.style)
  const lightPalette =
    lightStyle === 'icicle'
      ? rnd.pick(['ice', 'warm'] as const)
      : pickAvoiding(rnd, LIGHT_PALETTES, previous?.lights.palette)

  const yard: YardProp[] = []
  for (let column = 0; column < columns - 1; column++) {
    yard.push(rnd.weighted(YARD_PROPS.filter(([prop]) => prop === 'none' || !yard.includes(prop))))
  }
  if (!yard.some((prop) => prop !== 'none')) yard[0] = rnd.pick(['bush', 'fir', 'snowman'] as const)

  return {
    day,
    seed,
    width,
    depth,
    floors,
    columns,
    wall: {
      style: wallStyle,
      color: wallColor,
      family: wallFamily,
      trim,
      beam: rnd.pick(BEAM_COLORS),
    },
    roof: {
      type: roofType,
      height: round(roofHeight(roofType, width, floors, rnd)),
      color: pickContrasting(rnd, ROOF_COLORS, previous?.roof.color, 1),
      snow: round(rnd.range(0.16, 0.3)),
    },
    chimney: rnd.chance(0.75) ? round(rnd.pick([-1, 1]) * rnd.range(0.17, 0.3)) : null,
    door: {
      column: doorColumn,
      style: doorStyle,
      color: doorColor,
      deco: rnd.weighted(DOOR_DECOS),
      garland: doorStyle !== 'arch' && rnd.chance(0.34),
    },
    windows: {
      style: windowStyle,
      deco: rnd.weighted(WINDOW_DECOS),
      shutters:
        windowStyle !== 'arched' && rnd.chance(0.36)
          ? rnd.chance(0.6)
            ? doorColor
            : pickContrasting(rnd, DOOR_COLORS, wallColor, 90)
          : null,
    },
    lights: { style: lightStyle, palette: lightPalette },
    icicles: roofType !== 'stepped' && lightStyle !== 'icicle' && rnd.chance(0.55),
    peakStar: (roofType === 'gable' || roofType === 'gambrel' || roofType === 'hip') && rnd.chance(0.32),
    yard,
  }
}

/** Die Häuser der Straße (Tage 1 bis 23). Nachbarn unterscheiden sich in Farbe, Dach und Beleuchtung. */
export function generateStreet(streetSeed: number = STREET_SEED): HouseSpec[] {
  const houses: HouseSpec[] = []
  for (let day = 1; day <= HOUSE_COUNT; day++) houses.push(generateHouse(day, streetSeed, houses))
  return houses
}

/** Höhe der Fassade bis zur Dachkante. */
export function bodyHeight(spec: HouseSpec): number {
  return GROUND_FLOOR + (spec.floors - 1) * UPPER_FLOOR
}

/** Höhe bis zum First (ohne Schnee, Schornstein und Stern). */
export function ridgeHeight(spec: HouseSpec): number {
  return bodyHeight(spec) + spec.roof.height
}

/** Abstand der Fensterachsen. */
export function columnSpacing(spec: HouseSpec): number {
  return (spec.width - 2 * FACADE_PADDING) / spec.columns
}

/** Mitte einer Fensterachse, gemessen von der Hausmitte. */
export function columnX(spec: HouseSpec, column: number): number {
  return -spec.width / 2 + FACADE_PADDING + (column + 0.5) * columnSpacing(spec)
}

/**
 * Wo der Kranz hängt, in dem später das Selfie erscheint: im Giebel oder –
 * bei Häusern ohne Giebel zur Straße – in der Mitte des obersten Stockwerks.
 */
export function wreathSpot(spec: HouseSpec): { x: number; y: number; inGable: boolean } {
  if (isFrontGable(spec.roof.type)) {
    return { x: 0, y: bodyHeight(spec) + Math.max(0.58, spec.roof.height * 0.36), inGable: true }
  }
  return { x: 0, y: bodyHeight(spec) - UPPER_FLOOR + 1.15, inGable: false }
}

export interface Plot {
  spec: HouseSpec
  /** Mitte des Hauses entlang der Straße. */
  x: number
}

export interface StreetLayout {
  plots: Plot[]
  /** Rechte Kante des letzten Hauses. */
  endX: number
  /** Straßenschild am Anfang. */
  signX: number
  /** Das Tor (Tag 24) steht quer über der Straße, ein Stück hinter dem letzten Haus. */
  gateX: number
  /** Weihnachtsbaum auf dem Platz hinter dem Tor. */
  treeX: number
  cameraMinX: number
  /** Die Garage mit Basketballkorb in der Einfahrt zwischen Haus 14 und 15 (Mitte und Breite der Lücke). */
  garage: { x: number; gap: number }
}

/** Nach diesem Haus liegt die Einfahrt mit der Garage (Weihnachtskugelball). */
export const GARAGE_AFTER_DAY = 14
/** So breit ist die Lücke für Einfahrt und Garage. */
export const GARAGE_GAP = 5.6

/** Länge der Allee zwischen dem letzten Haus und dem Tor. */
const GATE_APPROACH = 19
/**
 * Abstand des Baums hinter dem Tor. Nah genug, dass er vom Tor aus über den
 * Bogen ragt – und weit genug, dass er hinter dem Tor ganz ins Bild passt.
 */
const TREE_BEHIND_GATE = PLAZA_RADIUS + 4.5

export function createStreetLayout(streetSeed: number = STREET_SEED): StreetLayout {
  const rnd = createRandom(hashSeed(streetSeed, 'strasse'))
  let cursor = 0
  let garageX = 0
  const plots = generateStreet(streetSeed).map((spec) => {
    const x = round(cursor + spec.width / 2)
    const gap = rnd.range(0.45, 1)
    cursor += spec.width + (spec.day === GARAGE_AFTER_DAY ? GARAGE_GAP : gap)
    if (spec.day === GARAGE_AFTER_DAY) garageX = round(x + spec.width / 2 + GARAGE_GAP / 2)
    return { spec, x }
  })
  const last = plots[plots.length - 1]
  const endX = last.x + last.spec.width / 2
  const gateX = round(endX + GATE_APPROACH)
  const treeX = round(gateX + TREE_BEHIND_GATE)
  return { plots, endX, signX: -5.5, gateX, treeX, cameraMinX: -4, garage: { x: garageX, gap: GARAGE_GAP } }
}
