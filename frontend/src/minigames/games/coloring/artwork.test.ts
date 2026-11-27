import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { artworkSvg, coloredCount, isComplete, PALETTE, REGIONS, restoreColoring } from './artwork.ts'

const allColored = Object.fromEntries(REGIONS.map((region, i) => [region.id, i % PALETTE.length]))

describe('Malstunde', () => {
  it('wohnt in Haus 4 mit breiter Bühne', () => {
    expect(hasMinigame(4)).toBe(true)
    expect(minigameFor(4).title).toBe('Malstunde')
    expect(minigameFor(4).layout).toBe('wide')
  })

  it('hat eindeutige Flächen und nur Streifen, die auf bekannten Flächen liegen', () => {
    const ids = REGIONS.map((region) => region.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const region of REGIONS) {
      expect(region.parts.length).toBeGreaterThan(0)
      if (region.clipTo) expect(ids.indexOf(region.clipTo)).toBeLessThan(ids.indexOf(region.id))
    }
  })

  it('ist erst fertig, wenn jede Fläche eine Farbe hat', () => {
    expect(isComplete({})).toBe(false)
    const { sky: _sky, ...almost } = allColored
    expect(isComplete(almost)).toBe(false)
    expect(coloredCount(almost)).toBe(REGIONS.length - 1)
    expect(isComplete(allColored)).toBe(true)
  })

  it('übernimmt nur gültige gespeicherte Farben', () => {
    expect(restoreColoring({ colors: allColored })).toEqual(allColored)
    expect(restoreColoring({ colors: { sky: 99, nose: -1, head: 2.5, body: 3, unknown: 1 } })).toEqual({ body: 3 })
    expect(restoreColoring(undefined)).toEqual({})
    expect(restoreColoring('kaputt')).toEqual({})
  })

  it('malt das fertige Bild als SVG mit den gewählten Farben', () => {
    const svg = artworkSvg({ ...allColored, nose: 4 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain(PALETTE[4].hex)
    expect(svg).toContain('clip-path="url(#clip-hat)"')
  })
})
