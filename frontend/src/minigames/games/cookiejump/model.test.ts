import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import {
  COOKIE, cookieX, createWorld, GOAL, isDone, JUMP, MAX_JUMP_HEIGHT, restore, step, WIDTH, wrapDelta,
} from './model.ts'
import type { Cookie, World } from './model.ts'

const DT = 1 / 60

/** Ein einfacher Autopilot: Er steuert auf das nächste erreichbare Plätzchen – am liebsten eins mit Geschenk. */
function autopilot(world: World, from: { y: number }): number {
  const santa = world.santa
  const reachable = world.cookies.filter((c) => c.y > from.y + 0.2 && c.y < from.y + MAX_JUMP_HEIGHT * 0.9)
  const withPresent = reachable.filter((c) => world.presents.some((p) => !p.taken && Math.abs(p.x - c.x) < 0.01 && p.y > c.y))
  const pool = withPresent.length ? withPresent : reachable
  const target = pool.sort((a, b) => Math.abs(wrapDelta(cookieX(a, world.time) - santa.x)) - Math.abs(wrapDelta(cookieX(b, world.time) - santa.x)))[0]
  if (!target) return 0
  const dx = wrapDelta(cookieX(target, world.time) - santa.x)
  return Math.abs(dx) < 0.25 ? 0 : Math.sign(dx)
}

describe('Plätzchen-Hüpfer', () => {
  it('wohnt in Haus 15', () => {
    expect(hasMinigame(15)).toBe(true)
    expect(minigameFor(15).title).toBe('Plätzchen-Hüpfer')
  })

  it('kein Plätzchen liegt zu hoch über dem vorigen', () => {
    const world = createWorld(0, 3)
    let last = -Infinity
    const ys = world.cookies.map((c) => c.y).sort((a, b) => a - b)
    for (const y of ys) {
      if (last > -Infinity) expect(y - last).toBeLessThan(MAX_JUMP_HEIGHT * 0.9)
      last = y
    }
    expect(world.cookies.some((c) => c.move)).toBe(true)
    expect(world.cookies.some((c) => !c.move)).toBe(true)
    expect(world.presents.length).toBeGreaterThan(0)
  })

  it('landet auf einem Plätzchen und springt von selbst wieder ab', () => {
    const world = createWorld()
    let landed: Cookie | null = null
    for (let i = 0; i < 180 && !landed; i++) landed = step(world, DT, 0).landed
    expect(landed).not.toBeNull()
    expect(world.santa.vy).toBe(JUMP)
  })

  it('läuft am Rand hinaus und kommt auf der anderen Seite herein', () => {
    const world = createWorld()
    world.santa.x = WIDTH - 0.05
    world.santa.vx = 9
    step(world, DT, 1)
    expect(world.santa.x).toBeLessThan(1)
    expect(wrapDelta(9.9 - 0.1)).toBeCloseTo(-0.2)
  })

  it('gleitende Plätzchen bleiben im Bild', () => {
    const world = createWorld(0, 11)
    for (const cookie of world.cookies.filter((c) => c.move)) {
      for (let t = 0; t < 20; t += 0.3) {
        const x = cookieX(cookie, t)
        expect(x - COOKIE.width / 2).toBeGreaterThanOrEqual(-1e-9)
        expect(x + COOKIE.width / 2).toBeLessThanOrEqual(WIDTH + 1e-9)
      }
    }
  })

  it('wer fällt, wird aufgefangen – Geschenke bleiben gesammelt', () => {
    const world = createWorld(3)
    // Hoch hinaus, dann einfach fallen lassen
    world.santa.y = 40
    world.camera = 34
    world.santa.vy = 0
    let rescued = false
    for (let i = 0; i < 600 && !rescued; i++) rescued = step(world, DT, 0).rescued || rescued
    // Ohne Lenken landet er womöglich auf etwas – dann künstlich aus dem Bild schieben.
    if (!rescued) {
      world.santa.y = world.camera - 5
      world.santa.vy = -5
      rescued = step(world, DT, 0).rescued
    }
    expect(rescued).toBe(true)
    expect(world.collected).toBe(3)
    expect(world.santa.y).toBeGreaterThanOrEqual(world.camera)
  })

  it('mit gezieltem Springen lassen sich acht Geschenke einsammeln', () => {
    for (const seed of [1, 2, 3]) {
      const world = createWorld(0, seed)
      let from = { y: 0 }
      let t = 0
      while (!isDone(world) && t < 400) {
        const events = step(world, DT, autopilot(world, from))
        if (events.landed) from = { y: events.landed.y }
        if (events.rescued) from = { y: world.santa.y - COOKIE.height }
        t += DT
      }
      expect(world.collected, `Saat ${seed}`).toBe(GOAL)
      expect(world.rescues, `Saat ${seed}`).toBeLessThan(6)
    }
  })

  it('merkt sich nur gültige Zwischenstände', () => {
    expect(restore({ presents: 4 })).toBe(4)
    expect(restore({ presents: 20 })).toBe(GOAL)
    expect(restore({})).toBe(0)
    expect(createWorld(4).collected).toBe(4)
  })
})
