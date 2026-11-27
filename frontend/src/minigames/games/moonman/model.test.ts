import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { DustField, grow, keepInside, PLAY_RADIUS, restoreProgress, rollStep, sizeProgress, spawnPoint, stackHeights, START_RADIUS, TARGET_RADII } from './model.ts'

/** Rollt eine Kugel entlang einer Strecke in kleinen Schritten, wie im Spiel Bild für Bild. */
function rollAlong(field: DustField, path: { x: number; z: number }[], radius: number, target: number): number {
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.08)
    for (let s = 1; s <= steps; s++) {
      const a = { x: from.x + ((to.x - from.x) * (s - 1)) / steps, z: from.z + ((to.z - from.z) * (s - 1)) / steps }
      const b = { x: from.x + ((to.x - from.x) * s) / steps, z: from.z + ((to.z - from.z) * s) / steps }
      radius = grow(radius, rollStep(field, a, b, radius), target)
    }
  }
  return radius
}

/** Eine Spirale von innen nach außen: so rollt man, wenn man frischen Staub sucht. */
function spiral(length: number): { x: number; z: number }[] {
  const points = [{ x: 0, z: 0 }]
  let travelled = 0
  for (let a = 0.3; travelled < length; a += 0.05) {
    const r = 0.45 * a
    const next = { x: Math.cos(a) * r, z: Math.sin(a) * r }
    const last = points[points.length - 1]
    travelled += Math.hypot(next.x - last.x, next.z - last.z)
    points.push(next)
  }
  return points
}

describe('Mondstaub-Mann', () => {
  it('wohnt in Haus 5 mit breiter Bühne', () => {
    expect(hasMinigame(5)).toBe(true)
    expect(minigameFor(5).title).toBe('Mondstaub-Mann')
    expect(minigameFor(5).layout).toBe('wide')
  })

  it('wird jede Kugel kleiner als die vorige', () => {
    for (let i = 1; i < TARGET_RADII.length; i++) expect(TARGET_RADII[i]).toBeLessThan(TARGET_RADII[i - 1])
    expect(TARGET_RADII[2]).toBeGreaterThan(START_RADIUS)
  })

  it('lässt die Kugel auf frischem Staub wachsen', () => {
    const field = new DustField()
    const radius = rollAlong(field, [{ x: -6, z: 0 }, { x: 6, z: 0 }], START_RADIUS, 1)
    expect(radius).toBeGreaterThan(START_RADIUS * 1.5)
  })

  it('wächst auf schon abgerolltem Boden kaum noch', () => {
    const field = new DustField()
    const line = [{ x: -6, z: 0 }, { x: 6, z: 0 }]
    const first = rollAlong(field, line, START_RADIUS, 5)
    const again = rollAlong(field, line, START_RADIUS, 5)
    expect(again - START_RADIUS).toBeLessThan((first - START_RADIUS) * 0.15)
  })

  it('schafft die große Grundkugel mit einer guten Runde über den Krater', () => {
    const field = new DustField()
    const radius = rollAlong(field, spiral(70), START_RADIUS, TARGET_RADII[0])
    expect(radius).toBe(TARGET_RADII[0])
  })

  it('wächst nie über das Ziel hinaus und zeigt den Fortschritt', () => {
    expect(grow(0.9, 100, 1)).toBe(1)
    expect(sizeProgress(START_RADIUS, 1)).toBe(0)
    expect(sizeProgress(1, 1)).toBe(1)
  })

  it('stapelt die Kugeln übereinander, jede ein wenig eingesunken', () => {
    const [a, b, c] = stackHeights()
    expect(a).toBe(TARGET_RADII[0])
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(a + TARGET_RADII[0] + TARGET_RADII[1])
    expect(c).toBeGreaterThan(b)
  })

  it('hält die Kugel im Krater und weg von der Grundkugel', () => {
    const outside = keepInside({ x: 50, z: 0 }, 0.5, null)
    expect(Math.hypot(outside.x, outside.z)).toBeCloseTo(PLAY_RADIUS - 0.5)
    const pushed = keepInside({ x: 0.5, z: 0 }, 0.5, { point: { x: 0, z: 0 }, radius: 1 })
    expect(Math.hypot(pushed.x, pushed.z)).toBeCloseTo(1.5)
    const spawn = spawnPoint({ x: 0, z: 0 })
    expect(Math.hypot(spawn.x, spawn.z)).toBeGreaterThan(TARGET_RADII[0] + TARGET_RADII[1])
  })

  it('merkt sich nur stimmige Spielstände', () => {
    expect(restoreProgress(undefined)).toBeNull()
    expect(restoreProgress({ stacked: 0 })).toBeNull()
    expect(restoreProgress({ stacked: 2, base: { x: 1, z: 2 }, decor: ['helmet'] })).toEqual({ stacked: 2, base: { x: 1, z: 2 }, decor: [] })
    expect(restoreProgress({ stacked: 3, base: { x: 0, z: 0 }, decor: ['helmet', 'quatsch', 'coins'] })?.decor).toEqual(['coins', 'helmet'])
  })
})
