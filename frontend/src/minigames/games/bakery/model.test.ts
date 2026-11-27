import { describe, expect, it } from 'vitest'
import { createOrders, FIELDS, FLAVOURS, freshGame, mismatches, ORDER_COUNT, reachableStation, restoreGame, SHAPES, startGame, TOPPINGS, updateGame } from './model.ts'
import type { BakeryState, Recipe } from './model.ts'
import { hasMinigame, minigameFor } from '../../registry.ts'

const orders = createOrders(1)

function bake(state: BakeryState, order: Recipe): BakeryState {
  for (const [station, field] of FIELDS.entries()) {
    state = updateGame(state, { type: 'select', field, value: order[field] }, orders)
    state = updateGame(state, { type: 'move', station: station + 1 }, orders)
  }
  return state
}

describe('Weihnachtsbäckerei', () => {
  it('wohnt nur in Haus 1 und reserviert eine breite Bühne', () => {
    expect(hasMinigame(1)).toBe(true)
    expect(hasMinigame(23)).toBe(false)
    expect(minigameFor(1).layout).toBe('wide')
  })

  it('erzeugt fünf unterschiedliche, reproduzierbare Bestellungen mit allen Zutaten', () => {
    expect(createOrders(1)).toEqual(orders)
    expect(orders).toHaveLength(ORDER_COUNT)
    expect(new Set(orders.map((order) => JSON.stringify(order))).size).toBe(ORDER_COUNT)
    for (const field of FIELDS) {
      const options = field === 'shape' ? SHAPES : field === 'topping' ? TOPPINGS : FLAVOURS
      expect(new Set(orders.map((order) => order[field])).size).toBe(options.length)
    }
  })

  it('lässt keine Station aus und nimmt nur Zutaten an der passenden Station an', () => {
    const state = freshGame()
    expect(updateGame(state, { type: 'move', station: 4 }, orders)).toBe(state)
    expect(updateGame(state, { type: 'select', field: 'icing', value: 'vanilla' }, orders)).toBe(state)
    expect(updateGame(state, { type: 'select', field: 'shape', value: 'toString' }, orders)).toBe(state)
    expect(updateGame(state, { type: 'serve' }, orders).served).toBe(false)
    expect(updateGame(state, { type: 'next-order' }, orders).orderIndex).toBe(0)
  })

  it('behält nach dem Aussortieren dieselbe Bestellung und zählt nur den passenden Kuchen', () => {
    const orderIndex = 2
    const order = orders[orderIndex]
    const wrong: Recipe = { ...order, icing: order.icing === 'chocolate' ? 'vanilla' : 'chocolate' }
    let state = bake(freshGame(orderIndex), wrong)
    expect(mismatches(state.cake, order)).toEqual(['icing'])
    expect(updateGame(state, { type: 'serve' }, orders)).toBe(state)
    state = updateGame(state, { type: 'reset-cake' }, orders)
    expect(state).toEqual(freshGame(orderIndex))
    state = updateGame(bake(state, order), { type: 'serve' }, orders)
    expect(state.served).toBe(true)
    expect(updateGame(state, { type: 'serve' }, orders)).toBe(state)
    expect(updateGame(state, { type: 'reset-cake' }, orders)).toBe(state)
    expect(updateGame(state, { type: 'next-order' }, orders)).toEqual(freshGame(orderIndex + 1))
  })

  it('nimmt fünf Bestellungen an und bleibt am Ende beim vollständigen Ergebnis', () => {
    let state = freshGame()
    for (let i = 0; i < ORDER_COUNT; i++) {
      state = bake(state, orders[i])
      state = updateGame(state, { type: 'serve' }, orders)
      expect(state.served).toBe(true)
      expect(state.orderIndex + 1).toBe(i + 1)
      if (i < ORDER_COUNT - 1) state = updateGame(state, { type: 'next-order' }, orders)
    }
    expect(updateGame(state, { type: 'next-order' }, orders)).toBe(state)
    expect(restoreGame(JSON.parse(JSON.stringify(state)), orders)).toEqual(state)
  })

  it('setzt beim Neuanfang nur den aktuellen Kuchen zurück', () => {
    const state = bake(freshGame(3), orders[3])
    expect(updateGame(state, { type: 'reset-cake' }, orders)).toEqual(freshGame(3))
  })

  it('setzt einen gespeicherten Kuchen auch an einer früheren Korrekturstation fort', () => {
    const state = { ...bake(freshGame(2), orders[2]), station: 1 }
    expect(restoreGame(JSON.parse(JSON.stringify(state)), orders)).toEqual(state)
    expect(reachableStation(state.cake)).toBe(4)
  })

  it('behält einen offenen Abschluss und startet nach der Belohnung eine neue Runde', () => {
    const finished = updateGame(bake(freshGame(4), orders[4]), { type: 'serve' }, orders)
    expect(startGame(finished, orders, false)).toEqual(finished)
    expect(startGame(finished, orders, true)).toEqual(freshGame())
    expect(startGame(undefined, orders, true)).toEqual(freshGame())
  })

  it('nimmt auch eine unterbrochene Wiederholungsrunde wieder auf', () => {
    const replay = { ...bake(freshGame(1), orders[1]), station: 2 }
    expect(startGame(replay, orders, true)).toEqual(replay)
  })

  it.each([
    undefined, null, [], {}, { version: 2 },
    { ...freshGame(), orderIndex: -1 },
    { ...freshGame(), orderIndex: ORDER_COUNT },
    { ...freshGame(), orderIndex: 0.5 },
    { ...freshGame(), station: 3 },
    { ...freshGame(), station: NaN },
    { ...freshGame(), served: true },
    { ...freshGame(), cake: { shape: 'toString', filling: null, icing: null, topping: null } },
    { ...freshGame(), cake: { shape: null, filling: 'vanilla', icing: null, topping: null } },
    { ...freshGame(), cake: { shape: 'round' } },
    { ...bake(freshGame(), orders[1]), served: true },
  ])('fällt bei ungültigem oder veraltetem Spielstand sicher auf einen neuen zurück (%#)', (saved) => {
    expect(restoreGame(saved, orders)).toEqual(freshGame())
  })
})
