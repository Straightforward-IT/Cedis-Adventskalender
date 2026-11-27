import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import {
  addExtra, COOL_TIME, createShop, discard, GOAL, isCold, isDone, isReady, POUR_TIME, pour,
  restoreHappy, serve, SPOTS, step, WALK_TIME,
} from './model.ts'
import type { Order, Shop } from './model.ts'

/** Lässt Zeit in kleinen Schritten vergehen – wie die Szene Bild für Bild. */
function wait(shop: Shop, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) step(shop, 0.05)
}

/** Bis der erste Gast an der Theke steht. */
function firstGuest(shop: Shop) {
  wait(shop, 1 + WALK_TIME)
  const guest = shop.customers[0]
  expect(guest).toBeDefined()
  return guest
}

function make(shop: Shop, order: Order): number {
  const poured = pour(shop, order.base)
  if (!poured.ok) throw new Error(poured.reason)
  wait(shop, POUR_TIME + 0.1)
  if (order.extra) {
    const added = addExtra(shop, order.extra, poured.cup)
    expect(added).toEqual({ ok: true, cup: poured.cup })
    wait(shop, 0.5)
  }
  expect(isReady(shop.cups[poured.cup])).toBe(true)
  return poured.cup
}

describe('Glühwein-Fieber', () => {
  it('wohnt in Haus 13', () => {
    expect(hasMinigame(13)).toBe(true)
    expect(minigameFor(13).title).toBe('Glühwein-Fieber')
  })

  it('der erste Gast möchte einen Glühwein und läuft erst zur Theke', () => {
    const shop = createShop()
    wait(shop, 1)
    expect(shop.customers).toHaveLength(1)
    expect(shop.customers[0].order).toEqual({ base: 'gluehwein', extra: null })
    const cup = make(shop, { base: 'gluehwein', extra: null })
    // Noch unterwegs? Dann kann man nichts reichen.
    if (shop.customers[0].arrive > 0) expect(serve(shop, cup, shop.customers[0].id)).toEqual({ ok: false, reason: 'not-here' })
  })

  it('zapfen dauert, Schuss und Sahne gehen schnell', () => {
    const shop = createShop()
    const poured = pour(shop, 'kakao')
    expect(poured.ok).toBe(true)
    wait(shop, POUR_TIME / 2)
    expect(isReady(shop.cups[0])).toBe(false)
    expect(addExtra(shop, 'sahne')).toEqual({ ok: false, reason: 'nothing' })
    wait(shop, POUR_TIME / 2 + 0.1)
    expect(isReady(shop.cups[0])).toBe(true)
    expect(addExtra(shop, 'rum')).toEqual({ ok: false, reason: 'nothing' })
    expect(addExtra(shop, 'sahne')).toEqual({ ok: true, cup: 0 })
    expect(isReady(shop.cups[0])).toBe(false)
    wait(shop, 0.4)
    expect(isReady(shop.cups[0])).toBe(true)
    expect(addExtra(shop, 'sahne')).toEqual({ ok: false, reason: 'nothing' })
  })

  it('jede Zapfstelle füllt nur einen Becher auf einmal, höchstens drei Becher', () => {
    const shop = createShop()
    expect(pour(shop, 'gluehwein')).toEqual({ ok: true, cup: 0 })
    expect(pour(shop, 'gluehwein')).toEqual({ ok: false, reason: 'busy' })
    expect(pour(shop, 'kakao')).toEqual({ ok: true, cup: 1 })
    wait(shop, POUR_TIME + 0.1)
    expect(pour(shop, 'gluehwein', 2)).toEqual({ ok: true, cup: 2 })
    wait(shop, POUR_TIME + 0.1)
    expect(pour(shop, 'kakao')).toEqual({ ok: false, reason: 'full' })
    expect(discard(shop, 1)).toBe(true)
    expect(pour(shop, 'kakao')).toEqual({ ok: true, cup: 1 })
    expect(discard(shop, 1)).toBe(false)
  })

  it('fertige Becher werden schnell kalt – kalt serviert zählt nicht', () => {
    const shop = createShop()
    const guest = firstGuest(shop)
    const cup = make(shop, guest.order)
    wait(shop, COOL_TIME + 0.2)
    expect(isCold(shop.cups[cup])).toBe(true)
    const result = serve(shop, cup, guest.id)
    expect(result).toMatchObject({ ok: true, outcome: 'cold' })
    expect(shop.happy).toBe(0)
    expect(shop.cups[cup].base).toBeNull()
  })

  it('ein falsches Getränk wird mitgenommen, zählt aber nicht', () => {
    const shop = createShop()
    const guest = firstGuest(shop)
    const cup = make(shop, { base: 'gluehwein', extra: 'rum' })
    expect(serve(shop, cup, guest.id)).toMatchObject({ ok: true, outcome: 'wrong', drink: { base: 'gluehwein', extra: 'rum' } })
    expect(shop.happy).toBe(0)
    expect(shop.customers.some((c) => c.id === guest.id)).toBe(false)
  })

  it('höchstens drei Gäste an der Theke, jeder auf eigenem Platz', () => {
    const shop = createShop()
    wait(shop, 40)
    expect(shop.customers).toHaveLength(SPOTS)
    expect(new Set(shop.customers.map((c) => c.spot)).size).toBe(SPOTS)
  })

  it('acht glückliche Gäste lösen das Haus', () => {
    const shop = createShop()
    let rounds = 0
    while (!isDone(shop) && rounds++ < 40) {
      wait(shop, 0.5)
      const guest = shop.customers.find((c) => c.arrive <= 0)
      if (!guest) continue
      const cup = make(shop, guest.order)
      expect(serve(shop, cup, guest.id)).toMatchObject({ ok: true, outcome: 'happy' })
    }
    expect(shop.happy).toBe(GOAL)
    expect(shop.served).toBe(GOAL)
    // Danach kommt niemand Neues mehr, und gezapft wird auch nicht mehr.
    const waiting = shop.customers.length
    wait(shop, 20)
    expect(shop.customers).toHaveLength(waiting)
    expect(pour(shop, 'kakao')).toEqual({ ok: false, reason: 'done' })
  })

  it('alle Bestellungen kommen vor', () => {
    const shop = createShop(0, 7)
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      wait(shop, 8)
      for (const c of shop.customers) seen.add(`${c.order.base}+${c.order.extra}`)
      shop.customers = []
    }
    expect([...seen].sort()).toEqual(['gluehwein+amaretto', 'gluehwein+null', 'gluehwein+rum', 'kakao+null', 'kakao+sahne'])
  })

  it('merkt sich nur gültige Zwischenstände', () => {
    expect(restoreHappy({ happy: 5 })).toBe(5)
    expect(restoreHappy({ happy: 50 })).toBe(GOAL)
    expect(restoreHappy({ happy: -2 })).toBe(0)
    expect(restoreHappy({ happy: 'viele' })).toBe(0)
    expect(restoreHappy(null)).toBe(0)
    expect(createShop(5).happy).toBe(5)
  })
})
