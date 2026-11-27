import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoopShot } from './hoopShot.ts'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
}

function throwOnce(shot: HoopShot) {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 4, 14)
  camera.lookAt(0, 2, 0)
  camera.updateMatrixWorld()
  expect(shot.shoot(camera)).toBe(true)
  for (let i = 0; i < 600; i++) shot.update(1 / 60)
}

describe('Easter Egg: Kugel durch den Korb', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('Scherben bleiben liegen – auch nach dem Neuladen an denselben Stellen', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const first = new HoopShot(10)
    expect(first.group.children).toHaveLength(1)
    throwOnce(first)
    throwOnce(first)
    const pile = first.group.children[0] as THREE.InstancedMesh
    expect(pile.count).toBe(32)
    // Alle Scherben liegen ruhig auf dem Boden, keine fliegt mehr herum.
    expect(first.group.children).toHaveLength(1)
    const before = new THREE.Matrix4()
    pile.getMatrixAt(17, before)

    const again = new HoopShot(10)
    const restored = again.group.children[0] as THREE.InstancedMesh
    expect(restored.count).toBe(32)
    const after = new THREE.Matrix4()
    restored.getMatrixAt(17, after)
    expect(after.equals(before)).toBe(true)
    const position = new THREE.Vector3().setFromMatrixPosition(after)
    expect(position.y).toBeCloseTo(0.025)
  })

  it('wirft nur eine Kugel zugleich', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const shot = new HoopShot(0)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 4, 14)
    camera.updateMatrixWorld()
    expect(shot.shoot(camera)).toBe(true)
    expect(shot.shoot(camera)).toBe(false)
  })
})
