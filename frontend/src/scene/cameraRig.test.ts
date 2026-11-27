import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  approachThroughGap,
  computePose,
  createPose,
  endTurn,
  frontDistance,
  gateDistance,
  gateStopX,
  maxPanX,
  visibleWidth,
} from './cameraRig.ts'
import type { Entrance, Pose, RigInput, StreetEnd } from './cameraRig.ts'
import { GATE_HEIGHT } from './gate.ts'
import { createStreetLayout } from './houseSpec.ts'
import { ROAD_CENTER_Z, STREET_LANTERN_Z, TREE_HEIGHT, TREE_Z } from './world.ts'

const PORTRAIT = 390 / 844
const LANDSCAPE = 16 / 9

const layout = createStreetLayout()
const END: StreetEnd = {
  lastHouseX: layout.plots[layout.plots.length - 1].x,
  gateX: layout.gateX,
  treeX: layout.treeX,
}

const door = (x: number): Entrance => ({
  center: new THREE.Vector3(x, 0, 0),
  normal: new THREE.Vector3(0, 0, 1),
  width: 3.6,
  height: 5.8,
})

const gate: Entrance = {
  center: new THREE.Vector3(END.gateX, 0, ROAD_CENTER_Z),
  normal: new THREE.Vector3(-1, 0, 0),
  width: 8,
  height: 11,
  through: true,
}

const pose = (input: Partial<RigInput>) =>
  computePose(
    { x: 50, turn: 0, focus: 0, enter: 0, entrance: door(50), aspect: PORTRAIT, end: END, ...input },
    createPose(),
  )

/** Winkel, unter dem die Kamera einen Punkt über dem Horizont sieht. */
function elevation(from: Pose, x: number, y: number, z: number): number {
  const across = Math.hypot(x - from.position.x, z - from.position.z)
  return Math.atan2(y - from.position.y, across)
}

describe('Blick von vorn', () => {
  it('zeigt im Hochformat rund anderthalb Häuser, im Querformat mehrere', () => {
    expect(visibleWidth(PORTRAIT)).toBeCloseTo(7.4)
    expect(visibleWidth(LANDSCAPE)).toBeGreaterThan(20)
  })

  it('steht genau vor der Stelle der Straße und schaut leicht von oben auf die Fassaden', () => {
    const { position, target } = pose({ x: 37 })
    expect(position.x).toBe(37)
    expect(target.x).toBe(37)
    expect(target.z).toBe(0)
    expect(position.z).toBeCloseTo(frontDistance(PORTRAIT))
    expect(position.y).toBeGreaterThan(target.y)
  })
})

describe('Blick die Straße entlang', () => {
  it('stellt die Kamera auf die Fahrbahn und richtet sie zum Weihnachtsbaum', () => {
    const { position, target } = pose({ turn: 1 })
    expect(position.z).toBeGreaterThan(3)
    expect(position.z).toBeLessThan(8)
    expect(position.y).toBeLessThan(3)
    expect(target.x - position.x).toBeGreaterThan(30)
  })

  it('schaut in der anderen Richtung zum Anfang der Straße', () => {
    const { position, target } = pose({ turn: -1 })
    expect(target.x).toBeLessThan(position.x)
  })

  it('dreht sich stetig – ohne Sprung beim Wechsel der Blickrichtung', () => {
    const left = pose({ turn: -0.001 })
    const right = pose({ turn: 0.001 })
    expect(left.position.distanceTo(right.position)).toBeLessThan(0.01)
    expect(left.target.distanceTo(right.target)).toBeLessThan(0.01)
  })
})

describe('Das Tor am Ende der Straße', () => {
  it('ist deutlich niedriger als der Weihnachtsbaum', () => {
    expect(GATE_HEIGHT).toBeLessThan(TREE_HEIGHT * 0.6)
  })

  it('lässt den Baum über sich sehen – vom Anfang der Straße und direkt davor', () => {
    for (const aspect of [PORTRAIT, LANDSCAPE]) {
      for (const view of [
        pose({ x: layout.plots[0].x, turn: 1, aspect }),
        pose({ x: gateStopX(aspect, END), aspect }),
      ]) {
        const gateTop = elevation(view, END.gateX, GATE_HEIGHT, ROAD_CENTER_Z)
        const treeTop = elevation(view, END.treeX, TREE_HEIGHT, TREE_Z)
        expect(treeTop).toBeGreaterThan(gateTop)
      }
    }
  })

  it('dreht die Kamera hinter dem letzten Haus von selbst zum Tor', () => {
    expect(endTurn(END.lastHouseX, PORTRAIT, END)).toBe(0)
    expect(endTurn(gateStopX(PORTRAIT, END), PORTRAIT, END)).toBe(1)
    const { position, target } = pose({ x: gateStopX(PORTRAIT, END) })
    expect(position.x).toBeCloseTo(END.gateX - gateDistance(PORTRAIT), 1)
    expect(position.z).toBeCloseTo(ROAD_CENTER_Z, 1)
    expect(target.x).toBeGreaterThan(END.gateX)
  })

  it('hält die Kamera vor dem geschlossenen Tor auf und lässt sie durchs offene bis zum Baum', () => {
    expect(maxPanX(PORTRAIT, END, false)).toBe(gateStopX(PORTRAIT, END))
    expect(maxPanX(PORTRAIT, END, false)).toBeLessThan(END.gateX)
    expect(maxPanX(PORTRAIT, END, true)).toBeGreaterThan(END.gateX)
    expect(maxPanX(PORTRAIT, END, true)).toBeLessThan(END.treeX)
  })

  it('bleibt beim Anflug auf der Achse des Tors, damit der Baum in der Öffnung steht', () => {
    const { position, target } = pose({ focus: 1, entrance: gate, aspect: LANDSCAPE })
    expect(position.z).toBeCloseTo(ROAD_CENTER_Z)
    expect(position.x).toBeLessThan(END.gateX)
    expect(target.x).toBeCloseTo(END.gateX)
  })
})

describe('Anflug auf die Haustür', () => {
  it('rückt nah an die Tür und lässt im Hochformat unten Platz für die Karte', () => {
    const { position, target } = pose({ focus: 1, entrance: door(52.3) })
    expect(position.x).toBeCloseTo(52.3)
    expect(position.z).toBeLessThan(frontDistance(PORTRAIT) / 2 + 1)
    // Die Türschwelle (y = 0) liegt unterhalb der Bildmitte, aber nicht am Rand.
    expect(target.y).toBeGreaterThan(0)
    expect(target.y).toBeLessThan(1.5)
  })

  it('rückt die Tür im Querformat nach links – rechts steht die Karte', () => {
    const { position } = pose({ focus: 1, entrance: door(52.3), aspect: LANDSCAPE })
    expect(position.x).toBeGreaterThan(52.3 + 1)
  })

  it('fährt beim Eintreten durch die Türöffnung', () => {
    const { position, target } = pose({ focus: 1, enter: 1, entrance: door(52.3) })
    expect(position.x).toBeCloseTo(52.3)
    expect(position.z).toBeLessThan(2)
    expect(position.y).toBeGreaterThan(0.8)
    expect(position.y).toBeLessThan(2)
    expect(target.z).toBeLessThan(0)
  })
})

describe('Blick durch die Häuserlücke', () => {
  it('fährt ohne Laterne vor der Lücke ohne Schlenker auf die Lückenmitte zu', () => {
    const gap = createPose()
    gap.position.set(53.39, 1.5, -1.7)
    gap.target.set(53.07, 1.2, -4.4)
    for (const startX of [49.3, 56.1]) {
      let previous = startX
      for (let i = 1; i <= 40; i++) {
        const view = createPose()
        view.position.set(startX, 5.5, ROAD_CENTER_Z)
        view.target.set(startX, 4.5, 0)
        approachThroughGap(view, gap, i / 40, false)
        // Immer nur in eine Richtung zur Lücke hin – nie darüber hinaus und zurück.
        expect(Math.sign(view.position.x - previous) * Math.sign(gap.position.x - startX)).toBeGreaterThanOrEqual(0)
        expect(Math.abs(view.position.x - gap.position.x)).toBeLessThanOrEqual(Math.abs(startX - gap.position.x) + 1e-9)
        previous = view.position.x
      }
    }
  })

  it('fährt von beiden Seiten an der Laterne vorbei und erreicht die Lücke mittig auf Augenhöhe', () => {
    const gap = createPose()
    gap.position.set(47.035, 1.59, -3.08)
    gap.target.set(47.035, 1.08, -6.62)
    for (const startX of [44, gap.position.x, 50.24]) {
      for (const startZ of [ROAD_CENTER_Z, frontDistance(LANDSCAPE)]) {
        const atZ = (z: number) => {
          const view = createPose()
          view.position.set(startX, 5.5, startZ)
          view.target.set(startX + 24, 4.5, 0)
          approachThroughGap(view, gap, (startZ - z) / (startZ - gap.position.z))
          return view
        }
        expect(Math.abs(atZ(STREET_LANTERN_Z).position.x - gap.position.x)).toBeGreaterThan(0.63)
        // Schon vor den Fassaden mittig und geradeaus in die Lücke – nicht schräg auf eine Wand zu.
        for (const z of [1.2, 0.6, 0]) {
          const view = atZ(z)
          expect(view.position.x).toBeCloseTo(gap.position.x)
          expect(Math.abs(view.target.x - view.position.x)).toBeLessThan(0.05)
        }
        expect(atZ(0).position.y).toBeCloseTo(gap.position.y)
        expect(atZ(gap.position.z).position.distanceTo(gap.position)).toBeCloseTo(0)
      }
    }
  })
})
