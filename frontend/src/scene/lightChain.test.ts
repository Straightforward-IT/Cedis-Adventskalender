import { describe, expect, it } from 'vitest'
import { buildHouse } from './houseBuilder.ts'
import { generateStreet } from './houseSpec.ts'
import { buildLightChain, festoon, upperHull } from './lightChain.ts'

describe('Lichterkette an Haus 3', () => {
  it('hängt an den äußeren Ecken einer gestuften Kante', () => {
    const stepped = [[-3, 5], [-3, 6], [-2, 6], [-2, 7], [2, 7], [2, 6], [3, 6], [3, 5]] as const
    expect(upperHull(stepped)).toEqual([[-3, 6], [-2, 7], [2, 7], [3, 6]])
  })

  it('hängt zwischen den Aufhängern durch und bleibt unter der Kante', () => {
    const { anchors, curve } = festoon([[-2, 5], [0, 7], [2, 5]])
    expect(anchors[0]).toEqual([-2, 5])
    expect(anchors.at(-1)).toEqual([2, 5])
    for (const [x, y] of curve) expect(y).toBeLessThanOrEqual(7 - Math.abs(x) + 1e-9)
  })

  it('passt an die Dachkante von Haus 3', () => {
    const house = buildHouse(generateStreet()[2])
    expect(house.anchors.eaves.points.length).toBeGreaterThanOrEqual(2)
    const chain = buildLightChain(house.anchors.eaves, ['#ff0000', '#00ff00'])
    expect(chain.glow.getAttribute('position').count).toBeGreaterThan(0)
  })
})
