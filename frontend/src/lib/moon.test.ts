import { describe, expect, it } from 'vitest'
import { eveningMoonPhase, illumination, moonPhase } from './moon.ts'

/** Abstand zweier Phasen auf dem Kreis (0–0,5). */
const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b))
/** Ein Tag Toleranz: Gerechnet wird mit dem mittleren Zyklus, der echte Mond eilt bis zu ~14 h vor oder nach. */
const HALF_DAY = 1 / 29.53

describe('Mondphase', () => {
  it('trifft bekannte Voll- und Neumonde', () => {
    expect(distance(moonPhase(new Date('2024-12-15T09:02:00Z')), 0.5)).toBeLessThan(HALF_DAY)
    expect(distance(moonPhase(new Date('2024-12-30T22:27:00Z')), 0)).toBeLessThan(HALF_DAY)
    expect(distance(moonPhase(new Date('2025-12-04T23:14:00Z')), 0.5)).toBeLessThan(HALF_DAY)
    expect(distance(moonPhase(new Date('2026-12-24T01:28:00Z')), 0.5)).toBeLessThan(HALF_DAY)
  })

  it('liegt immer zwischen 0 und 1', () => {
    for (const iso of ['1999-01-01', '2000-01-06', '2030-06-15']) {
      const phase = moonPhase(new Date(iso))
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
  })

  it('nimmt den Abend des Berliner Datums und fällt sonst auf die Uhr zurück', () => {
    expect(eveningMoonPhase('2026-12-24')).toBeCloseTo(moonPhase(new Date('2026-12-24T19:00:00Z')))
    const now = new Date('2026-12-01T12:00:00Z')
    expect(eveningMoonPhase('', now)).toBe(moonPhase(now))
  })

  it('rechnet den beleuchteten Anteil aus', () => {
    expect(illumination(0)).toBeCloseTo(0)
    expect(illumination(0.25)).toBeCloseTo(0.5)
    expect(illumination(0.5)).toBeCloseTo(1)
  })
})
