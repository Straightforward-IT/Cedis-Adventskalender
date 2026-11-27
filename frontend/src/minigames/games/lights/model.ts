/**
 * Lichterketten-Schlamassel: Die Lichterkette für Haus 9 kommt in drei Strängen aus der
 * Kiste – und die sind ineinander verheddert. Jeder Strang führt durch die Schlaufen der
 * anderen bis zu seinem Stecker. Wer einen Stecker greift, schiebt ihn rückwärts den Weg
 * entlang, den der Strang genommen hat – Schlaufe für Schlaufe, bis er frei ist. Dann kommt
 * er in die Mehrfachsteckdose, und erst dann leuchten seine bunten Lämpchen.
 *
 * Die Reihenfolge zählt: Eine Schlaufe, durch die noch ein anderes Kabel steckt, lässt
 * sich nicht aufziehen – sie zieht sich nur fester zu.
 */

export interface Point {
  x: number
  y: number
}

/** Spielfeld in SVG-Einheiten. */
export const BOARD = { width: 400, height: 540 }

/** Ein Wegpunkt oder eine Schlaufe, die das Kabel an dieser Stelle dreht. */
export type Step = Point | { loop: Point; r: number; dir: 1 | -1 }

export interface CableSpec {
  /** Für Texte: „der graue Strang“. */
  name: string
  /** Kabelfarbe – grün oder grau wie bei echten Lichterketten. */
  color: string
  dark: string
  /** Von der Kiste zum Stecker. */
  steps: Step[]
}

export interface Loop {
  center: Point
  r: number
  /** Wo die Schlaufe auf dem eigenen Kabel beginnt und endet (Weglänge ab der Steckdose). */
  from: number
  to: number
}

export interface Cable {
  spec: CableSpec
  /** Dicht abgetastete Kabelmitte mit der Weglänge ab der Steckdose. */
  points: Point[]
  lengths: number[]
  total: number
  loops: Loop[]
}

/** Kabel `by` steckt durch Schlaufe `loop` von Kabel `owner`. */
export interface Thread {
  by: number
  owner: number
  loop: number
  /** Weglänge auf `by`: hinein in die Schlaufe, Mitte, wieder hinaus. */
  enter: number
  at: number
  exit: number
}

export interface Level {
  cables: Cable[]
  threads: Thread[]
}

/** Unten die Kiste, aus der die Stränge kommen, oben die Mehrfachsteckdose. */
export const BOX = { x: 92, y: 488, width: 216, height: 60 }

/** Die Farben der Lämpchen – dieselben hängen nachher am Haus. */
export const LAMP_COLORS = ['#ff4b4b', '#ffc93c', '#4fd36b', '#4aa8ff', '#ff7ad9'] as const
/** So viele Lämpchen hat jeder Strang. */
export const LAMPS_PER_CABLE = 14
/** Farbe von Lämpchen `lamp` auf Strang `cable` – reihum, jeder Strang beginnt woanders. */
export const lampColor = (cable: number, lamp: number) => LAMP_COLORS[(lamp + cable * 2) % LAMP_COLORS.length]

/*
 * Sechs Schlaufen, je zwei bis drei pro Strang. Reihenfolge von der Kiste zum Stecker
 * (S = eigene Schlaufe, D = steckt durch die Schlaufe eines anderen):
 *   grün:        D dunkel-1 · S grün-1 · S grün-2 · D dunkel-2 · D grau
 *   grau:        S grau · D grün-1 · D dunkel-3 · D grün-2 · D dunkel-2
 *   dunkelgrün:  S dunkel-1 · S dunkel-2 · S dunkel-3 · D grün-1 · D grau
 * Durch grün-1, grau und dunkel-2 laufen jeweils beide anderen Stränge. Keiner kommt allein
 * frei: Erst zieht man grün und dunkelgrün ein Stück zurück, dann ist grau frei, dann der Rest.
 */
export const CABLE_SPECS: readonly CableSpec[] = [
  {
    name: 'grüne',
    color: '#4f9a5e',
    dark: '#1f4a2a',
    steps: [
      { x: 150, y: 498 },
      { x: 122, y: 462 },
      { x: 96, y: 400 },
      { x: 80, y: 300 },
      { x: 112, y: 262 },
      { x: 170, y: 300 },
      { x: 250, y: 335 },
      { loop: { x: 305, y: 305 }, r: 27, dir: 1 },
      { x: 255, y: 262 },
      { loop: { x: 200, y: 255 }, r: 27, dir: -1 },
      { x: 170, y: 215 },
      { x: 135, y: 195 },
      { x: 110, y: 240 },
      { x: 150, y: 300 },
      { x: 175, y: 360 },
      { x: 200, y: 405 },
      { x: 258, y: 436 },
    ],
  },
  {
    name: 'graue',
    color: '#9aa2a8',
    dark: '#4a5258',
    steps: [
      { x: 200, y: 498 },
      { x: 204, y: 462 },
      { loop: { x: 200, y: 405 }, r: 27, dir: 1 },
      { x: 275, y: 400 },
      { x: 330, y: 360 },
      { x: 305, y: 305 },
      { x: 290, y: 245 },
      { x: 300, y: 185 },
      { x: 265, y: 140 },
      { x: 225, y: 185 },
      { x: 200, y: 255 },
      { x: 175, y: 235 },
      { x: 135, y: 195 },
      { x: 88, y: 160 },
    ],
  },
  {
    name: 'dunkelgrüne',
    color: '#2f6a47',
    dark: '#0f2a1a',
    steps: [
      { x: 250, y: 498 },
      { x: 236, y: 468 },
      { x: 140, y: 452 },
      { x: 62, y: 400 },
      { x: 52, y: 330 },
      { loop: { x: 80, y: 300 }, r: 27, dir: -1 },
      { x: 100, y: 250 },
      { loop: { x: 135, y: 195 }, r: 27, dir: 1 },
      { x: 190, y: 150 },
      { x: 250, y: 148 },
      { loop: { x: 300, y: 185 }, r: 27, dir: 1 },
      { x: 355, y: 240 },
      { x: 362, y: 300 },
      { x: 305, y: 305 },
      { x: 262, y: 330 },
      { x: 240, y: 360 },
      { x: 200, y: 405 },
      { x: 160, y: 445 },
    ],
  },
]

/** Die Mehrfachsteckdose oben auf dem Regalbrett – jede Dose passt für jeden Strang. */
export const OUTLETS: readonly Point[] = [{ x: 122, y: 92 }, { x: 200, y: 92 }, { x: 278, y: 92 }]
export const OUTLET_STRIP = { x: 72, y: 66, width: 256, height: 52 }

/** Wie nah man den Stecker an eine Dose bringen muss. */
export const PORT_RADIUS = 44
/** Weiter als so weit vom Kabelweg weg reißt der Finger nicht mehr am Stecker. */
export const GRIP = 60
/** Höchstens so weit rutscht der Stecker pro Bewegung am Kabel entlang. */
export const SLIDE = 48
/** Kurz vor der ersten Schlaufe ist das Kabel frei. */
const FREE_MARGIN = 14

const isLoop = (step: Step): step is Extract<Step, { loop: Point }> => 'loop' in step
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Catmull-Rom durch alle Kontrollpunkte – ergibt einen weich gebogenen Kabelverlauf. */
function smooth(control: Point[]): Point[] {
  const out: Point[] = [control[0]]
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)]
    const p1 = control[i]
    const p2 = control[i + 1]
    const p3 = control[Math.min(control.length - 1, i + 2)]
    const n = Math.max(2, Math.ceil(dist(p1, p2) / 3))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  return out
}

/** Die Kontrollpunkte einer Schlaufe: eine ganze Runde plus ein Stück, damit sich das Kabel kreuzt. */
function loopControl(prev: Point, step: Extract<Step, { loop: Point }>): Point[] {
  const { loop: c, r, dir } = step
  const start = Math.atan2(prev.y - c.y, prev.x - c.x)
  const pts: Point[] = []
  for (let k = 0; k <= 27; k++) {
    const a = start + dir * (k * Math.PI) / 12
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
  }
  return pts
}

export function buildCable(spec: CableSpec): Cable {
  const control: Point[] = []
  const loopRanges: { index: number; from: number; to: number }[] = []
  spec.steps.forEach((step, index) => {
    if (isLoop(step)) {
      const pts = loopControl(control[control.length - 1], step)
      loopRanges.push({ index, from: control.length, to: control.length + pts.length - 1 })
      control.push(...pts)
    } else {
      control.push(step)
    }
  })

  const points = smooth(control)
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]))

  // Wo auf dem geglätteten Kabel liegen die Schlaufen? Am nächsten Punkt zum ersten bzw. letzten Kontrollpunkt.
  const nearestS = (p: Point, after: number) => {
    let best = -1
    for (let i = 0; i < points.length; i++) {
      if (lengths[i] < after) continue
      if (best < 0 || dist(points[i], p) < dist(points[best], p) - 0.01) best = i
      if (best >= 0 && dist(points[best], p) < 0.5) break
    }
    return lengths[best]
  }
  const loops: Loop[] = []
  let searchFrom = 0
  for (const range of loopRanges) {
    const step = spec.steps[range.index] as Extract<Step, { loop: Point }>
    const from = nearestS(control[range.from], searchFrom)
    const to = nearestS(control[range.to], from + step.r * 4)
    loops.push({ center: step.loop, r: step.r, from, to })
    searchFrom = to
  }

  return { spec, points, lengths, total: lengths[lengths.length - 1], loops }
}

/** Findet, welches Kabel durch welche Schlaufe steckt: Es läuft durch ihre Mitte. */
export function findThreads(cables: Cable[]): Thread[] {
  const threads: Thread[] = []
  cables.forEach((owner, o) => {
    owner.loops.forEach((loop, l) => {
      cables.forEach((cable, by) => {
        if (by === o) return
        let best = 0
        cable.points.forEach((p, i) => {
          if (dist(p, loop.center) < dist(cable.points[best], loop.center)) best = i
        })
        if (dist(cable.points[best], loop.center) > loop.r * 0.5) return
        let enter = best
        while (enter > 0 && dist(cable.points[enter], loop.center) < loop.r) enter--
        let exit = best
        while (exit < cable.points.length - 1 && dist(cable.points[exit], loop.center) < loop.r) exit++
        threads.push({ by, owner: o, loop: l, enter: cable.lengths[enter], at: cable.lengths[best], exit: cable.lengths[exit] })
      })
    })
  })
  return threads
}

export function buildLevel(specs: readonly CableSpec[] = CABLE_SPECS): Level {
  const cables = specs.map(buildCable)
  return { cables, threads: findThreads(cables) }
}

export const LEVEL = buildLevel()

/** Punkt auf dem Kabel bei Weglänge `s`. */
export function pointAt(cable: Cable, s: number): Point {
  const { points, lengths } = cable
  if (s <= 0) return points[0]
  if (s >= cable.total) return points[points.length - 1]
  let lo = 0
  let hi = lengths.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= s) lo = mid
    else hi = mid
  }
  const t = (s - lengths[lo]) / (lengths[hi] - lengths[lo] || 1)
  return { x: points[lo].x + (points[hi].x - points[lo].x) * t, y: points[lo].y + (points[hi].y - points[lo].y) * t }
}

/** Richtung des Kabels bei `s` in Grad (0° = nach rechts). */
export function angleAt(cable: Cable, s: number): number {
  const a = pointAt(cable, Math.max(0, s - 6))
  const b = pointAt(cable, Math.min(cable.total, s + 0.01))
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** Die Kabelpunkte von `from` bis `to` (Weglängen). */
export function slice(cable: Cable, from: number, to: number): Point[] {
  if (to <= from) return []
  const inner = cable.points.filter((_, i) => cable.lengths[i] > from && cable.lengths[i] < to)
  return [pointAt(cable, from), ...inner, pointAt(cable, to)]
}

/** Ab dieser Länge ist das Kabel aus allen Schlaufen heraus – auch aus seinen eigenen. */
export function freeLength(level: Level, cable: number): number {
  const marks = [
    ...level.threads.filter((t) => t.by === cable).map((t) => t.enter),
    ...level.cables[cable].loops.map((l) => l.from),
  ]
  return Math.max(0, Math.min(...marks) - FREE_MARGIN)
}

export type CableStatus = 'tangled' | 'free' | 'plugged'

export interface CableState {
  status: CableStatus
  /** Wie weit das Kabel noch im Knäuel liegt (Weglänge bis zum Stecker). */
  length: number
  /** Wo der Stecker liegt, sobald das Kabel frei ist. */
  plug: Point | null
  /** In welcher Dose er steckt. */
  outlet: number | null
}

/** Steckt Kabel `by` gerade (noch) durch die Schlaufe? */
export function isThreaded(thread: Thread, states: readonly CableState[]): boolean {
  const state = states[thread.by]
  return state.status === 'tangled' && state.length > thread.enter
}

/**
 * Wie kurz darf das Kabel werden? Eine eigene Schlaufe, durch die noch ein anderes Kabel
 * steckt, kann man nicht aufziehen. Gibt die Grenze und – falls es eine solche gibt – das
 * Kabel, das im Weg ist.
 */
export function limit(level: Level, cable: number, states: readonly CableState[]): { min: number; blocker: number | null } {
  let min = freeLength(level, cable)
  let blocker: number | null = null
  for (const thread of level.threads) {
    if (thread.owner !== cable || !isThreaded(thread, states)) continue
    const loopEnd = level.cables[cable].loops[thread.loop].to
    if (loopEnd > min) {
      min = loopEnd
      blocker = thread.by
    }
  }
  return { min, blocker }
}

export interface Pull {
  length: number
  /** Das Kabel ist jetzt aus allem heraus. */
  freed: boolean
  /** Der Finger zieht vom Kabelweg weg – nichts bewegt sich. */
  taut: boolean
  /** Ein anderes Kabel hält eine Schlaufe fest, die man gerade aufziehen will. */
  blocker: number | null
}

/**
 * Den Stecker zum Finger hin am Kabel entlang schieben: Er rutscht nur auf seinem eigenen
 * Weg, pro Bewegung ein Stück, und nie hinter eine festgehaltene Schlaufe.
 */
export function pull(level: Level, cable: number, states: readonly CableState[], finger: Point): Pull {
  const c = level.cables[cable]
  const current = states[cable].length
  const { min, blocker } = limit(level, cable, states)
  let bestS = current
  let bestD = dist(pointAt(c, current), finger)
  for (let i = 0; i < c.points.length; i++) {
    const s = c.lengths[i]
    if (s < current - SLIDE || s > current + SLIDE) continue
    const d = dist(c.points[i], finger)
    if (d < bestD) {
      bestD = d
      bestS = s
    }
  }
  if (bestD > GRIP) return { length: current, freed: false, taut: true, blocker: null }
  const wanted = Math.min(c.total, bestS)
  const length = Math.max(min, wanted)
  const stopped = wanted < min - 1 && blocker !== null
  return { length, freed: !stopped && length <= freeLength(level, cable) + 0.01, taut: false, blocker: stopped ? blocker : null }
}

export const startStates = (level: Level = LEVEL): CableState[] =>
  level.cables.map((c) => ({ status: 'tangled', length: c.total, plug: null, outlet: null }))

/** Die nächste freie Dose in Reichweite des Steckers – oder null. */
export function outletNear(p: Point, states: readonly CableState[]): number | null {
  let found: number | null = null
  OUTLETS.forEach((outlet, i) => {
    if (states.some((s) => s.status === 'plugged' && s.outlet === i)) return
    if (dist(outlet, p) < PORT_RADIUS && (found === null || dist(outlet, p) < dist(OUTLETS[found], p))) found = i
  })
  return found
}

/** Wo der Stecker gerade ist und wohin er zeigt (Grad, 0° = nach rechts). */
export function plugPose(level: Level, index: number, state: CableState): { at: Point; angle: number } {
  const cable = level.cables[index]
  if (state.status === 'tangled') return { at: pointAt(cable, state.length), angle: angleAt(cable, state.length) }
  if (state.status === 'plugged' && state.outlet !== null) return { at: OUTLETS[state.outlet], angle: -90 }
  return { at: state.plug ?? pointAt(cable, state.length), angle: -90 }
}

/**
 * Der sichtbare Verlauf eines Strangs als Linienzug: im Knäuel bis zum Stecker, frei
 * als lockerer Bogen hinauf zum Stecker (der nach oben zeigt, das Kabel hängt darunter).
 */
export function wirePoints(level: Level, index: number, state: CableState): Point[] {
  const cable = level.cables[index]
  if (state.status === 'tangled') return slice(cable, 0, state.length)
  const free = freeLength(level, index)
  const base = slice(cable, 0, free)
  const from = pointAt(cable, free)
  const dir = (angleAt(cable, free) * Math.PI) / 180
  const { at } = plugPose(level, index, state)
  const tail = { x: at.x, y: at.y + (state.status === 'plugged' ? 42 : 18) }
  const reach = Math.max(50, dist(tail, from) * 0.45)
  const c1 = { x: from.x + Math.cos(dir) * reach, y: from.y + Math.sin(dir) * reach }
  const c2 = { x: tail.x, y: tail.y + reach }
  const steps = Math.max(8, Math.ceil(dist(from, tail) / 6))
  for (let k = 1; k <= steps; k++) {
    const t = k / steps
    const u = 1 - t
    base.push({
      x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * tail.x,
      y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * tail.y,
    })
  }
  return base
}

/**
 * Die Lämpchen eines Strangs, gleichmäßig über den sichtbaren Verlauf verteilt – so
 * wandern sie mit, wenn man den Strang durch die Schlaufen zieht. Der Winkel zeigt,
 * wohin das Lämpchen vom Kabel absteht (abwechselnd links und rechts).
 */
export function lampsAlong(points: readonly Point[], count: number = LAMPS_PER_CABLE): { at: Point; angle: number }[] {
  if (points.length < 2) return []
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]))
  const total = lengths[lengths.length - 1]
  const lamps: { at: Point; angle: number }[] = []
  let i = 1
  for (let k = 0; k < count; k++) {
    // Am Anfang (Kiste) und am Ende (Stecker) bleibt etwas Kabel frei.
    const s = total * (0.06 + (0.88 * (k + 0.5)) / count)
    while (i < lengths.length - 1 && lengths[i] < s) i++
    const a = points[i - 1]
    const b = points[i]
    const t = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)
    const along = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    lamps.push({ at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, angle: along + (k % 2 ? 90 : -90) })
  }
  return lamps
}

export const isDone = (states: readonly CableState[]) => states.every((s) => s.status === 'plugged')

export interface CablesSave {
  cables: CableState[]
}

/** Gemerkten Stand übernehmen – alles Unpassende fällt auf den Anfang zurück. */
export function restore(value: unknown, level: Level = LEVEL): CableState[] {
  const start = startStates(level)
  const saved = (value as Partial<CablesSave> | null)?.cables
  if (!Array.isArray(saved) || saved.length !== start.length) return start
  const ok = saved.every((s: Partial<CableState> | null, i) => {
    if (!s || !['tangled', 'free', 'plugged'].includes(s.status as string)) return false
    if (typeof s.length !== 'number' || !Number.isFinite(s.length) || s.length < 0 || s.length > level.cables[i].total + 0.01) return false
    if (s.status === 'free') return !!s.plug && Number.isFinite(s.plug.x) && Number.isFinite(s.plug.y)
    if (s.status === 'plugged') return Number.isInteger(s.outlet) && (s.outlet as number) >= 0 && (s.outlet as number) < OUTLETS.length
    return true
  })
  const outlets = saved.filter((s: CableState) => s.status === 'plugged').map((s: CableState) => s.outlet)
  if (!ok || new Set(outlets).size !== outlets.length) return start
  return saved.map((s: CableState) => ({
    status: s.status,
    length: s.length,
    plug: s.status === 'free' && s.plug ? { x: s.plug.x, y: s.plug.y } : null,
    outlet: s.status === 'plugged' ? s.outlet : null,
  }))
}
