import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import {
  freeLength, isDone, lampsAlong, LAMPS_PER_CABLE, LEVEL, limit, OUTLETS, outletNear, plugPose, pointAt, pull, restore,
  startStates, wirePoints,
} from './model.ts'
import type { CableState } from './model.ts'

const GREEN = 0
const GREY = 1
const DARK = 2

/** Den Stecker Schritt für Schritt rückwärts am eigenen Kabel entlang ziehen, so weit es geht. */
function pullBack(states: CableState[], cable: number) {
  const c = LEVEL.cables[cable]
  let last = pull(LEVEL, cable, states, pointAt(c, states[cable].length))
  for (let step = 0; step < 400; step++) {
    const finger = pointAt(c, states[cable].length - 30)
    last = pull(LEVEL, cable, states, finger)
    if (last.length >= states[cable].length - 0.01 && !last.freed) break
    states[cable] = { ...states[cable], length: last.length }
    if (last.freed) {
      states[cable] = { status: 'free', length: last.length, plug: finger, outlet: null }
      break
    }
  }
  return last
}

describe('Lichterketten-Schlamassel', () => {
  it('wohnt in Haus 9', () => {
    expect(hasMinigame(9)).toBe(true)
    expect(minigameFor(9).title).toBe('Lichterketten-Schlamassel')
  })

  it('verknotet die Stränge wie geplant', () => {
    const threads = LEVEL.threads.map((t) => `${t.by}→${t.owner}.${t.loop}`).sort()
    expect(threads).toEqual([
      `${GREEN}→${GREY}.0`, `${GREEN}→${DARK}.0`, `${GREEN}→${DARK}.1`,
      `${GREY}→${GREEN}.0`, `${GREY}→${GREEN}.1`, `${GREY}→${DARK}.1`, `${GREY}→${DARK}.2`,
      `${DARK}→${GREEN}.0`, `${DARK}→${GREY}.0`,
    ].sort())
    // Drei Schlaufen, durch die jeweils beide anderen Stränge laufen.
    const shared = LEVEL.cables.flatMap((c, owner) => c.loops.map((_, loop) =>
      LEVEL.threads.filter((t) => t.owner === owner && t.loop === loop).length)).filter((n) => n === 2)
    expect(shared).toHaveLength(3)
  })

  it('verteilt immer gleich viele Lämpchen über den sichtbaren Strang', () => {
    const states = startStates()
    expect(lampsAlong(wirePoints(LEVEL, GREEN, states[GREEN]))).toHaveLength(LAMPS_PER_CABLE)
    const free: CableState = { status: 'free', length: freeLength(LEVEL, GREEN), plug: { x: 200, y: 200 }, outlet: null }
    expect(lampsAlong(wirePoints(LEVEL, GREEN, free))).toHaveLength(LAMPS_PER_CABLE)
    // Der freie Strang endet genau unter seinem Stecker.
    const end = wirePoints(LEVEL, GREEN, free).at(-1)!
    expect(end.x).toBeCloseTo(200)
    expect(end.y).toBeGreaterThan(200)
  })

  it('beginnt mit allen Steckern mitten im Knäuel', () => {
    const states = startStates()
    states.forEach((s, i) => {
      expect(s.status).toBe('tangled')
      expect(s.length).toBeGreaterThan(freeLength(LEVEL, i))
    })
  })

  it('lässt den Stecker nicht los, wenn man vom Kabel wegzieht', () => {
    const states = startStates()
    const result = pull(LEVEL, GREY, states, { x: 0, y: 0 })
    expect(result.taut).toBe(true)
    expect(result.length).toBe(states[GREY].length)
  })

  it('hält eine Schlaufe fest, solange ein anderes Kabel hindurch steckt', () => {
    const states = startStates()
    expect(limit(LEVEL, GREEN, states).blocker).toBe(GREY)
    expect(limit(LEVEL, DARK, states).blocker).not.toBeNull()

    const stuck = pullBack(states, GREEN)
    expect(stuck.blocker).toBe(GREY)
    expect(states[GREEN].status).toBe('tangled')
    expect(states[GREEN].length).toBeCloseTo(LEVEL.cables[GREEN].loops[1].to, 0)
  })

  it('lässt keinen Strang allein frei – man muss abwechselnd ziehen', () => {
    for (const cable of [GREEN, GREY, DARK]) {
      const states = startStates()
      expect(pullBack(states, cable).blocker).not.toBeNull()
      expect(states[cable].status).toBe('tangled')
    }
  })

  it('ist lösbar: grün und dunkelgrün ein Stück zurück, dann grau, dann der Rest', () => {
    const states = startStates()
    pullBack(states, GREEN)
    pullBack(states, DARK)
    expect(states.map((s) => s.status)).toEqual(['tangled', 'tangled', 'tangled'])
    pullBack(states, GREY)
    expect(states[GREY].status).toBe('free')
    pullBack(states, GREEN)
    expect(states[GREEN].status).toBe('free')
    pullBack(states, DARK)
    expect(states[DARK].status).toBe('free')
  })

  it('steckt nur in freie Dosen', () => {
    const states = startStates()
    OUTLETS.forEach((outlet, i) => expect(outletNear(outlet, states)).toBe(i))
    expect(outletNear({ x: 200, y: 400 }, states)).toBeNull()
    states[GREY] = { status: 'plugged', length: 100, plug: null, outlet: 1 }
    expect(outletNear(OUTLETS[1], states)).not.toBe(1)
    expect(plugPose(LEVEL, GREY, states[GREY]).at).toEqual(OUTLETS[1])
  })

  it('ist fertig, wenn alle Handys laden', () => {
    const states = startStates()
    expect(isDone(states)).toBe(false)
    expect(isDone(states.map((s) => ({ ...s, status: 'plugged' as const })))).toBe(true)
  })

  it('übernimmt nur einen gültigen Zwischenstand', () => {
    expect(restore(undefined)).toEqual(startStates())
    expect(restore({ cables: [1, 2, 3] })).toEqual(startStates())
    const saved = startStates()
    saved[GREY] = { status: 'free', length: 100, plug: { x: 50, y: 300 }, outlet: null }
    saved[GREEN] = { status: 'plugged', length: 200, plug: null, outlet: 2 }
    expect(restore(JSON.parse(JSON.stringify({ cables: saved })))).toEqual(saved)
    expect(restore({ cables: saved.map((s) => ({ ...s, length: -5 })) })).toEqual(startStates())
    // Zwei Stecker in derselben Dose gibt es nicht.
    const doubled = saved.map((s) => ({ ...s, status: 'plugged' as const, outlet: 0 }))
    expect(restore({ cables: doubled })).toEqual(startStates())
  })
})
