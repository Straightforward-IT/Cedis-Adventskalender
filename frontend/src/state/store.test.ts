import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../lib/storage.ts'
import { highlightedDay, houseStatus } from './store.ts'

const calendar = (unlockedDays: number, keys: number[] = [], completed: number[] = []) => ({
  unlockedDays,
  progress: {
    ...emptyProgress(),
    keys: Object.fromEntries(keys.map((day) => [day, 'SCHLUESSEL'])),
    completed: Object.fromEntries(completed.map((day) => [day, '2026-12-01T00:00:00.000Z'])),
  },
})

describe('houseStatus', () => {
  it('durchläuft verschlossen, wartet auf Schlüssel, aufgeschlossen, besucht', () => {
    expect(houseStatus(calendar(4), 5)).toBe('locked')
    expect(houseStatus(calendar(5), 5)).toBe('available')
    expect(houseStatus(calendar(5, [5]), 5)).toBe('unlocked')
    expect(houseStatus(calendar(5, [5], [5]), 5)).toBe('completed')
  })

  it('hält künftige Häuser verschlossen, selbst wenn schon ein Schlüssel vorliegt', () => {
    expect(houseStatus(calendar(4, [9]), 9)).toBe('locked')
  })
})

describe('highlightedDay', () => {
  it('ist das Haus von heute, bis es gelöst wurde', () => {
    expect(highlightedDay(calendar(0))).toBeNull()
    expect(highlightedDay(calendar(7))).toBe(7)
    expect(highlightedDay(calendar(7, [7]))).toBe(7)
    expect(highlightedDay(calendar(7, [7], [7]))).toBeNull()
  })
})
