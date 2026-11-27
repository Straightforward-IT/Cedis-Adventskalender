import { describe, expect, it } from 'vitest'
import { emptyProgress, loadProgress, saveProgress } from './storage.ts'
import type { Progress } from './storage.ts'

/** Minimaler Ersatz für localStorage. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

const KEY = 'weihnachtsstrasse:v1'

describe('Fortschritt speichern', () => {
  it('übersteht Speichern und Laden unverändert', () => {
    const storage = fakeStorage()
    const progress: Progress = {
      keys: { 3: 'ABCDEFGHJK', 12: 'GX3MP45A2Q' },
      completed: { 3: '2026-12-03T18:00:00.000Z' },
      games: { 3: { moves: 7, solved: [1, 2] } },
      hintSeen: true,
      squirrels: 5,
    }
    saveProgress(progress, storage)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('beginnt leer, wenn nichts oder Unlesbares gespeichert ist', () => {
    expect(loadProgress(fakeStorage())).toEqual(emptyProgress())
    expect(loadProgress(fakeStorage({ [KEY]: '{kaputt' }))).toEqual(emptyProgress())
    expect(loadProgress(fakeStorage({ [KEY]: 'null' }))).toEqual(emptyProgress())
    expect(loadProgress(null)).toEqual(emptyProgress())
  })

  it('übernimmt nur gültige Tage und Schlüssel', () => {
    const stored = JSON.stringify({
      keys: { 0: 'X', 5: 'WZ861Q6B7G', 25: 'Y', 7: 42, abc: 'Z' },
      completed: { 5: '2026-12-05T10:00:00.000Z', 6: null },
      hintSeen: 'ja',
      squirrels: -3,
    })
    expect(loadProgress(fakeStorage({ [KEY]: stored }))).toEqual({
      keys: { 5: 'WZ861Q6B7G' },
      completed: { 5: '2026-12-05T10:00:00.000Z' },
      games: {},
      hintSeen: false,
      squirrels: 0,
    })
  })

  it('wirft nicht, wenn der Speicher voll oder gesperrt ist', () => {
    const storage = fakeStorage()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() => saveProgress(emptyProgress(), storage)).not.toThrow()
  })
})
