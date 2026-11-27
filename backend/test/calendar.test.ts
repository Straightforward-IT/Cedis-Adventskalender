import { describe, expect, it } from 'vitest'
import { berlinDate, opensAt, parseIsoDate, unlockedDays } from '../src/calendar.ts'

const unlockedAt = (iso: string, year = 2026) => unlockedDays(berlinDate(new Date(iso)), year)

describe('unlockedDays', () => {
  it('öffnet Haus 1 genau um Mitternacht Berliner Zeit', () => {
    expect(unlockedAt('2026-11-30T22:59:59Z')).toBe(0)
    expect(unlockedAt('2026-11-30T23:00:00Z')).toBe(1)
  })

  it('schaltet jeden Tag ein weiteres Haus frei', () => {
    expect(unlockedAt('2026-12-05T12:00:00Z')).toBe(5)
    expect(unlockedAt('2026-12-23T23:30:00Z')).toBe(24)
  })

  it('lässt nach dem 24. Dezember alle Häuser offen', () => {
    expect(unlockedAt('2026-12-31T12:00:00Z')).toBe(24)
    expect(unlockedAt('2027-03-01T12:00:00Z')).toBe(24)
  })

  it('hält vor Dezember und in früheren Jahren alles verschlossen', () => {
    expect(unlockedAt('2026-11-13T17:00:00Z')).toBe(0)
    expect(unlockedAt('2025-12-24T12:00:00Z')).toBe(0)
  })
})

describe('parseIsoDate', () => {
  it('liest gültige Daten und lehnt unmögliche ab', () => {
    expect(parseIsoDate('2026-12-05')).toEqual({ year: 2026, month: 12, day: 5 })
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('05.12.2026')).toBeNull()
  })
})

describe('opensAt', () => {
  it('entspricht dem Moment, in dem das Haus freigeschaltet wird', () => {
    const instant = new Date(opensAt(7, 2026))
    expect(unlockedDays(berlinDate(instant), 2026)).toBe(7)
    expect(unlockedDays(berlinDate(new Date(instant.getTime() - 1)), 2026)).toBe(6)
  })
})
