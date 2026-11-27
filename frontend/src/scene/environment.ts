import * as THREE from 'three'
import { SKI_HOUSE_DAY } from '../lib/places.ts'
import { createRandom, hashSeed } from '../lib/rng.ts'
import type { Random } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import { GARAGE_AFTER_DAY } from './houseSpec.ts'
import type { StreetLayout } from './houseSpec.ts'
import { addGarage } from './garage.ts'
import { createGlowMaterial } from './materials.ts'
import type { TimeUniform } from './materials.ts'
import { BERRY, BULB_COLORS, GOLD, IRON, PINE, SNOW, WOOD, WOOD_DARK, col } from './palette.ts'
import { addBulb, addFir, addGift, addMound, addSnowman, decoGlow, haloOf } from './props.ts'
import type { Builders } from './props.ts'
import { createSignTexture } from './textures.ts'
import { PLAZA_RADIUS, ROAD_CENTER_Z, STREET_LANTERN_Z, TREE_HEIGHT, TREE_Z } from './world.ts'

/** Aufteilung der Straße in der Tiefe (z): Vorgarten, Gehweg, Fahrbahn, Zaun. */
const SIDEWALK_Z = 1.3
const KERB_Z = 3
const ROAD_WIDTH = 5
const FENCE_Z = 12.5
const ROAD_START_X = -14

const FLAT = { x: -Math.PI / 2 }
const LANTERN_LIGHT = '#ffc977'

function createBuilders(rnd: Random): Builders {
  return { solid: new Builder(), glow: new Builder(), halo: new Builder(), rnd }
}

function addGround(builders: Builders, layout: StreetLayout): void {
  const { solid, rnd } = builders
  const snow = col(SNOW)
  const road = col('#cdd4ea')
  const kerb = col('#bcc4dc')
  const roadEnd = layout.treeX
  const roadLength = roadEnd - ROAD_START_X
  const roadMiddle = (roadEnd + ROAD_START_X) / 2

  solid.quad(roadMiddle, 0, 15, roadLength + 500, 460, snow, FLAT)
  solid.quad(roadMiddle, 0.02, (SIDEWALK_Z + KERB_Z) / 2, roadLength, KERB_Z - SIDEWALK_Z, col('#e4e9f8'), FLAT)
  solid.quad(roadMiddle, 0.012, ROAD_CENTER_Z, roadLength, ROAD_WIDTH, road, FLAT)
  for (const z of [KERB_Z, KERB_Z + ROAD_WIDTH]) solid.box(roadMiddle, 0.04, z, roadLength, 0.1, 0.16, kerb)
  for (const z of [ROAD_CENTER_Z - 0.8, ROAD_CENTER_Z + 0.8]) {
    solid.quad(roadMiddle, 0.022, z, roadLength, 0.24, col('#bcc5df'), FLAT)
  }
  solid.disc(layout.treeX, 0.016, TREE_Z, PLAZA_RADIUS, road, { segments: 36, rotation: FLAT })

  // Zaun am Park gegenüber – er reicht bis an die Hecke neben dem Tor
  const fenceEnd = layout.gateX - 1.5
  const fenceLength = fenceEnd - ROAD_START_X
  const fenceMiddle = (fenceEnd + ROAD_START_X) / 2
  for (let x = ROAD_START_X; x <= fenceEnd; x += 2.4) {
    solid.box(x, 0.42, FENCE_Z, 0.13, 0.84, 0.13, col(WOOD))
    solid.sphere(x, 0.86, FENCE_Z, 0.13, 0.07, 0.13, snow)
  }
  for (const y of [0.3, 0.62]) solid.box(fenceMiddle, y, FENCE_Z, fenceLength, 0.06, 0.05, col(WOOD))
  solid.box(fenceMiddle, 0.665, FENCE_Z, fenceLength, 0.035, 0.07, snow)

  // Schneehaufen an den Straßenrändern und im Park
  for (let i = 0; i < 70; i++) {
    const x = rnd.range(ROAD_START_X, fenceEnd)
    const z = rnd.chance(0.4) ? rnd.range(KERB_Z + ROAD_WIDTH + 0.2, FENCE_Z - 0.3) : rnd.range(FENCE_Z + 0.6, FENCE_Z + 9)
    addMound(builders, x, z, rnd.range(0.6, 1.7), rnd.range(0.14, 0.4), rnd.range(0.4, 1))
  }
}

function addStreetLantern({ solid, glow, halo, rnd }: Builders, x: number, z: number): void {
  const iron = col(IRON)
  const warm = col(LANTERN_LIGHT)
  const light = decoGlow(rnd, 0.06)
  solid.cylinder(x, 0.12, z, 0.16, 0.12, 0.24, 8, iron)
  solid.cylinder(x, 1.6, z, 0.055, 0.045, 2.8, 6, iron)
  solid.cylinder(x, 3.02, z, 0.12, 0.2, 0.08, 6, iron)
  glow.cylinder(x, 3.3, z, 0.17, 0.22, 0.5, 6, [warm, col('#fff0c4')], undefined, light)
  solid.cylinder(x, 3.63, z, 0.3, 0.05, 0.2, 6, iron)
  solid.sphere(x, 3.8, z, 0.05, 0.06, 0.05, iron)

  halo.billboard(x, 3.3, z, 3.8, 3.8, haloOf(warm, 0.5), light)
  halo.quad(x, 0.06, z + 0.4, 7.5, 6.2, haloOf(warm, 0.3), FLAT, light)
}

function addLanterns(builders: Builders, layout: StreetLayout): void {
  const { plots } = layout
  addStreetLantern(builders, plots[0].x - plots[0].spec.width / 2 - 1.2, STREET_LANTERN_Z)
  for (let i = 1; i < plots.length - 1; i += 2) {
    const gapStart = plots[i].x + plots[i].spec.width / 2
    const gapEnd = plots[i + 1].x - plots[i + 1].spec.width / 2
    // Vor der Garageneinfahrt steht die Laterne am Rand, nicht mitten in der Einfahrt.
    const x = plots[i].spec.day === GARAGE_AFTER_DAY ? gapEnd - 0.35 : (gapStart + gapEnd) / 2
    addStreetLantern(builders, x, STREET_LANTERN_Z)
  }
  // Rund um den Platz – aber nicht direkt vor dem Baum
  for (const degrees of [20, 160, 200, 250, 290, 340]) {
    const angle = (degrees * Math.PI) / 180
    const radius = PLAZA_RADIUS - 1.6
    addStreetLantern(builders, layout.treeX + Math.cos(angle) * radius, TREE_Z + Math.sin(angle) * radius)
  }
}

/** Zwischen dem letzten Haus und dem Tor: eine Allee aus Laternen und geschmückten Tannen. */
function addAvenue(builders: Builders, layout: StreetLayout): void {
  const { rnd } = builders
  const lights = BULB_COLORS.warm.map(col)
  const farSide = KERB_Z + ROAD_WIDTH + 0.45
  const length = layout.gateX - layout.endX
  for (const share of [0.3, 0.66]) {
    const x = layout.endX + length * share
    addStreetLantern(builders, x, STREET_LANTERN_Z)
    addStreetLantern(builders, x, farSide)
  }
  for (const share of [0.13, 0.48, 0.83]) {
    const x = layout.endX + length * share
    addFir(builders, x, 0.9, rnd.range(2.6, 3.3), { lights, star: true })
    addFir(builders, x, farSide + 1.45, rnd.range(2.6, 3.3), { lights, star: true })
  }
}

function addHills({ solid, rnd }: Builders, layout: StreetLayout): void {
  const hill = col('#e1e7f8')
  const from = -90
  const to = layout.treeX + 90
  for (let x = from; x <= to; x += rnd.range(34, 48)) {
    solid.sphere(x, -3, rnd.range(-78, -58), rnd.range(34, 52), rnd.range(11, 19), 26, hill)
    solid.sphere(x + 15, -3, rnd.range(84, 100), rnd.range(34, 52), rnd.range(10, 16), 26, hill)
  }
  for (const [x, z] of [
    [from - 10, -10],
    [from - 4, 40],
    [to + 10, -8],
    [to + 4, 42],
  ]) {
    solid.sphere(x, -3, z, 30, rnd.range(12, 18), 46, hill)
  }
}

function addEntrance(builders: Builders, layout: StreetLayout): void {
  const { solid } = builders
  const x = layout.signX
  const z = 1.7
  for (const side of [-1, 1]) {
    solid.box(x + side * 2.25, 1.75, z - 0.17, 0.2, 3.5, 0.2, col(WOOD_DARK))
    solid.sphere(x + side * 2.25, 3.52, z - 0.17, 0.17, 0.09, 0.17, col(SNOW))
  }
  solid.box(x, 2.75, z - 0.05, 4.9, 1.34, 0.1, col(WOOD))
  solid.box(x, 3.47, z - 0.03, 4.96, 0.12, 0.2, col(SNOW))
  const bulbs = BULB_COLORS.multi.map(col)
  for (let i = 0; i < 15; i++) {
    addBulb(builders, x - 2.2 + i * 0.314, 2.02 - 0.5 * (i / 14) * (1 - i / 14), z + 0.05, bulbs[i % bulbs.length])
  }
  addSnowman(builders, x + 3.5, 2.1, col(BERRY), 1.2)
  addFir(builders, x - 3.6, 0.2, 3.4, { lights: bulbs, star: true })
}

/** Der große Weihnachtsbaum am Ende der Straße. Seine Lichter leuchten durch den Nebel. */
function addChristmasTree(ground: Builders, lights: Builders, layout: StreetLayout): void {
  const { solid, rnd } = ground
  const x = layout.treeX
  const z = TREE_Z
  solid.cylinder(x, 0.5, z, 0.48, 0.4, 1, 8, col(WOOD_DARK))

  const tiers = 5
  const tierHeight = 2.7
  const tierBase = (tier: number) => 0.9 + tier * 1.6
  const tierRadius = (tier: number) => 3.3 - tier * 0.58
  for (let tier = 0; tier < tiers; tier++) {
    solid.cone(x, tierBase(tier), z, tierRadius(tier), tierHeight, 12, col(PINE[tier % PINE.length]))
    solid.cone(x, tierBase(tier) + tierHeight * 0.45, z, tierRadius(tier) * 0.57, tierHeight * 0.57, 12, col(SNOW))
  }

  const colors = BULB_COLORS.multi.map(col)
  const count = 170
  for (let i = 0; i < count; i++) {
    // Unten mehr Lämpchen als oben – gleichmäßig über die Fläche des Kegels verteilt.
    const y = 1.2 + 8.3 * (1 - Math.sqrt(1 - (i + 0.5) / count))
    let surface = 0
    for (let tier = 0; tier < tiers; tier++) {
      const t = (y - tierBase(tier)) / tierHeight
      if (t >= 0 && t <= 1) surface = Math.max(surface, tierRadius(tier) * (1 - t))
    }
    const angle = i * 2.4
    const bx = x + Math.cos(angle) * (surface + 0.1)
    const bz = z + Math.sin(angle) * (surface + 0.1)
    const color = colors[i % colors.length]
    const light = decoGlow(rnd, 0.6)
    lights.glow.bulb(bx, y, bz, 0.12, color, light)
    lights.halo.billboard(bx, y, bz, 1, 1, haloOf(color, 0.32), light)
  }

  // Stern auf der Spitze, über Kreuz – damit er aus jeder Richtung leuchtet
  const top = TREE_HEIGHT + 0.35
  const gold = col(GOLD)
  const shine = decoGlow(rnd, 0.2)
  lights.glow.star(x, top, z, 0.62, 0.27, 5, gold, shine)
  const crossed = new THREE.Matrix4()
    .makeTranslation(x, top, z)
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
  lights.glow.within(crossed, () => lights.glow.star(0, 0, 0, 0.62, 0.27, 5, gold, shine))
  lights.halo.billboard(x, top, z, 5.5, 5.5, haloOf(gold, 0.4), shine)
  lights.halo.quad(x, 0.07, z + 1, 17, 15, haloOf(col('#ffcf8a'), 0.3), FLAT)

  // Geschenke unter dem Baum
  for (let i = 0; i < 8; i++) {
    const angle = 0.35 + (i / 7) * (Math.PI - 0.7)
    const radius = rnd.range(3.5, 4.4)
    const size = rnd.range(0.55, 0.95)
    addGift(ground, x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius, size, size * rnd.range(0.6, 1), size)
  }
}

/** Eine einzelne Tanne (Höhe 1) als Vorlage für den Wald. */
function createFirGeometry(rnd: Random): THREE.BufferGeometry {
  const builders = createBuilders(rnd)
  addFir(builders, 0, 0, 1)
  return builders.solid.batch.build('lit')
}

function createForest(layout: StreetLayout, material: THREE.Material, rnd: Random, halfpipeSite: THREE.Vector3) {
  const trees: { x: number; z: number; height: number; afterHouse?: number }[] = []
  const from = -52
  const to = layout.treeX + 52

  // Hinter den Häusern, in drei lockeren Reihen
  for (let x = from; x < to; x += rnd.range(1.7, 2.9)) {
    trees.push({ x, z: -6.4 - rnd.range(0, 3), height: rnd.range(4.6, 7.6) })
    if (rnd.chance(0.8)) trees.push({ x: x + rnd.range(-1, 1), z: -12 - rnd.range(0, 8), height: rnd.range(5.5, 9.5) })
    if (rnd.chance(0.6)) trees.push({ x: x + rnd.range(-1, 1), z: -23 - rnd.range(0, 16), height: rnd.range(6, 11) })
  }
  // In den Lücken zwischen den Häusern
  for (let i = 0; i < layout.plots.length - 1; i++) {
    const a = layout.plots[i]
    const b = layout.plots[i + 1]
    if (rnd.chance(0.65)) {
      const x = (a.x + a.spec.width / 2 + b.x - b.spec.width / 2) / 2
      const tree = { x, z: -2.6 - rnd.range(0, 1.2), height: rnd.range(3, 4.8), afterHouse: a.spec.day }
      // In der Garageneinfahrt wächst kein Baum – gezogen wird trotzdem, damit der Wald gleich bleibt.
      if (a.spec.day !== GARAGE_AFTER_DAY) trees.push(tree)
    }
  }
  // Am Anfang der Straße und hinter dem Platz schließt der Wald die Straße ab
  for (let i = 0; i < 80; i++) {
    trees.push({ x: rnd.range(from, -17), z: rnd.range(-6, 30), height: rnd.range(4.5, 9) })
    trees.push({
      x: layout.treeX + PLAZA_RADIUS + 2.5 + rnd.range(0, 38),
      z: rnd.range(-22, 30),
      height: rnd.range(4.5, 9.5),
    })
  }
  // Hinter dem Platz dichter, als Kulisse für den Baum
  for (let i = 0; i < 26; i++) {
    const angle = Math.PI + 0.25 + rnd.range(0, Math.PI - 0.5)
    const radius = PLAZA_RADIUS + 2 + rnd.range(0, 7)
    trees.push({
      x: layout.treeX + Math.cos(angle) * radius,
      z: TREE_Z + Math.sin(angle) * radius,
      height: rnd.range(4, 7.5),
    })
  }
  // Gegenüber, weit hinter dem Park
  for (let x = from; x < to; x += rnd.range(2.2, 3.6)) {
    trees.push({ x, z: 31 + rnd.range(0, 5), height: rnd.range(5, 9) })
    if (rnd.chance(0.7)) trees.push({ x: x + rnd.range(-1, 1), z: 40 + rnd.range(0, 16), height: rnd.range(6, 11) })
  }

  const forest = new THREE.InstancedMesh(createFirGeometry(rnd), material, trees.length)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const tint = new THREE.Color()
  const clearing = new Map<number, { original: THREE.Matrix4; open: THREE.Matrix4 }>()
  const belowGround = new THREE.Matrix4().makeTranslation(0, -200, 0)
  let visibleTrees = 0
  trees.forEach((tree) => {
    const girth = tree.height * rnd.range(0.85, 1.15)
    rotation.setFromAxisAngle(up, rnd.range(0, Math.PI * 2))
    matrix.compose(new THREE.Vector3(tree.x, 0, tree.z), rotation, new THREE.Vector3(girth, tree.height, girth))
    const shadeAmount = rnd.range(0.74, 1)
    // Den Baum direkt am linken Torpfeiler auslassen; die übrigen Bäume behalten ihre Zufallswerte.
    if (Math.abs(tree.x - layout.gateX) < 2 && tree.z > 0 && tree.z < ROAD_CENTER_Z - 1) return
    forest.setMatrixAt(visibleTrees, matrix)
    forest.setColorAt(visibleTrees, tint.setRGB(shadeAmount * 0.92, shadeAmount * 0.96, shadeAmount))
    if (tree.afterHouse === SKI_HOUSE_DAY) {
      clearing.set(visibleTrees, { original: matrix.clone(), open: belowGround })
    } else if (tree.afterHouse === undefined && Math.abs(tree.x - halfpipeSite.x) < 2.7 &&
      tree.z < halfpipeSite.z + 1.2 && tree.z > halfpipeSite.z - 3.1) {
      // Tannen rund um die Halfpipe (samt Plattformen) zurücksetzen, damit ihre Zweige Platz lassen.
      clearing.set(visibleTrees, { original: matrix.clone(), open: matrix.clone().setPosition(tree.x, 0, tree.z - 4.6) })
    }
    visibleTrees++
  })
  forest.count = visibleTrees
  forest.instanceMatrix.needsUpdate = true
  if (forest.instanceColor) forest.instanceColor.needsUpdate = true
  forest.computeBoundingSphere()
  let clearingOpen = false
  return {
    forest,
    setHalfpipeClearing(open: boolean) {
      if (clearingOpen === open) return
      clearingOpen = open
      for (const [index, tree] of clearing) forest.setMatrixAt(index, open ? tree.open : tree.original)
      forest.instanceMatrix.needsUpdate = true
    },
  }
}

export interface Environment {
  group: THREE.Group
  halfpipeSite: THREE.Vector3
  setHalfpipeClearing(open: boolean): void
  /** Beschriftungen neu zeichnen, sobald die Schrift geladen ist. */
  repaintText(): void
  dispose(): void
}

/** Alles außer Häusern und Tor: Boden, Straße, Laternen, Wald, Hügel, Schild und Weihnachtsbaum. */
export function createEnvironment(
  layout: StreetLayout,
  solidMaterial: THREE.Material,
  time: TimeUniform,
  seed: number,
): Environment {
  const rnd = createRandom(hashSeed(seed, 'umgebung'))
  const ground = createBuilders(rnd)
  const treeLights = createBuilders(rnd)

  addGround(ground, layout)
  addHills(ground, layout)
  addLanterns(ground, layout)
  addAvenue(ground, layout)
  addEntrance(ground, layout)
  addGarage(ground, layout.garage.x)
  addChristmasTree(ground, treeLights, layout)

  const glowMaterial = createGlowMaterial(time)
  const haloMaterial = createGlowMaterial(time, { halo: true })
  const treeGlowMaterial = createGlowMaterial(time, { fogAmount: 0.3 })
  const treeHaloMaterial = createGlowMaterial(time, { halo: true, fogAmount: 0.45 })
  const sign = createSignTexture('Weihnachtsstraße')
  const signMaterial = new THREE.MeshBasicMaterial({ map: sign.texture, alphaTest: 0.5, color: '#e9e4f2' })

  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.175), signMaterial)
  signBoard.position.set(layout.signX, 2.75, 1.71)
  const home = layout.plots[SKI_HOUSE_DAY - 1]
  const neighbor = layout.plots[SKI_HOUSE_DAY]
  const gapX = (home.x + home.spec.width / 2 + neighbor.x - neighbor.spec.width / 2) / 2
  // Weiter hinten, damit Halfpipe und Plattformen durch die Lücke zwischen den Häusern ganz zu sehen sind.
  const halfpipeSite = new THREE.Vector3(gapX, 0.02, -Math.max(home.spec.depth, neighbor.spec.depth) - 3.7)
  const { forest, setHalfpipeClearing } = createForest(layout, solidMaterial, rnd, halfpipeSite)

  const meshes: THREE.Mesh[] = [
    new THREE.Mesh(ground.solid.batch.build('lit'), solidMaterial),
    new THREE.Mesh(ground.glow.batch.build('glow'), glowMaterial),
    new THREE.Mesh(ground.halo.batch.build('glow'), haloMaterial),
    new THREE.Mesh(treeLights.glow.batch.build('glow'), treeGlowMaterial),
    new THREE.Mesh(treeLights.halo.batch.build('glow'), treeHaloMaterial),
    forest,
    signBoard,
  ]
  const group = new THREE.Group()
  // Die Umgebung umspannt die ganze Straße und ist praktisch immer im Bild.
  for (const mesh of meshes) mesh.frustumCulled = false
  group.add(...meshes)

  return {
    group,
    halfpipeSite,
    setHalfpipeClearing,
    repaintText: sign.repaint,
    dispose() {
      forest.dispose()
      for (const mesh of meshes) mesh.geometry.dispose()
      for (const material of [glowMaterial, haloMaterial, treeGlowMaterial, treeHaloMaterial, signMaterial]) {
        material.dispose()
      }
      sign.texture.dispose()
    },
  }
}
