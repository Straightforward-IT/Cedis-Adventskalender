import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { ALL_DOTS, ANTLER_LEFT, ANTLER_RIGHT, BOARD, connect, connectedPath, DOTS, expectedDots, freshGame, hintDot, HINT_AFTER, isComplete, restoreGame, startGame } from './model.ts'
import type { DotsState } from './model.ts'

function play(state: DotsState, dots: number[]): DotsState {
  for (const dot of dots) state = connect(state, dot).state
  return state
}

const clockwise = Array.from({ length: DOTS.length }, (_, i) => (i + 1) % DOTS.length)
const counterClockwise = Array.from({ length: DOTS.length }, (_, i) => (DOTS.length - 1 - i) % DOTS.length)

describe('Spuren im Schnee', () => {
  it('wohnt in Haus 2', () => {
    expect(hasMinigame(2)).toBe(true)
    expect(minigameFor(2).title).toBe('Spuren im Schnee')
  })

  it('verteilt die Punkte so, dass jeder Punkt gut zu treffen ist', () => {
    for (const [i, a] of ALL_DOTS.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.x).toBeLessThanOrEqual(BOARD.width)
      expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeLessThanOrEqual(BOARD.height)
      for (const b of ALL_DOTS.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(24)
    }
  })

  it('ist links und rechts spiegelgleich, die Geweihe eingeschlossen', () => {
    const mirrored = ANTLER_LEFT.map((i) => ({ x: BOARD.width - DOTS[i].x, y: DOTS[i].y }))
    expect(ANTLER_RIGHT.map((i) => DOTS[i]).reverse()).toEqual(mirrored)
  })

  it('lässt am Start beide Richtungen zu und schließt die Runde am Startpunkt', () => {
    for (const route of [clockwise, counterClockwise]) {
      const almost = play(freshGame(), route.slice(0, -1))
      expect(isComplete(almost)).toBe(false)
      expect(expectedDots(almost)).toEqual([0])
      const done = play(almost, route.slice(-1))
      expect(isComplete(done)).toBe(true)
      expect(connectedPath(done).at(-1)).toBe(0)
      expect(connect(done, 5).result).toBe('ignored')
    }
  })

  it('verwirft falsche Linien und zeigt nach drei Fehlversuchen den richtigen Punkt', () => {
    let state = play(freshGame(), [1, 2])
    expect(hintDot(state)).toBeNull()
    for (let miss = 1; miss <= HINT_AFTER; miss++) {
      const { state: next, result } = connect(state, 20)
      expect(result).toBe('wrong')
      expect(next.lines).toBe(2)
      state = next
    }
    expect(hintDot(state)).toBe(3)
    expect(connect(state, 20).state.misses).toBe(HINT_AFTER)
    const fixed = connect(state, 3)
    expect(fixed.result).toBe('correct')
    expect(fixed.state.misses).toBe(0)
    expect(hintDot(fixed.state)).toBeNull()
  })

  it('streut Lockvögel ein, die immer als falsche Linie zählen', () => {
    expect(ALL_DOTS.length - DOTS.length).toBeGreaterThanOrEqual(8)
    const decoys = ALL_DOTS.map((_, i) => i).filter((i) => i >= DOTS.length)
    const start = connect(freshGame(), decoys[0])
    expect(start.result).toBe('wrong')
    const midway = play(freshGame(), clockwise.slice(0, 12))
    for (const decoy of decoys) {
      const { state, result } = connect(midway, decoy)
      expect(result).toBe('wrong')
      expect(state.lines).toBe(12)
    }
  })

  it('wertet Klicks auf schon verbundene Punkte nicht als Fehler', () => {
    const state = play(freshGame(), [1, 2, 3])
    expect(connect(state, 1)).toEqual({ state, result: 'ignored' })
    expect(connect(state, 3)).toEqual({ state, result: 'ignored' })
    expect(connect(state, 0)).toEqual({ state, result: 'ignored' })
    expect(connect(state, 99).result).toBe('ignored')
  })

  it('stellt gültige Spielstände wieder her und verwirft kaputte', () => {
    const state = play(freshGame(), counterClockwise.slice(0, 7))
    expect(restoreGame(JSON.parse(JSON.stringify(state)))).toEqual(state)
    expect(restoreGame(undefined)).toEqual(freshGame())
    expect(restoreGame({ ...state, version: 1 })).toEqual(freshGame())
    expect(restoreGame({ ...state, lines: DOTS.length + 1 })).toEqual(freshGame())
    expect(restoreGame({ ...state, direction: 0 })).toEqual(freshGame())
    expect(restoreGame({ ...state, misses: 7 })).toEqual(freshGame())
  })

  it('beginnt bei einem erneuten Besuch eines gelösten Rentiers von vorn', () => {
    const done = play(freshGame(), clockwise)
    expect(startGame(done, true)).toEqual(freshGame())
    expect(startGame(done, false)).toEqual(done)
    const half = play(freshGame(), clockwise.slice(0, 10))
    expect(startGame(half, true)).toEqual(half)
  })
})
