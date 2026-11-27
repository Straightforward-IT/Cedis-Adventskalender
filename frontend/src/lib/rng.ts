export interface Random {
  /** Gleichverteilte Zahl in [0, 1). */
  next(): number
  range(min: number, max: number): number
  /** Ganze Zahl in [min, max] (beide Grenzen eingeschlossen). */
  int(min: number, max: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
  weighted<T>(items: readonly (readonly [T, number])[]): T
}

/** Macht aus beliebigen Teilen einen stabilen 32-Bit-Startwert (FNV-1a). */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 2166136261
  for (const char of parts.join('|')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministischer Zufall (mulberry32) – gleiche Saat, gleiche Straße auf jedem Gerät. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const range = (min: number, max: number) => min + (max - min) * next()
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items) => {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0)
      let roll = next() * total
      for (const [item, weight] of items) {
        roll -= weight
        if (roll < 0) return item
      }
      return items[items.length - 1][0]
    },
  }
}
