import { describe, expect, it } from 'vitest'
import { berlinToday, sleepsUntil, unlockedDaysOn } from './calendar.ts'

describe('berlinToday', () => {
  it('wechselt den Tag um Mitternacht Berliner Zeit, nicht nach UTC', () => {
    expect(berlinToday(new Date('2026-11-30T22:59:59Z'))).toBe('2026-11-30')
    expect(berlinToday(new Date('2026-11-30T23:00:00Z'))).toBe('2026-12-01')
  })
})

describe('unlockedDaysOn', () => {
  it('zählt die Häuser bis zum heutigen Dezembertag', () => {
    expect(unlockedDaysOn('2026-11-30', 2026)).toBe(0)
    expect(unlockedDaysOn('2026-12-01', 2026)).toBe(1)
    expect(unlockedDaysOn('2026-12-17', 2026)).toBe(17)
  })

  it('lässt nach Heiligabend alles offen und davor alles zu', () => {
    expect(unlockedDaysOn('2026-12-31', 2026)).toBe(24)
    expect(unlockedDaysOn('2027-02-01', 2026)).toBe(24)
    expect(unlockedDaysOn('2025-12-24', 2026)).toBe(0)
  })
})

describe('sleepsUntil', () => {
  it('zählt die Nächte bis ein Haus öffnet – auch über den Monatswechsel', () => {
    expect(sleepsUntil(13, '2026-12-12', 2026)).toBe(1)
    expect(sleepsUntil(1, '2026-11-13', 2026)).toBe(18)
    expect(sleepsUntil(24, '2026-12-01', 2026)).toBe(23)
  })

  it('wird nie negativ', () => {
    expect(sleepsUntil(5, '2026-12-20', 2026)).toBe(0)
  })
})
