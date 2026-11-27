import { describe, expect, it } from 'vitest'
import { hasMinigame, minigameFor } from '../../registry.ts'
import { fullAmmo, GOAL, MAX_AMMO, MOUNDS, restoreHits, roll, ROLL_DISTANCE, take } from './model.ts'

describe('Schneeballschlacht', () => {
  it('wohnt in Haus 6 mit breiter Bühne', () => {
    expect(hasMinigame(6)).toBe(true)
    expect(minigameFor(6).title).toBe('Schneeballschlacht')
    expect(minigameFor(6).layout).toBe('wide')
  })

  it('startet mit vollem Vorrat und wirft, bis er leer ist', () => {
    let ammo = fullAmmo()
    for (let i = 0; i < MAX_AMMO; i++) ammo = take(ammo)!
    expect(ammo.balls).toBe(0)
    expect(take(ammo)).toBeNull()
  })

  it('formt durch Rollen neue Bälle – höchstens drei', () => {
    let ammo = { balls: 0, forming: 0 }
    ammo = roll(ammo, ROLL_DISTANCE / 2)
    expect(ammo).toEqual({ balls: 0, forming: 0.5 })
    ammo = roll(ammo, ROLL_DISTANCE / 2)
    expect(ammo.balls).toBe(1)
    ammo = roll(ammo, ROLL_DISTANCE * 10)
    expect(ammo).toEqual({ balls: MAX_AMMO, forming: 0 })
    expect(roll(ammo, -50)).toEqual(ammo)
  })

  it('merkt sich nur sinnvolle Treffer', () => {
    expect(restoreHits({ hits: 4 })).toBe(4)
    expect(restoreHits({ hits: 99 })).toBe(GOAL)
    expect(restoreHits({ hits: 'x' })).toBe(0)
    expect(restoreHits(undefined)).toBe(0)
  })

  it('verteilt die Hügel ohne Überschneidung', () => {
    for (const [i, a] of MOUNDS.entries()) {
      for (const b of MOUNDS.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.r + b.r)
    }
  })
})
