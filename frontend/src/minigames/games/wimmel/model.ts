/**
 * Rentier-Suche (Haus 16): Rudolph braucht Hilfe für den Schlitten. In einem riesigen
 * Wimmelbild haben sich fünf Rentiere versteckt – zwischen Wald, Eisbahn und Weihnachtsmarkt.
 *
 * Hier steckt nur Logik: der Aufbau des Bildes (deterministisch aus einer Saat),
 * die Verstecke und das Treffen. Gezeichnet wird in `WimmelScene.tsx`.
 */
import { createRandom, hashSeed } from '../../../lib/rng.ts'
import type { Random } from '../../../lib/rng.ts'

/** Größe des Bildes in Bildeinheiten. */
export const WIDTH = 3000
export const HEIGHT = 2000
/** Ab hier beginnt der Boden – darüber Himmel und Berge. */
export const HORIZON = 600

export type Kind =
  | 'fir'
  | 'bareTree'
  | 'bush'
  | 'rock'
  | 'cottage'
  | 'elf'
  | 'elfGift'
  | 'skater'
  | 'snowman'
  | 'gift'
  | 'sled'
  | 'lantern'
  | 'dog'
  | 'horse'
  | 'fox'
  | 'rabbit'
  | 'penguin'
  | 'bear'
  | 'woodpile'
  | 'stall'
  | 'sleigh'
  | 'rudolph'
  | 'reindeer'
  | 'reindeerGraze'
  | 'reindeerRest'
  | 'reindeerSkate'

export interface Item {
  kind: Kind
  x: number
  /** Fußpunkt – danach wird auch gestaffelt: Was weiter unten steht, verdeckt, was dahinter steht. */
  y: number
  scale: number
  flip: boolean
  /** Farben für Jacke, Mütze, Papier … je nach Figur. */
  colors?: Record<string, string>
}

export interface Hideout {
  id: number
  x: number
  y: number
  /** Mitte des Rentiers – da wird getroffen und markiert. */
  cx: number
  cy: number
  radius: number
  kind: 'reindeer' | 'reindeerGraze' | 'reindeerRest' | 'reindeerSkate'
  scale: number
  flip: boolean
  /** Wo es steckt – für den Tipp. */
  where: string
  /** Halbe Breite einer freien Fläche davor – sonst verdecken zufällige Stände es ganz. */
  clearFront?: number
}

/** Die fünf Verstecke. Sie liegen fest, damit das Bild auf jedem Gerät gleich ist. */
export const HIDEOUTS: readonly Hideout[] = [
  { id: 0, x: 395, y: 1215, cx: 395, cy: 1170, radius: 58, kind: 'reindeer', scale: 0.95, flip: false, where: 'im dichten Wald links' },
  { id: 1, x: 2585, y: 1305, cx: 2570, cy: 1268, radius: 58, kind: 'reindeerGraze', scale: 0.95, flip: true, where: 'beim Weihnachtsmarkt', clearFront: 190 },
  { id: 2, x: 2205, y: 742, cx: 2205, cy: 720, radius: 46, kind: 'reindeerRest', scale: 0.72, flip: false, where: 'oben am Waldrand' },
  { id: 3, x: 2770, y: 1705, cx: 2755, cy: 1652, radius: 56, kind: 'reindeer', scale: 0.9, flip: true, where: 'im Wald rechts unten' },
  { id: 4, x: 1705, y: 1300, cx: 1705, cy: 1250, radius: 52, kind: 'reindeerSkate', scale: 0.78, flip: true, where: 'auf dem Eis' },
]

export const FOUND_GOAL = HIDEOUTS.length

/** Der Eisweiher in der Mitte. */
export const POND = { cx: 1520, cy: 1250, rx: 380, ry: 165 }
/** Rudolph steht vor Santas Schlitten – ihn zu finden, zählt nicht. */
export const RUDOLPH = { x: 1150, y: 1872, cx: 1180, cy: 1810, radius: 75 }

const ELF_COATS = ['#c2483c', '#3f6f57', '#2f6fa8', '#e8b04a', '#8b5bb8', '#e07a3a', '#d9577e', '#3a9aa0']
const HATS = ['#c2483c', '#3f6f57', '#f2efe6', '#e8b04a', '#2f6fa8', '#8b5bb8']
const PAPERS = ['#c2483c', '#3f6f57', '#2f6fa8', '#e8b04a', '#8b5bb8', '#e872a8', '#f08a3c']
const RIBBONS = ['#fff4d6', '#e8b04a', '#c2483c', '#f3f0e6']
const WALLS = ['#c2483c', '#d98b4a', '#3f6f57', '#2f6fa8', '#b78a5c', '#8a5a7a']
const AWNINGS = ['#c2483c', '#3f6f57', '#2f6fa8', '#e8b04a']
/** Braune Tiere, die einem Rentier zum Verwechseln ähnlich sehen. */
const BROWNS = ['#8a5a36', '#a06a3e', '#6f4a2e', '#9b7250']

function elfColors(rnd: Random): Record<string, string> {
  return { coat: rnd.pick(ELF_COATS), hat: rnd.pick(HATS), paper: rnd.pick(PAPERS), ribbon: rnd.pick(RIBBONS) }
}

function inPond(x: number, y: number, margin = 0): boolean {
  const dx = (x - POND.cx) / (POND.rx + margin)
  const dy = (y - POND.cy) / (POND.ry + margin)
  return dx * dx + dy * dy < 1
}

/** Nicht mitten auf ein Rentier stellen – verdecken dürfen nur die Bäume, die eigens dafür gesetzt sind. */
function nearHideout(x: number, y: number): boolean {
  return HIDEOUTS.some(
    (h) =>
      Math.hypot(x - h.cx, y - h.cy) < h.radius + 55 ||
      (h.clearFront !== undefined && Math.abs(x - h.cx) < h.clearFront && y > h.cy - 20 && y < h.cy + 170),
  ) || Math.hypot(x - RUDOLPH.x - 160, y - RUDOLPH.y + 30) < 260
}

/** Welche Gegend an dieser Stelle liegt. */
type Region = 'village' | 'forest' | 'pond' | 'market' | 'meadow' | 'eastwood'

function regionAt(x: number, y: number): Region {
  if (y < 860) return 'village'
  if (x < 820) return 'forest'
  if (inPond(x, y, 70)) return 'pond'
  if (x > 2080 && y < 1460) return 'market'
  if (x > 2420) return 'eastwood'
  return 'meadow'
}

function pickKind(rnd: Random, region: Region): Kind | null {
  switch (region) {
    case 'village':
      return rnd.weighted<Kind | null>([
        ['fir', 5], ['bareTree', 2], ['cottage', 3], ['elf', 3], ['elfGift', 2], ['bush', 2], ['snowman', 1], ['lantern', 1], ['dog', 0.6], ['rabbit', 0.6], [null, 2],
      ])
    case 'forest':
      return rnd.weighted<Kind | null>([
        ['fir', 12], ['bareTree', 3], ['bush', 2], ['rock', 1], ['fox', 0.8], ['rabbit', 1], ['elf', 1], ['bear', 0.4], ['woodpile', 0.6], ['horse', 0.3],
      ])
    case 'pond':
      return rnd.weighted<Kind | null>([['skater', 5], ['penguin', 1.5], [null, 2]])
    case 'market':
      return rnd.weighted<Kind | null>([
        ['stall', 3], ['elf', 5], ['elfGift', 4], ['horse', 1.2], ['dog', 1], ['lantern', 1.2], ['gift', 2], ['woodpile', 1], ['fir', 1],
      ])
    case 'eastwood':
      return rnd.weighted<Kind | null>([
        ['fir', 8], ['bareTree', 3], ['bush', 2], ['fox', 0.7], ['bear', 0.6], ['rabbit', 0.8], ['elf', 1], ['horse', 0.5], ['woodpile', 0.5],
      ])
    case 'meadow':
      return rnd.weighted<Kind | null>([
        ['elf', 4], ['elfGift', 3], ['snowman', 2], ['sled', 2], ['gift', 3], ['fir', 2], ['bush', 1.5], ['dog', 1], ['penguin', 1], ['rabbit', 1], ['lantern', 0.6], ['fox', 0.4], [null, 2],
      ])
  }
}

function makeItem(rnd: Random, kind: Kind, x: number, y: number): Item {
  // Weiter hinten (oben) wird alles etwas kleiner – so wirkt das Bild tief.
  const depth = 0.62 + ((y - HORIZON) / (HEIGHT - HORIZON)) * 0.5
  const item: Item = { kind, x, y, scale: depth * rnd.range(0.85, 1.15), flip: rnd.chance(0.5) }
  switch (kind) {
    case 'elf':
    case 'elfGift':
    case 'skater':
    case 'sled':
      item.colors = elfColors(rnd)
      break
    case 'gift':
      item.colors = { paper: rnd.pick(PAPERS), ribbon: rnd.pick(RIBBONS) }
      break
    case 'cottage':
      item.colors = { wall: rnd.pick(WALLS) }
      break
    case 'stall':
      item.colors = { awning: rnd.pick(AWNINGS) }
      break
    case 'dog':
    case 'horse':
    case 'bear':
      item.colors = { fur: rnd.pick(BROWNS) }
      break
    case 'fir':
      item.scale *= rnd.range(0.8, 1.4)
      break
  }
  return item
}

/** Bäume, die die Rentiere halb verdecken – genau so viel, dass man zweimal hinschauen muss. */
const COVERS: Item[] = [
  { kind: 'fir', x: 350, y: 1238, scale: 1.05, flip: false },
  { kind: 'fir', x: 452, y: 1250, scale: 0.95, flip: true },
  { kind: 'bareTree', x: 300, y: 1190, scale: 1, flip: false },
  { kind: 'bush', x: 395, y: 1232, scale: 0.9, flip: false },
  { kind: 'woodpile', x: 2650, y: 1292, scale: 0.85, flip: false },
  { kind: 'horse', x: 2720, y: 1300, scale: 0.85, flip: false, colors: { fur: '#8a5a36' } },
  { kind: 'stall', x: 2500, y: 1262, scale: 0.9, flip: false, colors: { awning: '#c2483c' } },
  { kind: 'bareTree', x: 2165, y: 745, scale: 0.85, flip: true },
  { kind: 'bareTree', x: 2252, y: 748, scale: 0.8, flip: false },
  { kind: 'bush', x: 2228, y: 757, scale: 0.7, flip: true },
  // Mitten zwischen den Schlittschuhläufern
  { kind: 'skater', x: 1655, y: 1318, scale: 0.95, flip: false, colors: { coat: '#c2483c', hat: '#3f6f57', paper: '#e8b04a', ribbon: '#fff4d6' } },
  { kind: 'skater', x: 1770, y: 1312, scale: 0.95, flip: true, colors: { coat: '#2f6fa8', hat: '#e8b04a', paper: '#e8b04a', ribbon: '#fff4d6' } },
  { kind: 'fir', x: 2805, y: 1722, scale: 1.1, flip: false },
  { kind: 'bareTree', x: 2712, y: 1690, scale: 1, flip: true },
  { kind: 'fir', x: 2690, y: 1735, scale: 0.85, flip: false },
]

/** Alles, was im Bild steht, hinten nach vorn sortiert – die Rentiere mittendrin. */
export function buildScene(seed = 16): Item[] {
  const rnd = createRandom(hashSeed('wimmelbild', seed))
  const items: Item[] = []
  const cell = 92
  for (let gy = HORIZON + 40; gy < HEIGHT + 20; gy += cell * 0.62) {
    for (let gx = 20; gx < WIDTH; gx += cell) {
      const x = gx + rnd.range(-cell * 0.4, cell * 0.4)
      const y = gy + rnd.range(-cell * 0.25, cell * 0.25)
      if (x < 15 || x > WIDTH - 15 || y > HEIGHT - 8) continue
      if (nearHideout(x, y)) continue
      const region = regionAt(x, y)
      if (region !== 'pond' && inPond(x, y, 40)) continue
      const kind = pickKind(rnd, region)
      if (!kind) continue
      items.push(makeItem(rnd, kind, x, y))
    }
  }
  items.push(...COVERS)
  for (const h of HIDEOUTS) items.push({ kind: h.kind, x: h.x, y: h.y, scale: h.scale, flip: h.flip })
  items.push({ kind: 'sleigh', x: 1480, y: 1860, scale: 1.25, flip: false })
  items.push({ kind: 'rudolph', x: RUDOLPH.x, y: RUDOLPH.y, scale: 1.2, flip: false })
  return items.sort((a, b) => a.y - b.y)
}

export interface WimmelState {
  /** Ids der gefundenen Rentiere, in der Reihenfolge des Findens. */
  found: number[]
}

export const freshGame = (): WimmelState => ({ found: [] })

export function restoreState(saved: unknown): WimmelState {
  if (!saved || typeof saved !== 'object') return freshGame()
  const found = (saved as { found?: unknown }).found
  if (!Array.isArray(found)) return freshGame()
  const ids = found.filter((id): id is number => HIDEOUTS.some((h) => h.id === id))
  return { found: [...new Set(ids)] }
}

/** Beim Wiederholen eines gelösten Hauses geht die Suche von vorn los. */
export function startGame(saved: unknown, completedBefore: boolean): WimmelState {
  const state = restoreState(saved)
  return completedBefore && isComplete(state) ? freshGame() : state
}

export const isComplete = (state: WimmelState): boolean => state.found.length >= FOUND_GOAL

export type Tap = { hit: 'reindeer'; id: number } | { hit: 'again'; id: number } | { hit: 'rudolph' } | { hit: 'miss' }

/** Was an dieser Bildstelle getroffen wird. `slack` vergrößert die Trefferkreise (in Bildeinheiten). */
export function tapAt(state: WimmelState, x: number, y: number, slack = 0): Tap {
  let best: Hideout | null = null
  let bestDistance = Infinity
  for (const h of HIDEOUTS) {
    const distance = Math.hypot(x - h.cx, y - h.cy)
    if (distance <= h.radius + slack && distance < bestDistance) {
      best = h
      bestDistance = distance
    }
  }
  if (best) return state.found.includes(best.id) ? { hit: 'again', id: best.id } : { hit: 'reindeer', id: best.id }
  if (Math.hypot(x - RUDOLPH.cx, y - RUDOLPH.cy) <= RUDOLPH.radius + slack) return { hit: 'rudolph' }
  return { hit: 'miss' }
}

export function markFound(state: WimmelState, id: number): WimmelState {
  return state.found.includes(id) ? state : { found: [...state.found, id] }
}

/** Das nächste noch versteckte Rentier – für den Tipp. */
export function nextHidden(state: WimmelState): Hideout | null {
  return HIDEOUTS.find((h) => !state.found.includes(h.id)) ?? null
}
