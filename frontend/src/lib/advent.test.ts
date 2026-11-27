import { describe, expect, it } from 'vitest'
import { adventCandles } from './advent.ts'

describe('Adventskerzen', () => {
  it('zündet 2026 jeden Adventssonntag eine Kerze mehr an', () => {
    // 2026: 1. Advent 29.11., 2. Advent 6.12., 3. Advent 13.12., 4. Advent 20.12.
    expect(adventCandles('2026-11-28')).toBe(0)
    expect(adventCandles('2026-11-29')).toBe(1)
    expect(adventCandles('2026-12-05')).toBe(1)
    expect(adventCandles('2026-12-06')).toBe(2)
    expect(adventCandles('2026-12-12')).toBe(2)
    expect(adventCandles('2026-12-13')).toBe(3)
    expect(adventCandles('2026-12-20')).toBe(4)
    expect(adventCandles('2026-12-24')).toBe(4)
  })

  it('kennt auch andere Jahre', () => {
    // 2027: Heiligabend ist ein Freitag → 4. Advent 19.12., 1. Advent 28.11.
    expect(adventCandles('2027-11-27')).toBe(0)
    expect(adventCandles('2027-11-28')).toBe(1)
    expect(adventCandles('2027-12-19')).toBe(4)
    // 2023: Heiligabend ist selbst der 4. Advent
    expect(adventCandles('2023-12-23')).toBe(3)
    expect(adventCandles('2023-12-24')).toBe(4)
  })

  it('bleibt bei unbekanntem Datum aus', () => {
    expect(adventCandles('')).toBe(0)
  })
})
