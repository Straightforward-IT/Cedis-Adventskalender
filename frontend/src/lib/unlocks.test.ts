import { describe, expect, it } from 'vitest'
import { unlockFor } from './unlocks.ts'

describe('Freigeschaltetes je Haus', () => {
  it('jedes Haus mit Easter Egg sagt, was dazugekommen ist', () => {
    for (let day = 1; day <= 16; day++) {
      const unlock = unlockFor(day)
      expect(unlock, `Haus ${day}`).not.toBeNull()
      expect(unlock!.text.length).toBeGreaterThan(20)
    }
  })

  it('Häuser ohne Easter Egg zeigen nichts an', () => {
    expect(unlockFor(17)).toBeNull()
    expect(unlockFor(24)).toBeNull()
  })
})
