import { describe, expect, it } from 'vitest'
import {
  GARAGE_AFTER_DAY,
  GARAGE_GAP,
  STREET_SEED,
  createStreetLayout,
  generateStreet,
  isFrontGable,
  wreathSpot,
} from './houseSpec.ts'

const street = generateStreet()

describe('generateStreet', () => {
  it('baut auf jedem Gerät dieselben 23 Häuser', () => {
    expect(street).toHaveLength(23)
    expect(street.map((house) => house.day)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
    expect(generateStreet(STREET_SEED)).toEqual(street)
  })

  it('ergibt mit anderer Saat eine andere Straße', () => {
    expect(generateStreet(STREET_SEED + 1)).not.toEqual(street)
  })

  it('macht jedes Haus zu einem Einzelstück', () => {
    const looks = street.map(({ day: _day, seed: _seed, ...look }) => JSON.stringify(look))
    expect(new Set(looks).size).toBe(23)
  })

  it('stellt keine Häuser gleicher Farbfamilie oder Dachform nebeneinander', () => {
    for (let i = 1; i < street.length; i++) {
      expect(street[i].wall.family, `Haus ${i + 1}`).not.toBe(street[i - 1].wall.family)
      expect(street[i].roof.type, `Haus ${i + 1}`).not.toBe(street[i - 1].roof.type)
    }
  })

  it('nutzt die ganze Bandbreite an Dächern, Wänden und Lichterketten', () => {
    expect(new Set(street.map((house) => house.roof.type)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(street.map((house) => house.wall.style)).size).toBe(4)
    expect(new Set(street.map((house) => house.lights.style)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(street.map((house) => house.floors)).size).toBe(3)
  })

  it('lässt an jedem Haus Platz für den Kranz mit dem Selfie', () => {
    for (const house of street) {
      const spot = wreathSpot(house)
      if (isFrontGable(house.roof.type)) {
        expect(spot.inGable).toBe(true)
      } else {
        // Ohne Giebel hängt der Kranz statt des mittleren Fensters im obersten Stock.
        expect(house.columns, `Haus ${house.day}`).toBe(3)
        expect(house.floors, `Haus ${house.day}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('schmückt jeden Vorgarten und verstellt nie die Tür', () => {
    for (const house of street) {
      expect(house.door.column).toBeLessThan(house.columns)
      expect(house.yard).toHaveLength(house.columns - 1)
      expect(house.yard.some((prop) => prop !== 'none')).toBe(true)
    }
  })
})

describe('createStreetLayout', () => {
  const layout = createStreetLayout()

  it('reiht die Häuser von links nach rechts auf, ohne dass sie sich berühren', () => {
    for (let i = 1; i < layout.plots.length; i++) {
      const left = layout.plots[i - 1]
      const right = layout.plots[i]
      const gap = right.x - right.spec.width / 2 - (left.x + left.spec.width / 2)
      if (left.spec.day === GARAGE_AFTER_DAY) {
        // Hier liegt die Einfahrt mit der Garage.
        expect(gap).toBeCloseTo(GARAGE_GAP, 5)
        expect(layout.garage.x).toBeCloseTo(left.x + left.spec.width / 2 + GARAGE_GAP / 2, 1)
        continue
      }
      expect(gap).toBeGreaterThan(0.4)
      expect(gap).toBeLessThan(1.05)
    }
  })

  it('stellt hinter das letzte Haus das Tor und dahinter den Weihnachtsbaum', () => {
    expect(layout.gateX).toBeGreaterThan(layout.endX + 10)
    expect(layout.treeX).toBeGreaterThan(layout.gateX + 10)
    expect(layout.cameraMinX).toBeLessThan(layout.plots[0].x)
  })
})
