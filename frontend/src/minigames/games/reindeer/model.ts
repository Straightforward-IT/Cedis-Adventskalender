/**
 * Punkt für Punkt: Im Schnee versteckt sich ein Rentierkopf. Die Punkte tragen keine
 * Zahlen – wer die Umrisse erkennt, findet den Weg. Der Umriss ist eine geschlossene
 * Runde; am Startpunkt darf man in beide Richtungen loslegen.
 */

export interface Dot {
  x: number
  y: number
}

/** Spielfeld in SVG-Einheiten. */
export const BOARD = { width: 400, height: 440 }

/** Linke Gesichtshälfte vom Kinn bis zur Stirn; die rechte entsteht gespiegelt. */
const LEFT_HALF: readonly Dot[] = [
  // Maul und Wange mit Fellbüschel
  { x: 162, y: 410 },
  { x: 134, y: 386 },
  { x: 124, y: 350 },
  { x: 130, y: 312 },
  { x: 108, y: 296 },
  { x: 120, y: 274 },
  { x: 108, y: 240 },
  // Ohr
  { x: 76, y: 236 },
  { x: 34, y: 216 },
  { x: 60, y: 192 },
  { x: 100, y: 196 },
  // Geweih: außen hinauf zur Spitze, innen über drei Enden zurück
  { x: 112, y: 166 },
  { x: 92, y: 136 },
  { x: 70, y: 104 },
  { x: 46, y: 64 },
  { x: 86, y: 84 },
  { x: 98, y: 36 },
  { x: 118, y: 92 },
  { x: 150, y: 54 },
  { x: 140, y: 120 },
  { x: 176, y: 100 },
  { x: 156, y: 142 },
  // Stirnlocke
  { x: 180, y: 126 },
]

/** Wo in LEFT_HALF das Geweih liegt (erster und letzter Punkt). */
const ANTLER_FROM = 11
const ANTLER_TO = 21

const FOREHEAD: Dot = { x: 200, y: 148 }
const CHIN: Dot = { x: 200, y: 418 }
const mirror = (dot: Dot): Dot => ({ x: BOARD.width - dot.x, y: dot.y })
const HALF = LEFT_HALF.length

/** Die Runde in Zeichenreihenfolge: Stirn, links hinunter zum Kinn, rechts wieder hinauf. */
export const DOTS: readonly Dot[] = [FOREHEAD, ...[...LEFT_HALF].reverse(), CHIN, ...LEFT_HALF.map(mirror)]

/**
 * Lockvögel: Punkte, die zu keinem Umriss gehören. Bewusst nicht spiegelgleich verteilt,
 * damit die Symmetrie nicht verrät, welche Punkte echt sind.
 */
export const DECOYS: readonly Dot[] = [
  { x: 200, y: 90 },
  { x: 126, y: 22 },
  { x: 338, y: 140 },
  { x: 200, y: 232 },
  { x: 352, y: 250 },
  { x: 84, y: 330 },
  { x: 304, y: 400 },
  { x: 200, y: 380 },
  { x: 240, y: 300 },
  { x: 30, y: 110 },
]

/** Alle sichtbaren Punkte: erst die Runde (Index = Position im Weg), dann die Lockvögel. */
export const ALL_DOTS: readonly Dot[] = [...DOTS, ...DECOYS]

export function isDecoy(dot: number): boolean {
  return dot >= DOTS.length && dot < ALL_DOTS.length
}

/** Geweih-Punkte jeder Seite in DOTS – für die fertige Zeichnung. */
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
export const ANTLER_LEFT: readonly number[] = range(HALF - ANTLER_TO, HALF - ANTLER_FROM)
export const ANTLER_RIGHT: readonly number[] = range(HALF + 2 + ANTLER_FROM, HALF + 2 + ANTLER_TO)

/** Ab so vielen Fehlversuchen in Folge leuchtet der richtige Punkt auf. */
export const HINT_AFTER = 3

export interface DotsState {
  version: 2
  /** 0, solange nur der Startpunkt steht; danach die gewählte Laufrichtung. */
  direction: -1 | 0 | 1
  /** Anzahl gezogener Linien. Bei DOTS.length ist die Runde zurück am Start geschlossen. */
  lines: number
  /** Fehlversuche seit der letzten richtigen Linie. */
  misses: number
}

export type ConnectResult = 'correct' | 'wrong' | 'ignored'

export function freshGame(): DotsState {
  return { version: 2, direction: 0, lines: 0, misses: 0 }
}

const wrap = (index: number) => ((index % DOTS.length) + DOTS.length) % DOTS.length

/** Die bisher verbundenen Punkte in Zeichenreihenfolge, beginnend am Start. */
export function connectedPath(state: DotsState): number[] {
  const step = state.direction || 1
  return Array.from({ length: state.lines + 1 }, (_, i) => wrap(i * step))
}

export function currentDot(state: DotsState): number {
  return wrap(state.lines * (state.direction || 1))
}

export function isComplete(state: DotsState): boolean {
  return state.lines >= DOTS.length
}

/** Punkte, die jetzt eine richtige Linie ergeben. Am Anfang führen beide Nachbarn weiter. */
export function expectedDots(state: DotsState): number[] {
  if (isComplete(state)) return []
  if (state.direction === 0) return [wrap(1), wrap(-1)]
  return [wrap((state.lines + 1) * state.direction)]
}

/** Der Punkt, der nach drei Fehlversuchen aufleuchtet. */
export function hintDot(state: DotsState): number | null {
  return state.misses >= HINT_AFTER ? expectedDots(state)[0] ?? null : null
}

/** Ein Tipp auf einen Punkt: richtige Linien bleiben, falsche verschwinden wieder. */
export function connect(state: DotsState, dot: number): { state: DotsState; result: ConnectResult } {
  if (isComplete(state) || !Number.isInteger(dot) || dot < 0 || dot >= ALL_DOTS.length) return { state, result: 'ignored' }
  if (expectedDots(state).includes(dot)) {
    const direction = state.direction || (dot === wrap(1) ? 1 : -1)
    return { state: { ...state, direction, lines: state.lines + 1, misses: 0 }, result: 'correct' }
  }
  // Schon verbundene Punkte (und der aktuelle) sind kein Fehlversuch – nur ein Verklicker.
  // Lockvögel zählen dagegen immer als falsche Linie.
  if (connectedPath(state).includes(dot)) return { state, result: 'ignored' }
  return { state: { ...state, misses: Math.min(state.misses + 1, HINT_AFTER) }, result: 'wrong' }
}

/** Spielstände sind Browserdaten und können aus einer älteren Version stammen. */
export function restoreGame(value: unknown): DotsState {
  if (!value || typeof value !== 'object') return freshGame()
  const saved = value as Record<string, unknown>
  const { direction, lines, misses } = saved
  if (saved.version !== 2 || (direction !== -1 && direction !== 0 && direction !== 1)
    || !Number.isInteger(lines) || !Number.isInteger(misses)) return freshGame()
  const lineCount = lines as number
  const missCount = misses as number
  if (lineCount < 0 || lineCount > DOTS.length || missCount < 0 || missCount > HINT_AFTER) return freshGame()
  if ((direction === 0) !== (lineCount === 0)) return freshGame()
  return { version: 2, direction, lines: lineCount, misses: missCount }
}

/** Wer ein gelöstes Rentier erneut besucht, beginnt mit einem leeren Schneefeld. */
export function startGame(value: unknown, completedBefore: boolean): DotsState {
  const restored = restoreGame(value)
  return completedBefore && isComplete(restored) ? freshGame() : restored
}
