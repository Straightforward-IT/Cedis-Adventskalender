import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import type { Glow, Point } from './batch.ts'
import { BERRY, BULB_COLORS, GOLD, PINE, SNOW, STONE, col } from './palette.ts'
import { addBulb, addWreath, decoGlow, haloOf } from './props.ts'
import type { Builders } from './props.ts'

/*
 * Das Tor zum Weihnachtsbaum (Tag 24). Es wird wie eine Hausfassade gebaut –
 * die Breite entlang x, die Vorderseite zeigt nach +z – und von der Szene quer
 * über die Straße gedreht.
 *
 * Zwei Dinge bestimmen seine Form: Es soll schon vom Anfang der Straße zu
 * sehen sein (darum der Lichterbogen, der auch vor dem 24. leuchtet), und es
 * darf den Blick auf den Baum nicht verstellen (darum bleibt die Mitte frei:
 * flacher Bogen, Gitterflügel, Kranz und Hausnummer an den Pfeilern).
 */

/** Halbe lichte Breite zwischen den Pfeilern. */
const OPENING = 2.2
const PILLAR_WIDTH = 1.1
const PILLAR_HEIGHT = 3.5
const PILLAR_X = OPENING + PILLAR_WIDTH / 2
const WING_WIDTH = OPENING - 0.06
/** Höhe, in der die Kränze an den Pfeilern hängen. */
const WREATH_Y = 2.35

const ARCH_HALF_SPAN = OPENING + 0.25
const ARCH_RISE = 1.4
const ARCH_THICKNESS = 0.26
const ARCH_SNOW = 0.12

const HEDGE_HEIGHT = 1.5
const IRON_GREEN = '#2e4a43'
const PILLAR_STONE = '#efe3cf'
const LANTERN_LIGHT = '#ffd27a'
const FLAT = { x: -Math.PI / 2 }
/** Licht, das erst angeht, wenn das Tor „wach“ ist – also am 24. */
const AWAKE: Glow = { phase: 0, twinkle: 0, interior: 1 }

/** Breite, die das Tor samt Pfeilern einnimmt. */
export const GATE_WIDTH = 2 * (OPENING + PILLAR_WIDTH)
/** Höchster Punkt: der verschneite Scheitel des Bogens. */
export const GATE_HEIGHT = PILLAR_HEIGHT + ARCH_RISE + ARCH_THICKNESS / 2 + ARCH_SNOW
/**
 * Ausschnitt beim Anflug auf das Tor: breit genug für beide Pfeiler und so
 * hoch, dass über dem Bogen noch der Stern des Weihnachtsbaums ins Bild passt.
 */
export const GATE_FOCUS = { width: GATE_WIDTH + 1.2, height: 11 }

export interface GateWing {
  /** Flügel relativ zu seinem Scharnier. */
  geometry: THREE.BufferGeometry
  hinge: THREE.Vector3
  /** Drehung um die Hochachse, wenn der Flügel ganz offen steht. */
  swing: number
}

export interface GateGeometry {
  solid: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  halo: THREE.BufferGeometry
  wings: GateWing[]
  /** Mitte des Kranzes am linken Pfeiler, in dem das Selfie erscheint. */
  photo: { x: number; y: number; z: number }
  /** Die „24“ sitzt symmetrisch in den Kränzen beider Pfeiler. */
  plaques: { x: number; y: number; z: number; radius: number }[]
}

function addPillarLantern({ solid, glow, halo, rnd }: Builders, x: number, y: number): void {
  const iron = col(IRON_GREEN)
  const warm = col(LANTERN_LIGHT)
  const light = decoGlow(rnd, 0.1)
  solid.box(x, y + 0.04, 0, 0.42, 0.08, 0.42, iron)
  glow.box(x, y + 0.36, 0, 0.3, 0.52, 0.3, warm, undefined, light)
  for (const dx of [-0.17, 0.17]) {
    for (const dz of [-0.17, 0.17]) solid.box(x + dx, y + 0.36, dz, 0.04, 0.56, 0.04, iron)
  }
  solid.pyramid(x, y + 0.64, 0, 0.58, 0.26, 0.58, iron)
  solid.sphere(x, y + 0.87, 0, 0.2, 0.08, 0.2, col(SNOW))
  halo.billboard(x, y + 0.36, 0, 3.6, 3.6, haloOf(warm, 0.5), light)
}

/** Pfeiler, verpackt wie Geschenke: Band rundherum, Schnee und eine Laterne obenauf. */
function addPillars(builders: Builders): void {
  const { solid } = builders
  const ribbon = col(BERRY)
  for (const side of [-1, 1]) {
    const x = side * PILLAR_X
    solid.box(x, 0.2, 0, PILLAR_WIDTH + 0.16, 0.4, PILLAR_WIDTH + 0.16, col(STONE))
    solid.box(x, PILLAR_HEIGHT / 2, 0, PILLAR_WIDTH, PILLAR_HEIGHT, PILLAR_WIDTH, col(PILLAR_STONE))
    solid.box(x, PILLAR_HEIGHT / 2 + 0.2, 0, 0.24, PILLAR_HEIGHT - 0.4, PILLAR_WIDTH + 0.03, ribbon)
    solid.box(x, PILLAR_HEIGHT / 2 + 0.2, 0, PILLAR_WIDTH + 0.03, PILLAR_HEIGHT - 0.4, 0.24, ribbon)
    solid.box(x, PILLAR_HEIGHT + 0.08, 0, PILLAR_WIDTH + 0.24, 0.16, PILLAR_WIDTH + 0.24, col(STONE))
    solid.box(x, PILLAR_HEIGHT + 0.22, 0, PILLAR_WIDTH + 0.14, 0.14, PILLAR_WIDTH + 0.14, col(SNOW))
    // Die Laterne sitzt außen auf dem Pfeiler – innen setzt der Bogen an.
    addPillarLantern(builders, x + side * 0.2, PILLAR_HEIGHT + 0.29)
  }
}

/** Flacher Bogen mit Tannengirlande, Schnee und einer Lichterkette, die weithin leuchtet. */
function addArch(builders: Builders): void {
  const { solid, halo } = builders
  const radius = (ARCH_HALF_SPAN ** 2 + ARCH_RISE ** 2) / (2 * ARCH_RISE)
  const centerY = PILLAR_HEIGHT + ARCH_RISE - radius
  const halfAngle = Math.asin(ARCH_HALF_SPAN / radius)
  /** Punkt auf dem Bogen: t = 0 am linken Pfeiler, 1 am rechten. */
  const at = (t: number, offset = 0): Point => {
    const angle = halfAngle * (2 * t - 1)
    return [Math.sin(angle) * (radius + offset), centerY + Math.cos(angle) * (radius + offset)]
  }

  const segments = 16
  for (let i = 0; i < segments; i++) {
    const from = at(i / segments)
    const to = at((i + 1) / segments)
    solid.slab(from, to, ARCH_THICKNESS, 0.17, -0.17, col(IRON_GREEN), -ARCH_THICKNESS / 2)
    // Schnee bleibt nur dort liegen, wo der Bogen flach genug ist.
    const steepness = Math.abs(halfAngle * (2 * ((i + 0.5) / segments) - 1))
    if (steepness < 0.8) solid.slab(from, to, ARCH_SNOW, 0.2, -0.2, col(SNOW), ARCH_THICKNESS / 2)
  }

  const lights = BULB_COLORS.gold.map(col)
  const tufts = 22
  for (let i = 0; i <= tufts; i++) {
    const [x, y] = at(i / tufts, -0.02)
    solid.sphere(x, y, 0.2, 0.15, 0.15, 0.11, col(PINE[i % PINE.length]))
    if (i % 2 === 1) addBulb(builders, x, y, 0.34, lights[i % lights.length], 0.085)
  }
  // Aus der Ferne verschmelzen diese Lichthöfe zu einem leuchtenden Bogen.
  const shine = haloOf(col(LANTERN_LIGHT), 0.3)
  for (let i = 0; i <= 8; i++) {
    const [x, y] = at(i / 8)
    halo.billboard(x, y, 0.2, 2.6, 2.6, shine)
  }
  for (const side of [-1, 1]) {
    const [x, y] = at(side < 0 ? 0 : 1)
    solid.box(x - 0.12, y + 0.06, 0.3, 0.26, 0.14, 0.05, col(BERRY), { z: -0.45 })
    solid.box(x + 0.12, y + 0.06, 0.3, 0.26, 0.14, 0.05, col(BERRY), { z: 0.45 })
  }
}

/** Verschneite Hecken mit Lichterkette – sie schließen an die Pfeiler an und reichen bis in den Wald. */
function addHedges(builders: Builders): void {
  const { solid, rnd } = builders
  const lights = BULB_COLORS.multi.map(col)
  const inner = PILLAR_X + PILLAR_WIDTH / 2
  for (const [side, outer] of [
    [-1, 13.5],
    [1, 26],
  ]) {
    let index = 0
    for (let from = inner; from < outer; ) {
      const length = Math.min(rnd.range(1.8, 2.8), outer - from)
      const height = HEDGE_HEIGHT + rnd.range(-0.12, 0.1)
      const middle = side * (from + length / 2)
      solid.box(middle, height / 2, 0, length + 0.02, height, 0.9, col(PINE[index % PINE.length]))
      solid.box(middle, height + 0.07, 0, length + 0.06, 0.14, 0.98, col(SNOW))
      solid.sphere(middle, height + 0.12, 0, length * rnd.range(0.2, 0.34), 0.15, 0.4, col(SNOW))
      from += length
      index += 1
    }
    index = 0
    for (let x = inner + 0.35; x < outer - 0.2; x += 0.55) {
      const sag = 0.08 * Math.sin(index * 1.3)
      addBulb(builders, side * x, HEDGE_HEIGHT - 0.3 + sag, 0.5, lights[index++ % lights.length], 0.07)
    }
  }
}

/**
 * Torflügel aus Gitterstäben – durch sie hindurch sieht man schon den Platz mit dem Baum.
 * `side` −1 ist der linke Flügel (hängt am linken Pfeiler), 1 der rechte.
 */
function buildWing(side: number): GateWing {
  const wing = new Builder()
  const iron = col(IRON_GREEN)
  const gold = col(GOLD)
  /** Vom Scharnier zur Tormitte. */
  const inward = -side
  const bars = 8
  for (let i = 0; i <= bars; i++) {
    const t = i / bars
    const x = inward * (0.05 + t * (WING_WIDTH - 0.1))
    // Zur Mitte hin werden die Stäbe länger – die klassische geschwungene Torkante.
    const height = 2.5 + 0.45 * t * t
    wing.box(x, 0.1 + height / 2, 0, 0.07, height, 0.07, iron)
    wing.sphere(x, 0.1 + height + 0.07, 0, 0.07, 0.11, 0.07, gold)
  }
  for (const y of [0.3, 1.45, 2.4]) {
    wing.box((inward * WING_WIDTH) / 2, y, 0, WING_WIDTH, 0.09, 0.09, iron)
  }
  // Schleife in der Mitte jedes Flügels
  const bowX = (inward * WING_WIDTH) / 2
  for (const lean of [-1, 1]) {
    wing.box(bowX + lean * 0.17, 1.47, 0.08, 0.34, 0.18, 0.05, col(BERRY), { z: lean * -0.4 })
    wing.box(bowX + lean * 0.09, 1.2, 0.07, 0.1, 0.36, 0.04, col(BERRY), { z: lean * 0.22 })
  }
  wing.box(bowX, 1.45, 0.1, 0.13, 0.13, 0.06, col('#a13a30'))

  return {
    geometry: wing.batch.build('lit'),
    hinge: new THREE.Vector3(side * (OPENING - 0.03), 0, 0),
    // Beide Flügel schwingen nach hinten auf – weg vom Besucher, hin zum Baum.
    swing: -side * 1.75,
  }
}

/** Baut das Tor samt Hecken; die Flügel kommen einzeln, damit sie aufschwingen können. */
export function buildGate(seed: number): GateGeometry {
  const builders: Builders = {
    solid: new Builder(),
    glow: new Builder(),
    halo: new Builder(),
    rnd: createRandom(hashSeed(seed, 'tor')),
  }

  addPillars(builders)
  addArch(builders)
  addHedges(builders)
  // Links der Kranz für das Selfie, rechts einer mit der Hausnummer – die Mitte bleibt frei für den Baum.
  const front = PILLAR_WIDTH / 2
  const photo = addWreath(builders, -PILLAR_X, WREATH_Y, front)
  const number = addWreath(builders, PILLAR_X, WREATH_Y, front)

  const warm = col('#ffcf8a')
  builders.halo.quad(0, 0.06, 2.2, 8, 6, haloOf(warm, 0.14), FLAT)
  // Am 24. erwacht das Tor: Ein warmer Schein legt sich um Bogen und Schwelle.
  builders.halo.quad(0, 0.07, 2.6, 9.5, 8.5, haloOf(warm, 0.24), FLAT, AWAKE)
  builders.halo.billboard(0, 2.9, 0, 12, 9.5, haloOf(warm, 0.13), AWAKE)

  return {
    solid: builders.solid.batch.build('lit'),
    glow: builders.glow.batch.build('glow'),
    halo: builders.halo.batch.build('glow'),
    wings: [buildWing(-1), buildWing(1)],
    photo,
    plaques: [
      { ...number, radius: 0.45 },
      { ...number, x: -number.x, radius: 0.45 },
    ],
  }
}
