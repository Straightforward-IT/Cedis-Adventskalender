import { describe, expect, it } from 'vitest'
import { freshRoom, interact, restoreRoom, tasks } from './model.ts'
import type { RoomState, Target } from './model.ts'

const play = (targets: Target[], start: RoomState = freshRoom()) =>
  targets.reduce((state, target) => interact(state, target).state, start)

describe('Durch den Schornstein', () => {
  it('lässt sich in sinnvoller Reihenfolge lösen', () => {
    const state = play(['plate', 'drawer', 'treats', 'cat', 'cabinet', 'wine', 'balcony'])
    expect(state.escaped).toBe(true)
    expect(tasks(state).every((t) => t.done)).toBe(true)
  })

  it('die Katze blockiert die Balkontür, bis sie Leckerli bekommt', () => {
    const ready = play(['plate', 'cabinet', 'wine'])
    expect(interact(ready, 'balcony').effect).toBe('meow')
    expect(interact(ready, 'cat').effect).toBe('meow')
    const fed = play(['drawer', 'treats', 'cat'], ready)
    expect(fed.catFed).toBe(true)
    expect(fed.items).not.toContain('treats')
    expect(interact(fed, 'balcony').state.escaped).toBe(true)
  })

  it('ohne Kekse oder Wein geht es nicht hinaus', () => {
    const fed = play(['drawer', 'treats', 'cat'])
    expect(interact(fed, 'balcony').message).toBe('Nicht ohne Kekse und Wein!')
    expect(interact(play(['plate'], fed), 'balcony').message).toBe('Nicht ohne Wein!')
  })

  it('Wein und Leckerli gibt es nur bei offener Tür bzw. Schublade', () => {
    expect(interact(freshRoom(), 'wine').effect).toBe('blocked')
    expect(interact(freshRoom(), 'treats').effect).toBe('blocked')
    expect(play(['cabinet', 'wine']).items).toEqual(['wine'])
  })

  it('jedes Ding gibt es nur einmal', () => {
    const state = play(['plate', 'plate', 'cabinet', 'wine', 'wine'])
    expect(state.items).toEqual(['cookies', 'wine'])
  })

  it('stellt nur stimmige Spielstände wieder her', () => {
    expect(restoreRoom(undefined)).toEqual(freshRoom())
    expect(restoreRoom({ items: ['cookies', 'gold'], catFed: false }).items).toEqual(['cookies'])
    expect(restoreRoom({ items: ['treats'], catFed: true }).items).toEqual([])
    expect(restoreRoom({ items: ['cookies'], catFed: true, escaped: true }).escaped).toBe(false)
    expect(restoreRoom({ items: ['cookies', 'wine'], catFed: true, escaped: true }).escaped).toBe(true)
  })
})
