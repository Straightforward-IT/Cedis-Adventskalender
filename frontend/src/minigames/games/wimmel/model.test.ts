import { describe, expect, it } from 'vitest'
import { buildScene, HIDEOUTS, isComplete, markFound, nextHidden, RUDOLPH, startGame, tapAt, freshGame, restoreState } from './model.ts'

describe('Rentier-Suche', () => {
  it('baut ein großes, stets gleiches Bild mit genau fünf versteckten Rentieren', () => {
    const scene = buildScene()
    expect(scene.length).toBeGreaterThan(300)
    expect(JSON.stringify(buildScene())).toBe(JSON.stringify(scene))
    const deer = scene.filter((item) => item.kind.startsWith('reindeer'))
    expect(deer).toHaveLength(HIDEOUTS.length)
    expect(HIDEOUTS).toHaveLength(5)
    // Hinten nach vorn sortiert, damit Bäume die Rentiere verdecken können.
    for (let i = 1; i < scene.length; i++) expect(scene[i].y).toBeGreaterThanOrEqual(scene[i - 1].y)
  })

  it('trifft Rentiere, Rudolph und daneben', () => {
    let state = freshGame()
    const [first] = HIDEOUTS
    expect(tapAt(state, first.cx, first.cy)).toEqual({ hit: 'reindeer', id: first.id })
    expect(tapAt(state, RUDOLPH.cx, RUDOLPH.cy)).toEqual({ hit: 'rudolph' })
    expect(tapAt(state, 1500, 650)).toEqual({ hit: 'miss' })
    state = markFound(state, first.id)
    expect(tapAt(state, first.cx, first.cy)).toEqual({ hit: 'again', id: first.id })
    expect(nextHidden(state)?.id).toBe(HIDEOUTS[1].id)
  })

  it('ist mit allen Funden gelöst und startet beim Wiederholen neu', () => {
    const state = HIDEOUTS.reduce((s, h) => markFound(s, h.id), freshGame())
    expect(isComplete(state)).toBe(true)
    expect(startGame(state, true).found).toEqual([])
    expect(startGame(state, false).found).toHaveLength(HIDEOUTS.length)
    expect(restoreState({ found: [0, 0, 9, 'x'] })).toEqual({ found: [0] })
  })
})
