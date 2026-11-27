import { describe, expect, it } from 'vitest'
import { COURSE, nearest, pointAt, restoreCheckpoint, SECTIONS, sectionAt, sectionStart, slack, trace } from './model.ts'
import type { Point } from './model.ts'

/** Fährt die Rinne in kleinen Schritten genau in der Mitte ab. */
function followCenter(from: number, to: number): { touched: boolean; s: number } {
  let s = from
  let prev = pointAt(COURSE, s)
  for (let t = from + 3; t <= to; t += 3) {
    const next = pointAt(COURSE, t)
    const result = trace(COURSE, s, prev, next)
    if (result.touched) return { touched: true, s }
    s = result.s
    prev = next
  }
  return { touched: false, s }
}

describe('Santa Bibber', () => {
  it('lässt sich in der Mitte der Rinne ganz durchfahren', () => {
    const result = followCenter(0, COURSE.length)
    expect(result.touched).toBe(false)
    expect(result.s).toBeGreaterThan(COURSE.length - 4)
  })

  it('meldet eine Berührung, wenn man aus der Rinne fährt', () => {
    const start = pointAt(COURSE, 10)
    const out: Point = [start[0], start[1] - 60]
    expect(trace(COURSE, 10, start, out).touched).toBe(true)
  })

  it('erlaubt Abweichungen nur innerhalb der Rinnenbreite', () => {
    const s = 30
    const [x, y] = pointAt(COURSE, s)
    // Die erste Strecke läuft fast waagerecht – senkrecht dazu ausweichen.
    const inside = slack(COURSE, s) - 1
    expect(trace(COURSE, s, [x, y], [x, y + inside]).touched).toBe(false)
    expect(trace(COURSE, s, [x, y], [x, y + slack(COURSE, s) + 6]).touched).toBe(true)
  })

  it('lässt keinen Sprung über eine Wand in die nächste Schleife zu', () => {
    // Im Bauch liegen zwei Bahnen übereinander – von der oberen direkt auf die untere wischen.
    const upper = sectionStart(COURSE, 2) + 20
    const from = pointAt(COURSE, upper)
    const target = nearest(COURSE, [from[0] + 10, from[1] + 66], 0, COURSE.length)
    expect(target.d).toBeLessThan(25)
    expect(trace(COURSE, upper, from, [from[0] + 10, from[1] + 66]).touched).toBe(true)
  })

  it('wird von Abschnitt zu Abschnitt enger', () => {
    const widths = SECTIONS.map((section) => section.width)
    expect([...widths].sort((a, b) => b - a)).toEqual(widths)
    expect(sectionAt(COURSE, 0)).toBe(0)
    expect(sectionAt(COURSE, COURSE.length)).toBe(SECTIONS.length - 1)
  })

  it('hält benachbarte Bahnen weit genug auseinander', () => {
    // Punkte, die auf dem Weg weit auseinanderliegen, müssen auch auf dem Brett Abstand haben.
    for (let a = 0; a < COURSE.length; a += 4) {
      for (let b = a + 120; b < COURSE.length; b += 4) {
        const [ax, ay] = pointAt(COURSE, a)
        const [bx, by] = pointAt(COURSE, b)
        const room = slack(COURSE, a) + slack(COURSE, b) + 2 * 5 + 8
        expect(Math.hypot(ax - bx, ay - by), `${a} ↔ ${b}`).toBeGreaterThan(room)
      }
    }
  })

  it('stellt nur gültige Spielstände wieder her', () => {
    expect(restoreCheckpoint(undefined)).toBe(0)
    expect(restoreCheckpoint({ checkpoint: 2 })).toBe(2)
    expect(restoreCheckpoint({ checkpoint: 9 })).toBe(SECTIONS.length)
    expect(restoreCheckpoint({ checkpoint: 'x' })).toBe(0)
  })
})
