/**
 * Holzhacken als Knobelei: Sechs Runden, jede mit einem eigenen Aufbau. Auf den
 * Scheiten sind Kreidelinien gezogen, die Äxte haben eine oder mehrere Klingen.
 * Erst wenn JEDE Klinge auf ihrer Kreidelinie liegt, wird sauber gespalten –
 * sonst zersplittert alles. In späteren Runden liegen mehrere Scheite auf dem
 * Klotz, die über Zahnräder verbunden sind: Dreht man einen, drehen sich die
 * anderen mit – gegenläufig oder doppelt so schnell.
 */

export const GOAL = 6
/** So viele Grad darf eine Kreidelinie neben ihrer Klinge liegen. */
export const TOLERANCE = 7
/** Zu Beginn liegt mindestens ein Scheit so weit daneben – geschenkt wird nichts. */
export const MIN_START_ERROR = 25

/**
 * Eine Klinge bzw. Kreidelinie. `line`: quer durch den ganzen Scheit (beidseitig,
 * sieht nach einer halben Drehung gleich aus). `ray`: von der Mitte zum Rand.
 */
export interface Cut {
  kind: 'line' | 'ray'
  /** Winkel in Grad. */
  angle: number
}

export interface LogSetup {
  /** Wie stark (und in welche Richtung) sich dieser Scheit mit dem Drehregler dreht. */
  ratio: number
  /** Klingen der Axt über diesem Scheit (Weltwinkel). */
  blades: Cut[]
  /** Kreidelinien auf dem Scheit (Winkel im Scheit, vor dem Drehen). */
  marks: Cut[]
}

export interface Level {
  name: string
  hint: string
  logs: { ratio: number; pattern: Cut[] }[]
}

const line = (angle: number): Cut => ({ kind: 'line', angle })
const ray = (angle: number): Cut => ({ kind: 'ray', angle })

export const LEVELS: readonly Level[] = [
  {
    name: 'Der erste Scheit',
    hint: 'Dreh den Scheit, bis die Kreidelinie genau unter der Axt liegt – dann hacken!',
    logs: [{ ratio: 1, pattern: [line(0)] }],
  },
  {
    name: 'Die Doppelklinge',
    hint: 'Zwei Klingen, zwei Linien – beide müssen gleichzeitig treffen.',
    logs: [{ ratio: 1, pattern: [line(0), line(58)] }],
  },
  {
    name: 'Der Dreizack',
    hint: 'Drei einzelne Klingen in schiefen Winkeln. Nur eine Stellung passt.',
    logs: [{ ratio: 1, pattern: [ray(0), ray(105), ray(225)] }],
  },
  {
    name: 'Die Zwillinge',
    hint: 'Die beiden Scheite hängen an einem Zahnrad – sie drehen sich gegeneinander.',
    logs: [
      { ratio: 1, pattern: [line(0)] },
      { ratio: -1, pattern: [line(0)] },
    ],
  },
  {
    name: 'Das Getriebe',
    hint: 'Der rechte Scheit dreht sich doppelt so schnell – und andersherum.',
    logs: [
      { ratio: 1, pattern: [ray(0), ray(140)] },
      { ratio: -2, pattern: [line(0), line(50)] },
    ],
  },
  {
    name: 'Das große Finale',
    hint: 'Drei Scheite, drei Äxte, ein Zahnradwerk. Alles muss auf einmal passen.',
    logs: [
      { ratio: 1, pattern: [ray(0), ray(95)] },
      { ratio: -2, pattern: [line(0)] },
      { ratio: 1, pattern: [ray(0), ray(120), ray(240)] },
    ],
  },
]

const mod = (value: number, m: number) => ((value % m) + m) % m

/** Abstand zweier gleichartiger Schnitte in Grad. Linien sind nach 180° wieder gleich, Strahlen erst nach 360°. */
export function cutGap(kind: Cut['kind'], a: number, b: number): number {
  const period = kind === 'line' ? 180 : 360
  const d = mod(a - b, period)
  return Math.min(d, period - d)
}

/** Kompatibel mit der ersten Version: Abstand zweier Linien. */
export const lineGap = (a: number, b: number) => cutGap('line', a, b)

/** Um wie viel Grad liegt die schlechteste Klinge dieses Scheits daneben (bei Drehung `rotation`)? */
export function bladeErrors(log: LogSetup, rotation: number): number[] {
  return log.blades.map((blade) => {
    let best = Infinity
    for (const mark of log.marks) {
      if (mark.kind === blade.kind) best = Math.min(best, cutGap(blade.kind, mark.angle + rotation, blade.angle))
    }
    return best
  })
}

export const logRotation = (log: LogSetup, turn: number) => log.ratio * turn

/** Wie viele Klingen liegen auf ihrer Kreide – und wie viele gibt es? */
export function hits(logs: readonly LogSetup[], turn: number): { hit: number; total: number } {
  let hit = 0
  let total = 0
  for (const log of logs) {
    for (const error of bladeErrors(log, logRotation(log, turn))) {
      total++
      if (error <= TOLERANCE) hit++
    }
  }
  return { hit, total }
}

export function isClean(logs: readonly LogSetup[], turn: number): boolean {
  const { hit, total } = hits(logs, turn)
  return hit === total
}

/** Größter Fehler über alle Klingen. */
export function worstError(logs: readonly LogSetup[], turn: number): number {
  return Math.max(...logs.flatMap((log) => bladeErrors(log, logRotation(log, turn))))
}

/**
 * Baut eine Runde: Die Lösung ist ein zufälliger Drehwinkel, jede Axt bekommt eine
 * zufällige Grundrichtung, und die Kreidelinien werden so gezogen, dass bei genau
 * diesem Winkel alles passt. Am Anfang liegt es dagegen deutlich daneben.
 */
export function buildRound(level: Level, random: () => number = Math.random): LogSetup[] {
  let logs: LogSetup[] = []
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = Math.round(random() * 360) - 180
    logs = level.logs.map(({ ratio, pattern }) => {
      const axis = Math.round(random() * 360)
      const blades = pattern.map((cut) => ({ kind: cut.kind, angle: mod(axis + cut.angle, 360) }))
      const marks = blades.map((cut) => ({ kind: cut.kind, angle: mod(cut.angle - ratio * solution, 360) }))
      return { ratio, blades, marks }
    })
    if (worstError(logs, 0) >= MIN_START_ERROR) return logs
  }
  return logs
}

/** Alle Scheite über alle Runden – so viele Plätze hat das Holzregal. */
export const LOG_TOTAL = LEVELS.reduce((sum, level) => sum + level.logs.length, 0)

/** Wie viele Scheite nach `rounds` gelösten Runden im Regal liegen. */
export function logsDone(rounds: number): number {
  return LEVELS.slice(0, rounds).reduce((sum, level) => sum + level.logs.length, 0)
}

export interface FirewoodState {
  /** Gelöste Runden (0–GOAL). */
  split: number
}

export function restoreSplit(value: unknown): number {
  const split = (value as Partial<FirewoodState> | null)?.split
  return Number.isInteger(split) ? Math.max(0, Math.min(GOAL, split as number)) : 0
}
