import { createRandom, hashSeed } from '../../../lib/rng.ts'
import type { Random } from '../../../lib/rng.ts'

/**
 * Glühwein-Fieber: Am Stand vor Haus 13 bestellen Wichtel und Eichhörnchen heiße Getränke.
 *
 * - Glühwein oder Kakao zapfen dauert ein paar Sekunden; jede Zapfstelle füllt nur einen Becher zugleich.
 * - Ein Schuss (Rum/Amaretto) in den Glühwein oder Sahne auf den Kakao geht ganz schnell.
 * - Höchstens drei Becher stehen bereit – und sie kühlen schnell ab. Kalt serviert zählt nicht.
 * - Ein falsches Getränk nimmt die Kundschaft trotzdem mit, glücklich ist sie damit aber nicht.
 * - Acht glückliche Gäste, dann ist das Haus gelöst. Verlieren kann man nicht.
 *
 * Alles hier ist reine Logik in Sekunden – die Szene liest den Zustand nur ab.
 */

export type Base = 'gluehwein' | 'kakao'
export type Extra = 'rum' | 'amaretto' | 'sahne'
export type Kind = 'elf' | 'squirrel'

export interface Order {
  base: Base
  extra: Extra | null
}

export const GOAL = 8
export const CUPS = 3
/** Plätze an der Theke, an denen Kundschaft wartet. */
export const SPOTS = 3
/** Sekunden zum Zapfen eines Bechers. */
export const POUR_TIME = 2.6
/** Sekunden für Schuss oder Sahne. */
export const EXTRA_TIME = 0.35
/** So lange bleibt ein fertiger Becher warm. */
export const COOL_TIME = 13
/** So lange läuft ein Gast vom Straßenrand bis an die Theke. */
export const WALK_TIME = 2.4

export const EXTRA_FOR: Record<Extra, Base> = { rum: 'gluehwein', amaretto: 'gluehwein', sahne: 'kakao' }

export const NAMES: Record<Base | Extra, string> = {
  gluehwein: 'Glühwein',
  kakao: 'Kakao',
  rum: 'Rum',
  amaretto: 'Amaretto',
  sahne: 'Sahne',
}

/** Alle Bestellungen mit Gewicht – Glühwein ist am Stand der Renner. */
const MENU: readonly (readonly [Order, number])[] = [
  [{ base: 'gluehwein', extra: null }, 3],
  [{ base: 'gluehwein', extra: 'rum' }, 2],
  [{ base: 'gluehwein', extra: 'amaretto' }, 2],
  [{ base: 'kakao', extra: null }, 2],
  [{ base: 'kakao', extra: 'sahne' }, 2],
]

export interface Cup {
  base: Base | null
  extra: Extra | null
  /** 0 … 1: wie voll der Becher ist. */
  fill: number
  /** 1 = dampfend heiß, 0 = kalt. */
  heat: number
  /** 0 … 1: Fortschritt von Schuss oder Sahne (1, solange nichts dazukommt). */
  topping: number
}

export interface Customer {
  id: number
  kind: Kind
  /** Kleine Unterschiede im Aussehen (Mützenfarbe usw.). */
  look: number
  order: Order
  /** Platz an der Theke (0 = links). */
  spot: number
  /** Restliche Sekunden, bis der Gast an der Theke steht. */
  arrive: number
}

export type Outcome = 'happy' | 'wrong' | 'cold'

export interface Served {
  customer: Customer
  outcome: Outcome
  drink: Order
}

export interface Shop {
  cups: Cup[]
  customers: Customer[]
  happy: number
  served: number
  spawnIn: number
  nextId: number
  rnd: Random
}

export const emptyCup = (): Cup => ({ base: null, extra: null, fill: 0, heat: 0, topping: 1 })

export function createShop(happy = 0, seed = hashSeed(13, 'gluehwein', happy)): Shop {
  return {
    cups: Array.from({ length: CUPS }, emptyCup),
    customers: [],
    happy: Math.min(GOAL, Math.max(0, happy)),
    served: 0,
    spawnIn: 0.8,
    nextId: 1,
    rnd: createRandom(seed),
  }
}

export const isDone = (shop: Shop) => shop.happy >= GOAL
export const isPouring = (cup: Cup) => cup.base !== null && cup.fill < 1
export const isReady = (cup: Cup) => cup.base !== null && cup.fill >= 1 && cup.topping >= 1
export const isCold = (cup: Cup) => cup.base !== null && cup.fill >= 1 && cup.heat <= 0
export const hasArrived = (customer: Customer) => customer.arrive <= 0

export function sameOrder(a: Order, b: Order): boolean {
  return a.base === b.base && a.extra === b.extra
}

/** Ein Schritt der Zeit: zapfen, abkühlen, Gäste laufen lassen und neue schicken. */
export function step(shop: Shop, dt: number): void {
  for (const cup of shop.cups) {
    if (cup.base === null) continue
    if (cup.fill < 1) {
      cup.fill = Math.min(1, cup.fill + dt / POUR_TIME)
      cup.heat = 1
      continue
    }
    cup.heat = Math.max(0, cup.heat - dt / COOL_TIME)
    if (cup.topping < 1) cup.topping = Math.min(1, cup.topping + dt / EXTRA_TIME)
  }

  for (const customer of shop.customers) customer.arrive = Math.max(0, customer.arrive - dt)

  if (isDone(shop)) return
  shop.spawnIn -= dt
  if (shop.spawnIn > 0) return
  const taken = new Set(shop.customers.map((c) => c.spot))
  const free = Array.from({ length: SPOTS }, (_, i) => i).filter((i) => !taken.has(i))
  if (free.length === 0) {
    shop.spawnIn = 0.5
    return
  }
  spawn(shop, shop.rnd.pick(free))
  shop.spawnIn = shop.rnd.range(3.2, 6)
}

function spawn(shop: Shop, spot: number): Customer {
  // Der allererste Gast will es einfach: einen Glühwein ohne alles.
  const first = shop.nextId === 1 && shop.happy === 0
  const order = first ? { base: 'gluehwein' as const, extra: null } : { ...shop.rnd.weighted(MENU) }
  const customer: Customer = {
    id: shop.nextId++,
    kind: shop.rnd.chance(0.55) ? 'elf' : 'squirrel',
    look: shop.rnd.int(0, 3),
    order,
    spot,
    arrive: WALK_TIME,
  }
  shop.customers.push(customer)
  return customer
}

export type PourResult = { ok: true; cup: number } | { ok: false; reason: 'busy' | 'full' | 'done' }

/**
 * Zapft an der Glühwein- oder Kakaostelle in einen leeren Becher – bevorzugt in `preferred`.
 * Jede Zapfstelle füllt nur einen Becher auf einmal.
 */
export function pour(shop: Shop, base: Base, preferred: number | null = null): PourResult {
  if (isDone(shop)) return { ok: false, reason: 'done' }
  if (shop.cups.some((cup) => cup.base === base && isPouring(cup))) return { ok: false, reason: 'busy' }
  const empty = (i: number) => shop.cups[i]?.base === null
  const index = preferred !== null && empty(preferred) ? preferred : shop.cups.findIndex((cup) => cup.base === null)
  if (index < 0) return { ok: false, reason: 'full' }
  shop.cups[index] = { base, extra: null, fill: 0, heat: 1, topping: 1 }
  return { ok: true, cup: index }
}

export type ExtraResult = { ok: true; cup: number } | { ok: false; reason: 'nothing' }

/** Schuss oder Sahne – in `preferred`, wenn es dort passt, sonst in den ersten passenden fertigen Becher. */
export function addExtra(shop: Shop, extra: Extra, preferred: number | null = null): ExtraResult {
  const fits = (i: number) => {
    const cup = shop.cups[i]
    return !!cup && cup.base === EXTRA_FOR[extra] && cup.fill >= 1 && cup.extra === null
  }
  let index = preferred !== null && fits(preferred) ? preferred : -1
  if (index < 0) {
    // Am liebsten in den wärmsten passenden Becher.
    let best = -1
    shop.cups.forEach((cup, i) => {
      if (fits(i) && (best < 0 || cup.heat > shop.cups[best].heat)) best = i
    })
    index = best
  }
  if (index < 0) return { ok: false, reason: 'nothing' }
  const cup = shop.cups[index]
  cup.extra = extra
  cup.topping = 0
  return { ok: true, cup: index }
}

export type ServeResult = ({ ok: true } & Served) | { ok: false; reason: 'not-ready' | 'not-here' }

/** Reicht Becher `cupIndex` an den Gast `customerId`. Er nimmt ihn in jedem Fall mit. */
export function serve(shop: Shop, cupIndex: number, customerId: number): ServeResult {
  const cup = shop.cups[cupIndex]
  if (!cup || !isReady(cup)) return { ok: false, reason: 'not-ready' }
  const customer = shop.customers.find((c) => c.id === customerId)
  if (!customer || !hasArrived(customer)) return { ok: false, reason: 'not-here' }

  const drink: Order = { base: cup.base!, extra: cup.extra }
  const outcome: Outcome = !sameOrder(drink, customer.order) ? 'wrong' : isCold(cup) ? 'cold' : 'happy'
  if (outcome === 'happy') shop.happy = Math.min(GOAL, shop.happy + 1)
  shop.served++
  shop.cups[cupIndex] = emptyCup()
  shop.customers = shop.customers.filter((c) => c !== customer)
  // Der nächste Gast lässt nicht lange auf sich warten.
  shop.spawnIn = Math.min(shop.spawnIn, shop.rnd.range(1.4, 2.6))
  return { ok: true, customer, outcome, drink }
}

/** Becher ausschütten – etwa, wenn er kalt geworden ist. */
export function discard(shop: Shop, cupIndex: number): boolean {
  const cup = shop.cups[cupIndex]
  if (!cup || cup.base === null || isPouring(cup)) return false
  shop.cups[cupIndex] = emptyCup()
  return true
}

/** Liest den gespeicherten Zwischenstand (nur die Zahl glücklicher Gäste). */
export function restoreHappy(saved: unknown): number {
  if (!saved || typeof saved !== 'object') return 0
  const happy = (saved as { happy?: unknown }).happy
  return typeof happy === 'number' && Number.isInteger(happy) ? Math.min(GOAL, Math.max(0, happy)) : 0
}

export function describe(order: Order): string {
  if (order.extra === null) return NAMES[order.base]
  return order.extra === 'sahne' ? 'Kakao mit Sahne' : `Glühwein mit ${NAMES[order.extra]}`
}
