/**
 * Geschenke-Tetris: Pakete in sieben Formen fallen in den Stapel. Volle Reihen
 * werden auf den Schlitten geladen – sind genug Reihen voll, ist der Schlitten bereit.
 *
 * Alles hier ist reine Logik ohne Zeichnen oder Zeit.
 */

export const WIDTH = 10
export const HEIGHT = 16
/** So viele volle Reihen braucht der Schlitten. */
export const GOAL = 5

/** 0 = leer, 1–7 = Geschenkart. Dazu BOW (+8): Auf dieser Zelle sitzt die Schleife. */
export type Cell = number
export type Board = Cell[][]
export const BOW = 8

export interface PresentKind {
  name: string
  /** Quadratische Matrix in Grundstellung. */
  shape: number[][]
  paper: string
  ribbon: string
}

/** Index 1–7 (0 bleibt leer). */
export const KINDS: PresentKind[] = [
  { name: '', shape: [], paper: '', ribbon: '' },
  { name: 'Skipaket', shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], paper: '#3fa7c9', ribbon: '#fff4d6' },
  { name: 'Spielzeugkiste', shape: [[1, 1], [1, 1]], paper: '#f2c14e', ribbon: '#c2483c' },
  { name: 'Schaukelpferd', shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], paper: '#9b6ad1', ribbon: '#f6d77a' },
  { name: 'Schlittschuhe', shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], paper: '#4fae6b', ribbon: '#e94b4b' },
  { name: 'Zuckerstange', shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], paper: '#e2504c', ribbon: '#f3f0e6' },
  { name: 'Hockeyschläger', shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], paper: '#f08a3c', ribbon: '#2f6f4f' },
  { name: 'Regenschirm', shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], paper: '#e872a8', ribbon: '#fff4d6' },
]

export interface Piece {
  kind: number
  rot: number
  x: number
  y: number
}

export const emptyBoard = (): Board => Array.from({ length: HEIGHT }, () => new Array<Cell>(WIDTH).fill(0))

const rotateOnce = (m: number[][]): number[][] => m.map((row, y) => row.map((_, x) => m[m.length - 1 - x][y]))

/** Die Zellen eines Pakets relativ zu seiner Ecke, in Leserichtung (erste Zelle trägt die Schleife). */
export function shapeCells(kind: number, rot: number): [number, number][] {
  let m = KINDS[kind].shape
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = rotateOnce(m)
  const cells: [number, number][] = []
  m.forEach((row, y) => row.forEach((v, x) => v && cells.push([x, y])))
  return cells
}

export const cellsOf = (p: Piece): [number, number][] => shapeCells(p.kind, p.rot).map(([x, y]) => [p.x + x, p.y + y])

export function fits(board: Board, p: Piece): boolean {
  return cellsOf(p).every(([x, y]) => x >= 0 && x < WIDTH && y < HEIGHT && (y < 0 || board[y][x] === 0))
}

/** Ein neues Paket oben in der Mitte. */
export function spawn(kind: number): Piece {
  const size = KINDS[kind].shape.length
  const top = Math.min(...shapeCells(kind, 0).map(([, y]) => y))
  return { kind, rot: 0, x: Math.floor((WIDTH - size) / 2), y: -top }
}

export function move(board: Board, p: Piece, dx: number, dy: number): Piece | null {
  const next = { ...p, x: p.x + dx, y: p.y + dy }
  return fits(board, next) ? next : null
}

/** Drehen – stößt das Paket an, wird es ein Stück zur Seite (oder hoch) geschoben. */
export function rotate(board: Board, p: Piece, dir: 1 | -1): Piece | null {
  const rot = (p.rot + dir + 4) % 4
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]]) {
    const next = { ...p, rot, x: p.x + dx, y: p.y + dy }
    if (fits(board, next)) return next
  }
  return null
}

/** Wo das Paket landen würde. */
export function dropTarget(board: Board, p: Piece): Piece {
  let at = p
  for (let next = move(board, at, 0, 1); next; next = move(board, at, 0, 1)) at = next
  return at
}

export interface LockResult {
  board: Board
  /** Volle Reihen (von oben gezählt), noch nicht entfernt. */
  full: number[]
  /** Ragt das Paket oben aus dem Stapel heraus? */
  overflow: boolean
}

export function lock(board: Board, p: Piece): LockResult {
  const next = board.map((row) => row.slice())
  let overflow = false
  cellsOf(p).forEach(([x, y], i) => {
    if (y < 0) overflow = true
    else next[y][x] = p.kind + (i === 0 ? BOW : 0)
  })
  const full = next.flatMap((row, y) => (row.every((c) => c !== 0) ? [y] : []))
  return { board: next, full, overflow }
}

export function clearRows(board: Board, rows: number[]): Board {
  const kept = board.filter((_, y) => !rows.includes(y))
  return [...Array.from({ length: rows.length }, () => new Array<Cell>(WIDTH).fill(0)), ...kept]
}

/** Die nächsten sieben Pakete – jede Form genau einmal, gut gemischt. */
export function bag(random: () => number = Math.random): number[] {
  const kinds = [1, 2, 3, 4, 5, 6, 7]
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return kinds
}

/** Sekunden pro Reihe – mit jeder beladenen Reihe ein bisschen flotter. */
export const fallInterval = (rows: number) => Math.max(0.38, 0.9 - rows * 0.045)

export interface Saved {
  rows: number
  board: Board
}

export function restore(saved: unknown): Saved {
  const s = (saved ?? {}) as Partial<Saved>
  const rows = Number.isFinite(s.rows) ? Math.max(0, Math.min(GOAL, Math.floor(s.rows as number))) : 0
  const valid =
    Array.isArray(s.board) &&
    s.board.length === HEIGHT &&
    s.board.every((row) => Array.isArray(row) && row.length === WIDTH && row.every((c) => Number.isInteger(c) && c >= 0 && c < 16))
  return { rows, board: valid ? (s.board as Board) : emptyBoard() }
}
