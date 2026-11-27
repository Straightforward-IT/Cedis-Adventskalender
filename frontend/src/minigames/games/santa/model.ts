/**
 * Santa Bibber: Der Weihnachtsmann ist vom Schlitten gefallen. Ein Heilstern muss
 * vorsichtig durch eine schmale Rinne quer durch seinen Körper geführt werden – von der
 * Mütze bis zu den Stiefeln. Wer den Rand berührt, kitzelt ihn („Autsch!“) und fängt
 * den aktuellen Abschnitt von vorn an. Erreichte Abschnitte bleiben geschafft.
 */

export type Point = readonly [number, number]

export const BOARD = { width: 400, height: 560 }
/** Radius des Heilsterns – so weit muss er vom Rand wegbleiben. */
export const PROBE_R = 4
/** So nah muss man den Stern antippen, um ihn (wieder) zu greifen. */
export const GRAB_R = 26
/** Abstand der Prüfpunkte, wenn der Finger schnell über die Fläche wischt. */
const STEP = 2.5
/** Wie weit der Stern bei einem Prüfpunkt zurück- oder vorspringen darf (Weglänge). */
const LOOK_BACK = 40
const LOOK_AHEAD = 45

export interface SectionDef {
  name: string
  /** Breite der Rinne. */
  width: number
  /** Punkte der Rinne; der erste Punkt ist das Ende des vorigen Abschnitts. */
  points: Point[]
}

/** Die Rinne – von der Bommel über Gesicht und Bauch bis in den Stiefel. */
export const SECTIONS: readonly SectionDef[] = [
  { name: 'Mütze', width: 42, points: [[306, 52], [252, 68], [192, 86], [140, 112]] },
  { name: 'Bart', width: 37, points: [[140, 112], [116, 162], [150, 204], [200, 190], [254, 206], [272, 252], [222, 272]] },
  { name: 'Bauch', width: 32, points: [[222, 272], [150, 274], [108, 306], [150, 344], [250, 334], [292, 374], [242, 414], [170, 404]] },
  { name: 'Stiefel', width: 27, points: [[170, 404], [146, 452], [166, 494], [232, 474], [252, 522], [306, 530]] },
]

export interface Course {
  points: Point[]
  /** Weglänge bis zu jedem Punkt. */
  cum: number[]
  /** Weglänge am Ende jedes Abschnitts. */
  ends: number[]
  widths: number[]
  length: number
}

export function buildCourse(sections: readonly SectionDef[] = SECTIONS): Course {
  const points: Point[] = []
  const cum: number[] = []
  const ends: number[] = []
  let length = 0
  sections.forEach((section, i) => {
    section.points.forEach((p, k) => {
      if (i > 0 && k === 0) return
      if (points.length) length += Math.hypot(p[0] - points[points.length - 1][0], p[1] - points[points.length - 1][1])
      points.push(p)
      cum.push(length)
    })
    ends.push(length)
  })
  return { points, cum, ends, widths: sections.map((s) => s.width), length }
}

export const COURSE = buildCourse()

/** Startpunkt eines Abschnitts als Weglänge. */
export const sectionStart = (course: Course, index: number) => (index === 0 ? 0 : course.ends[index - 1])

export function sectionAt(course: Course, s: number): number {
  const index = course.ends.findIndex((end) => s <= end)
  return index < 0 ? course.ends.length - 1 : index
}

/** Punkt auf der Rinne bei Weglänge `s`. */
export function pointAt(course: Course, s: number): Point {
  const t = Math.min(Math.max(s, 0), course.length)
  for (let i = 1; i < course.points.length; i++) {
    if (t <= course.cum[i]) {
      const [x0, y0] = course.points[i - 1]
      const [x1, y1] = course.points[i]
      const span = course.cum[i] - course.cum[i - 1]
      const k = span > 0 ? (t - course.cum[i - 1]) / span : 0
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]
    }
  }
  return course.points[course.points.length - 1]
}

/** Nächster Punkt der Rinne – nur im Wegstück [sMin, sMax], damit man nicht über eine Wand in die Nachbarschleife hüpft. */
export function nearest(course: Course, p: Point, sMin: number, sMax: number): { s: number; d: number } {
  let best = { s: sMin, d: Infinity }
  for (let i = 1; i < course.points.length; i++) {
    const a0 = course.cum[i - 1]
    const a1 = course.cum[i]
    if (a1 < sMin || a0 > sMax) continue
    const [x0, y0] = course.points[i - 1]
    const [x1, y1] = course.points[i]
    const dx = x1 - x0
    const dy = y1 - y0
    const len2 = dx * dx + dy * dy
    let k = len2 > 0 ? ((p[0] - x0) * dx + (p[1] - y0) * dy) / len2 : 0
    // Auf das erlaubte Wegstück begrenzen.
    const span = a1 - a0
    const kMin = span > 0 ? Math.max(0, (sMin - a0) / span) : 0
    const kMax = span > 0 ? Math.min(1, (sMax - a0) / span) : 1
    k = Math.min(kMax, Math.max(kMin, k))
    const d = Math.hypot(p[0] - (x0 + dx * k), p[1] - (y0 + dy * k))
    if (d < best.d) best = { s: a0 + span * k, d }
  }
  return best
}

/** Wie weit der Stern hier von der Mitte der Rinne abweichen darf. */
export function slack(course: Course, s: number): number {
  return course.widths[sectionAt(course, s)] / 2 - PROBE_R
}

export type TraceResult =
  | { touched: false; s: number }
  | { touched: true; s: number; at: Point }

/**
 * Bewegt den Stern von `from` nach `to`. Geprüft wird in kleinen Schritten – auch wer
 * schnell wischt, kommt nicht durch eine Wand. `s` ist die bisherige Weglänge.
 */
export function trace(course: Course, s: number, from: Point, to: Point): TraceResult {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1])
  const steps = Math.max(1, Math.ceil(distance / STEP))
  let current = s
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const p: Point = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]
    const hit = nearest(course, p, current - LOOK_BACK, current + LOOK_AHEAD)
    if (hit.d > slack(course, hit.s)) return { touched: true, s: current, at: p }
    current = hit.s
  }
  return { touched: false, s: current }
}

export interface SantaState {
  /** Geschaffte Abschnitte (0–SECTIONS.length). */
  checkpoint: number
}

export function restoreCheckpoint(value: unknown): number {
  const checkpoint = (value as Partial<SantaState> | null)?.checkpoint
  return Number.isInteger(checkpoint) ? Math.max(0, Math.min(SECTIONS.length, checkpoint as number)) : 0
}
