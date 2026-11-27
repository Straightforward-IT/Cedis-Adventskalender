import { describe, expect, it } from 'vitest'
import {
  buildRound, cutGap, GOAL, hits, isClean, LEVELS, lineGap, LOG_TOTAL, logsDone, MIN_START_ERROR, restoreSplit, TOLERANCE, worstError,
} from './model.ts'
import type { LogSetup } from './model.ts'

/** Sucht in 0,5°-Schritten alle Drehwinkel, bei denen alles passt. */
function solutions(logs: LogSetup[]): number[] {
  const found: number[] = []
  for (let turn = -360; turn < 360; turn += 0.5) if (isClean(logs, turn)) found.push(turn)
  return found
}

describe('Holzhacken', () => {
  it('misst Abstände von Linien (180°) und Strahlen (360°)', () => {
    expect(lineGap(10, 190)).toBe(0)
    expect(lineGap(5, 175)).toBe(10)
    expect(cutGap('ray', 10, 190)).toBe(180)
    expect(cutGap('ray', 350, 10)).toBe(20)
  })

  it('spaltet nur, wenn jede Klinge auf ihrer Kreide liegt', () => {
    const logs: LogSetup[] = [{
      ratio: 1,
      blades: [{ kind: 'line', angle: 40 }, { kind: 'line', angle: 98 }],
      marks: [{ kind: 'line', angle: 100 }, { kind: 'line', angle: 158 }],
    }]
    expect(isClean(logs, -60)).toBe(true)
    expect(isClean(logs, -60 + TOLERANCE)).toBe(true)
    expect(isClean(logs, -60 + TOLERANCE + 1)).toBe(false)
    // Nur eine Linie passt (die zweite Klinge trifft die erste Linie nicht) – das zählt nicht.
    expect(hits(logs, 2)).toEqual({ hit: 1, total: 2 })
    expect(isClean(logs, 2)).toBe(false)
  })

  it('dreht verbundene Scheite gegenläufig und mit Übersetzung', () => {
    const logs: LogSetup[] = [
      { ratio: 1, blades: [{ kind: 'ray', angle: 0 }], marks: [{ kind: 'ray', angle: 330 }] },
      { ratio: -2, blades: [{ kind: 'ray', angle: 0 }], marks: [{ kind: 'ray', angle: 60 }] },
    ]
    expect(isClean(logs, 30)).toBe(true)
    expect(hits(logs, 30 + 180)).toEqual({ hit: 1, total: 2 })
  })

  it('jede Runde jedes Levels ist lösbar und beginnt deutlich daneben', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 40; i++) {
        const logs = buildRound(level)
        expect(worstError(logs, 0)).toBeGreaterThanOrEqual(MIN_START_ERROR)
        expect(solutions(logs).length).toBeGreaterThan(0)
      }
    }
  })

  it('hat ab Level 3 nur eine einzige Lösung pro Umdrehung', () => {
    for (const level of LEVELS.slice(2)) {
      const logs = buildRound(level)
      const found = solutions(logs).filter((t) => t >= 0 && t < 360)
      const clusters = found.filter((t, i) => i === 0 || t - found[i - 1] > 1)
      // Getriebe mit gegenläufigen Linien können sich nach 180° wiederholen – mehr aber nicht.
      expect(clusters.length).toBeLessThanOrEqual(2)
    }
  })

  it('hat genau sechs Runden mit zusammen zehn Scheiten', () => {
    expect(LEVELS).toHaveLength(GOAL)
    expect(LOG_TOTAL).toBe(10)
    expect(logsDone(0)).toBe(0)
    expect(logsDone(3)).toBe(3)
    expect(logsDone(5)).toBe(7)
    expect(logsDone(GOAL)).toBe(LOG_TOTAL)
  })

  it('stellt nur gültige Spielstände wieder her', () => {
    expect(restoreSplit(undefined)).toBe(0)
    expect(restoreSplit({ split: 3 })).toBe(3)
    expect(restoreSplit({ split: 99 })).toBe(GOAL)
    expect(restoreSplit({ split: 'x' })).toBe(0)
  })
})
