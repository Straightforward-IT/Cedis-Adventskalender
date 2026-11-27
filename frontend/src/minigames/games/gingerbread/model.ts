/**
 * Lebkuchenhaus: Erst die Teile in der richtigen Reihenfolge zusammensetzen –
 * Platte, Wand, Dach, Schornstein, Tür –, dann mit Zuckerguss und Süßigkeiten
 * verzieren, ganz wie man mag.
 */

export const BOARD = { width: 400, height: 392 }
/** Unterhalb davon liegt die Ablage mit Teilen bzw. Süßigkeiten. */
export const TRAY_Y = 292
/** So nah (Spielfeld-Einheiten) muss ein Teil an seinem Platz losgelassen werden. */
export const SNAP = 34
/** So viele Süßigkeiten braucht das Haus mindestens. */
export const MIN_CANDIES = 5

export type PieceId = 'base' | 'wall' | 'roofLeft' | 'roofRight' | 'chimney' | 'door'

export interface Piece {
  id: PieceId
  label: string
  /** Umriss am Zielplatz. */
  path: string
  center: { x: number; y: number }
  size: { w: number; h: number }
  /** Diese Teile müssen schon stehen. */
  needs: PieceId[]
  /** Ohne passende Vorgänger: was dann fehlt. */
  hint: string
}

/** Reihenfolge = Zeichenreihenfolge: Schornstein liegt hinter dem Dach, die Tür vor der Wand. */
export const PIECES: readonly Piece[] = [
  { id: 'base', label: 'Bodenplatte', path: 'M76 262H324V280H76Z', center: { x: 200, y: 271 }, size: { w: 248, h: 18 }, needs: [], hint: '' },
  { id: 'wall', label: 'Wand', path: 'M110 172H290V262H110Z', center: { x: 200, y: 217 }, size: { w: 180, h: 90 }, needs: ['base'], hint: 'Erst die Bodenplatte!' },
  { id: 'chimney', label: 'Schornstein', path: 'M244 100H272V150H244Z', center: { x: 258, y: 125 }, size: { w: 28, h: 50 }, needs: ['roofRight'], hint: 'Der Schornstein braucht das rechte Dach.' },
  { id: 'roofLeft', label: 'Dach links', path: 'M80 186L200 90L200 114L94 200Z', center: { x: 143, y: 148 }, size: { w: 120, h: 110 }, needs: ['wall'], hint: 'Das Dach braucht erst eine Wand.' },
  { id: 'roofRight', label: 'Dach rechts', path: 'M320 186L200 90L200 114L306 200Z', center: { x: 257, y: 148 }, size: { w: 120, h: 110 }, needs: ['wall'], hint: 'Das Dach braucht erst eine Wand.' },
  { id: 'door', label: 'Tür', path: 'M186 262V228A14 14 0 0 1 214 228V262Z', center: { x: 200, y: 245 }, size: { w: 28, h: 48 }, needs: ['wall'], hint: 'Die Tür kommt in die Wand.' },
]

export const pieceById = (id: PieceId) => PIECES.find((p) => p.id === id)!

export function canPlace(placed: readonly PieceId[], id: PieceId): boolean {
  return !placed.includes(id) && pieceById(id).needs.every((need) => placed.includes(need))
}

export const isBuilt = (placed: readonly PieceId[]) => PIECES.every((p) => placed.includes(p.id))

/** Ist ein losgelassenes Teil nah genug an seinem Platz? */
export function nearSlot(id: PieceId, x: number, y: number): boolean {
  const { center } = pieceById(id)
  return Math.hypot(x - center.x, y - center.y) <= SNAP
}

export type CandyType = 'gumdropRed' | 'gumdropGreen' | 'smartie' | 'cane' | 'star' | 'heart'
export const CANDY_TYPES: readonly { type: CandyType; label: string }[] = [
  { type: 'gumdropRed', label: 'Rotes Gummibonbon' },
  { type: 'gumdropGreen', label: 'Grünes Gummibonbon' },
  { type: 'smartie', label: 'Schokolinse' },
  { type: 'cane', label: 'Zuckerstange' },
  { type: 'star', label: 'Zuckerstern' },
  { type: 'heart', label: 'Lebkuchenherz' },
]

export interface Candy {
  id: number
  type: CandyType
  x: number
  y: number
  /** Drehung in Grad – jede Süßigkeit sitzt etwas anders. */
  rotate: number
  /** Farbvariante (z. B. bei Schokolinsen). */
  variant: number
}

function inPolygon(x: number, y: number, points: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const ROOF = [[78, 186], [200, 88], [322, 186], [306, 202], [94, 202]] as const

/** Liegt der Punkt auf dem Haus? Nur dort halten Süßigkeiten. */
export function onHouse(x: number, y: number): boolean {
  if (x >= 108 && x <= 292 && y >= 170 && y <= 264) return true
  if (x >= 74 && x <= 326 && y >= 260 && y <= 282) return true
  if (x >= 242 && x <= 274 && y >= 98 && y <= 150) return true
  return inPolygon(x, y, ROOF)
}

export interface GingerbreadState {
  placed: PieceId[]
  candies: Candy[]
  icing: boolean
}

export const freshState = (): GingerbreadState => ({ placed: [], candies: [], icing: false })

export const isDecorated = (state: GingerbreadState) => state.icing && state.candies.length >= MIN_CANDIES

/** Gemerkten Stand prüfen – nur bekannte Teile, nur Süßigkeiten auf dem Haus. */
export function restoreState(value: unknown): GingerbreadState {
  const v = value as Partial<GingerbreadState> | null
  if (!v || typeof v !== 'object') return freshState()
  const ids = PIECES.map((p) => p.id)
  const placed: PieceId[] = []
  for (const id of Array.isArray(v.placed) ? v.placed : []) {
    if (ids.includes(id) && canPlace(placed, id)) placed.push(id)
  }
  const types = CANDY_TYPES.map((c) => c.type)
  const candies = (Array.isArray(v.candies) ? v.candies : [])
    .filter((c): c is Candy =>
      !!c && types.includes(c.type) && Number.isFinite(c.x) && Number.isFinite(c.y) && onHouse(c.x, c.y))
    .map((c, i) => ({ id: i + 1, type: c.type, x: c.x, y: c.y, rotate: Number(c.rotate) || 0, variant: Number(c.variant) || 0 }))
  const built = isBuilt(placed)
  return { placed, candies: built ? candies : [], icing: built && v.icing === true }
}
