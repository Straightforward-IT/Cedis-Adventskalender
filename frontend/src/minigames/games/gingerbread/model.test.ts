import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { canPlace, isBuilt, isDecorated, MIN_CANDIES, nearSlot, onHouse, PIECES, restoreState } from './model.ts'
import type { PieceId } from './model.ts'

const ORDER: PieceId[] = ['base', 'wall', 'roofLeft', 'roofRight', 'chimney', 'door']

describe('Lebkuchenhaus', () => {
  it('wohnt in Haus 7 mit breiter Bühne', () => {
    expect(hasMinigame(7)).toBe(true)
    expect(minigameFor(7).title).toBe('Lebkuchenhaus')
    expect(minigameFor(7).layout).toBe('wide')
  })

  it('lässt sich nur in sinnvoller Reihenfolge bauen', () => {
    expect(canPlace([], 'base')).toBe(true)
    expect(canPlace([], 'wall')).toBe(false)
    expect(canPlace(['base'], 'roofLeft')).toBe(false)
    expect(canPlace(['base', 'wall'], 'chimney')).toBe(false)
    expect(canPlace(['base', 'wall', 'roofRight'], 'chimney')).toBe(true)
    expect(canPlace(['base'], 'base')).toBe(false)
  })

  it('ist fertig gebaut, wenn alle Teile stehen', () => {
    const placed: PieceId[] = []
    for (const id of ORDER) {
      expect(canPlace(placed, id)).toBe(true)
      placed.push(id)
    }
    expect(isBuilt(placed)).toBe(true)
    expect(PIECES.every((p) => p.hint !== '' || p.needs.length === 0)).toBe(true)
  })

  it('rastet nur in der Nähe des richtigen Platzes ein', () => {
    expect(nearSlot('wall', 205, 220)).toBe(true)
    expect(nearSlot('wall', 200, 120)).toBe(false)
  })

  it('erkennt, was zum Haus gehört', () => {
    expect(onHouse(200, 220)).toBe(true) // Wand
    expect(onHouse(200, 110)).toBe(true) // Dach
    expect(onHouse(258, 110)).toBe(true) // Schornstein
    expect(onHouse(20, 40)).toBe(false)
    expect(onHouse(360, 240)).toBe(false)
  })

  it('braucht Zuckerguss und ein paar Süßigkeiten', () => {
    const candy = (i: number) => ({ id: i, type: 'smartie' as const, x: 200, y: 220, rotate: 0, variant: 0 })
    const few = { placed: ORDER, icing: true, candies: [candy(1)] }
    expect(isDecorated(few)).toBe(false)
    const many = { ...few, candies: Array.from({ length: MIN_CANDIES }, (_, i) => candy(i)) }
    expect(isDecorated(many)).toBe(true)
    expect(isDecorated({ ...many, icing: false })).toBe(false)
  })

  it('übernimmt nur stimmige gespeicherte Stände', () => {
    expect(restoreState(undefined)).toEqual({ placed: [], candies: [], icing: false })
    expect(restoreState({ placed: ['wall', 'base', 'quatsch'] }).placed).toEqual(['base'])
    const restored = restoreState({
      placed: ORDER,
      icing: true,
      candies: [{ type: 'star', x: 200, y: 220, rotate: 10 }, { type: 'star', x: 5, y: 5 }, { type: 'nope', x: 200, y: 220 }],
    })
    expect(restored.icing).toBe(true)
    expect(restored.candies).toHaveLength(1)
  })
})
