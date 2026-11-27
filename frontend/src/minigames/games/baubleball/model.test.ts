import { describe, expect, it } from 'vitest'
import { createStreetLayout } from '../../../scene/houseSpec.ts'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { GOAL, meter, METER_PERIOD, restore, simulate, SPOTS, sweetZone } from './model.ts'

describe('Weihnachtskugelball', () => {
  it('wohnt in Haus 14, die Garage steht zwischen Haus 14 und 15', () => {
    expect(hasMinigame(14)).toBe(true)
    expect(minigameFor(14).title).toBe('Weihnachtskugelball')
    const layout = createStreetLayout()
    const [h14, h15] = [layout.plots[13], layout.plots[14]]
    expect(layout.garage.x).toBeGreaterThan(h14.x + h14.spec.width / 2)
    expect(layout.garage.x).toBeLessThan(h15.x - h15.spec.width / 2)
  })

  it('der Kraftbalken pendelt zwischen 0 und 1', () => {
    expect(meter(0)).toBe(0)
    expect(meter(METER_PERIOD / 2)).toBeCloseTo(1)
    expect(meter(METER_PERIOD)).toBeCloseTo(0)
    expect(meter(METER_PERIOD / 4)).toBeCloseTo(0.5)
  })

  it('fünf Plätze aus verschiedenen Winkeln, alle auf der Straße', () => {
    expect(SPOTS).toHaveLength(GOAL)
    const angles = SPOTS.map((s) => Math.round((Math.atan2(s.x, s.z) * 180) / Math.PI))
    expect(new Set(angles).size).toBe(GOAL)
    for (const spot of SPOTS) expect(spot.z).toBeGreaterThan(3)
  })

  it('jeder Platz hat einen treffbaren, aber schmalen grünen Bereich um den Idealwurf', () => {
    for (const spot of SPOTS) {
      const zone = sweetZone(spot)
      expect(zone.from, spot.name).toBeGreaterThan(0.1)
      expect(zone.to, spot.name).toBeLessThan(0.95)
      expect(zone.from).toBeLessThanOrEqual(spot.sweet)
      expect(zone.to).toBeGreaterThanOrEqual(spot.sweet)
      const width = zone.to - zone.from
      expect(width, spot.name).toBeGreaterThan(0.04)
      expect(width, spot.name).toBeLessThan(0.2)
    }
  })

  it('der Idealwurf rauscht durch und zerspringt erst danach am Boden', () => {
    for (const spot of SPOTS) {
      const flight = simulate(spot, spot.sweet)
      expect(flight.scored, spot.name).toBe(true)
      expect(flight.hit).toBe('ground')
      expect(flight.scoreIndex).toBeGreaterThan(0)
    }
  })

  it('zu schwach oder zu stark: Die Kugel zerspringt, ohne zu zählen', () => {
    for (const spot of SPOTS) {
      const weak = simulate(spot, spot.sweet - 0.2)
      const strong = simulate(spot, Math.min(1, spot.sweet + 0.2))
      expect(weak.scored, spot.name).toBe(false)
      expect(strong.scored, spot.name).toBe(false)
      expect(['rim', 'board', 'wall', 'house', 'ground']).toContain(strong.hit)
    }
    // Ein deutlich zu starker Wurf von vorn knallt ans Brett oder an die Garage.
    expect(['board', 'wall']).toContain(simulate(SPOTS[0], 0.95).hit)
  })

  it('knapp daneben streift den Ring', () => {
    const spot = SPOTS[0]
    const zone = sweetZone(spot)
    expect(simulate(spot, zone.to + 0.01).hit).toBe('rim')
  })

  it('merkt sich nur gültige Zwischenstände', () => {
    expect(restore({ scored: 3, shattered: 7 })).toEqual({ scored: 3, shattered: 7 })
    expect(restore({ scored: 12 })).toEqual({ scored: GOAL, shattered: 0 })
    expect(restore('kaputt')).toEqual({ scored: 0, shattered: 0 })
  })
})
