import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { createMeter, rms, updateMeter } from './mic.ts'
import { blow, CLEAR_AT, clearedFraction, COLS, freshSnow, isClear, MAX_DEPTH, restoreSnow, ROWS, seededRandom, snapshot, startSnow, sweep, wipe } from './model.ts'

const DT = 1 / 60

function blowFor(snow: number[], strength: number, seconds: number): number {
  const random = seededRandom(7)
  let t = 0
  while (t < seconds && clearedFraction(snow) < CLEAR_AT) {
    blow(snow, strength, DT, random)
    t += DT
  }
  return t
}

describe('Eingeschneit', () => {
  it('wohnt in Haus 9', () => {
    expect(hasMinigame(3)).toBe(true)
    expect(minigameFor(9).title).toBe('Eingeschneit!')
  })

  it('beginnt mit einem komplett zugeschneiten Fenster, unten am tiefsten', () => {
    const snow = freshSnow()
    expect(snow).toHaveLength(COLS * ROWS)
    expect(clearedFraction(snow)).toBe(0)
    expect(snow.every((depth) => depth > 0 && depth <= MAX_DEPTH)).toBe(true)
    const rowSum = (row: number) => snow.slice(row * COLS, (row + 1) * COLS).reduce((a, b) => a + b, 0)
    expect(rowSum(ROWS - 1)).toBeGreaterThan(rowSum(0))
  })

  it('lässt sich von Stille und Raumrauschen nicht wegwehen', () => {
    const snow = freshSnow()
    const before = [...snow]
    expect(blow(snow, 0, DT)).toBe(0)
    expect(blow(snow, 0.03, 1)).toBe(0)
    expect(snow).toEqual(before)
  })

  it('ist mit kräftigem Pusten in wenigen Sekunden frei', () => {
    const t = blowFor(freshSnow(), 0.8, 30)
    expect(t).toBeGreaterThan(3)
    expect(t).toBeLessThan(12)
  })

  it('schafft man auch mit sanftem Pusten – es dauert nur länger', () => {
    const t = blowFor(freshSnow(), 0.3, 60)
    expect(t).toBeLessThan(30)
    expect(t).toBeGreaterThan(blowFor(freshSnow(), 0.8, 30))
  })

  it('pustet die Mitte zuerst frei', () => {
    const snow = freshSnow()
    blowFor(snow, 0.8, 2.5)
    const centre = snow[Math.floor(ROWS * 0.42) * COLS + COLS / 2]
    const corner = snow[(ROWS - 1) * COLS]
    expect(centre).toBeLessThan(corner)
  })

  it('weht den Rest von allein weg', () => {
    const snow = freshSnow()
    blowFor(snow, 0.8, 30)
    for (let i = 0; i < 120 && !isClear(snow); i++) sweep(snow, DT)
    expect(isClear(snow)).toBe(true)
  })

  it('merkt sich den Zwischenstand und verwirft Kaputtes', () => {
    const snow = freshSnow()
    blowFor(snow, 0.8, 2)
    const saved = JSON.parse(JSON.stringify(snapshot(snow)))
    expect(restoreSnow(saved)).toEqual(saved.snow)
    expect(startSnow(saved, false)).toEqual(saved.snow)
    expect(restoreSnow({ snow: [1, 2, 3] })).toBeNull()
    expect(restoreSnow(undefined)).toBeNull()
    expect(startSnow('kaputt', false)).toEqual(freshSnow())
  })

  it('schneit beim Wiederholen eines gelösten Hauses neu ein', () => {
    const cleared = { snow: Array(COLS * ROWS).fill(0) }
    expect(startSnow(cleared, true)).toEqual(freshSnow())
    expect(isClear(startSnow(cleared, false))).toBe(true)
  })
})

describe('Puste-Messer', () => {
  const settle = (level: number, seconds: number, meter = createMeter()) => {
    let strength = 0
    for (let t = 0; t < seconds; t += DT) strength = updateMeter(meter, level, DT)
    return { strength, meter }
  }

  it('misst die Lautstärke als RMS', () => {
    expect(rms([0, 0, 0])).toBe(0)
    expect(rms([0.5, -0.5])).toBeCloseTo(0.5)
  })

  it('bleibt bei Raumrauschen still', () => {
    expect(settle(0.008, 3).strength).toBeLessThan(0.02)
  })

  it('erkennt kräftiges Pusten', () => {
    const { meter } = settle(0.006, 2)
    expect(settle(0.25, 0.5, meter).strength).toBeGreaterThan(0.9)
  })

  it('lässt nach dem Pusten schnell wieder nach', () => {
    const { meter } = settle(0.25, 1)
    expect(settle(0.005, 1, meter).strength).toBeLessThan(0.05)
  })

  it('der Schwamm wischt dort, wo er entlangfährt – und lässt den Rest liegen', () => {
    const snow = freshSnow()
    const before = [...snow]
    const removed = wipe(snow, { x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 })
    expect(removed).toBeGreaterThan(0)
    const at = (x: number, y: number) => Math.floor(y * ROWS) * COLS + Math.floor(x * COLS)
    expect(snow[at(0.5, 0.2)]).toBeLessThan(before[at(0.5, 0.2)])
    expect(snow[at(0.5, 0.8)]).toBe(before[at(0.5, 0.8)])
  })

  it('ein Wisch reicht nicht, ein paar Wische legen eine Bahn frei', () => {
    const snow = freshSnow()
    const lane = Math.floor(0.3 * ROWS) * COLS + Math.floor(0.5 * COLS)
    wipe(snow, { x: 0, y: 0.3 }, { x: 1, y: 0.3 })
    expect(snow[lane]).toBeGreaterThan(0)
    for (let i = 0; i < 4; i++) wipe(snow, { x: 0, y: 0.3 }, { x: 1, y: 0.3 })
    expect(snow[lane]).toBe(0)
  })

  it('mit genug Wischen wird das Fenster frei', () => {
    const snow = freshSnow()
    for (let pass = 0; pass < 6; pass++) {
      for (let y = 0.02; y < 1; y += 0.08) wipe(snow, { x: 0, y }, { x: 1, y })
    }
    expect(clearedFraction(snow)).toBeGreaterThanOrEqual(CLEAR_AT)
  })
})
