import * as THREE from 'three'
import { createRandom } from '../../../lib/rng.ts'
import { Builder } from '../../../scene/batch.ts'
import { buildHouse } from '../../../scene/houseBuilder.ts'
import { createStreetLayout, ridgeHeight } from '../../../scene/houseSpec.ts'
import type { Plot } from '../../../scene/houseSpec.ts'
import { createGlowMaterial, createSolidMaterial } from '../../../scene/materials.ts'
import type { TimeUniform } from '../../../scene/materials.ts'
import { SKY, SNOW, WOOD, WOOD_DARK, col } from '../../../scene/palette.ts'
import { addBulb, addCandyCane, addFir, addGroundLantern, addMound } from '../../../scene/props.ts'
import type { Builders } from '../../../scene/props.ts'
import { createNumberAtlas, createSignTexture } from '../../../scene/textures.ts'
import { ROAD_CENTER_Z } from '../../../scene/world.ts'
import {
  BARRIERS, CHECKPOINTS, COURSE, FINISH, FINISH_RUNOUT, GRADE, LANE_WIDTH, RAMP_LENGTH,
  TRACK_HALF_WIDTH, laneX, rampRise, slopeHeight,
} from './model.ts'
import type { BarrierHeight } from './model.ts'

const FLAT = { x: -Math.PI / 2 }
const SLOPE = { x: FLAT.x - Math.atan(GRADE) }
const snow = col(SNOW)
const bank = col('#d8e5f5')
const packed = col('#c7dbea')
const navy = col('#254258')
const ice = col('#5bafbb')
const gold = col('#ffce78')
const red = col('#cb3145')
const cream = col('#fff2dd')

function buildVillage(scene: THREE.Scene, plots: readonly Plot[], day: number, startZ: number, builders: Builders, materials: {
  solid: THREE.Material; glow: THREE.Material; halo: THREE.Material;
}): void {
  const home = plots[day - 1]
  const { solid: b } = builders
  const atlas = createNumberAtlas()
  const plaqueMaterial = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.5, color: '#efe9f3' })
  for (const plot of plots.slice(Math.max(0, day - 5), day + 4)) {
    const house = buildHouse(plot.spec)
    const group = new THREE.Group()
    group.position.x = plot.x - home.x
    const door = new THREE.Mesh(house.door, materials.solid)
    door.position.copy(house.anchors.hinge)
    group.add(new THREE.Mesh(house.solid, materials.solid), new THREE.Mesh(house.glow, materials.glow),
      new THREE.Mesh(house.halo, materials.halo), door)
    if (house.doorGlow) {
      const glow = new THREE.Mesh(house.doorGlow, materials.glow)
      glow.position.copy(door.position)
      group.add(glow)
    }
    // Advent wreath flame geometry is only needed by the interactive street.
    for (const candle of house.candles ?? []) {
      candle.glow.dispose()
      candle.halo.dispose()
    }

    const { x, y, z, radius } = house.anchors.plaque
    const sign = new THREE.PlaneGeometry(radius * 2, radius * 2)
    const [u0, v0, u1, v1] = atlas.cell(plot.spec.day)
    const uv = sign.getAttribute('uv')
    uv.setXY(0, u0, v1).setXY(1, u1, v1).setXY(2, u0, v0).setXY(3, u1, v0)
    const plaque = new THREE.Mesh(sign, plaqueMaterial)
    plaque.position.set(x, y, z)
    group.add(plaque)
    scene.add(group)
  }

  b.quad(0, 0, (startZ + 105) / 2, 190, 105 - startZ, bank, FLAT)
  b.quad(0, 0.02, 2.1, 125, 1.8, col('#edf1ff'), FLAT)
  b.quad(0, 0.016, ROAD_CENTER_Z, 125, 5.0, col('#bdc7df'), FLAT)
  for (const side of [-1, 1]) {
    b.box(0, 0.036, ROAD_CENTER_Z + side * 2.51, 125, 0.093, 0.17, snow)
    b.quad(0, 0.023, ROAD_CENTER_Z + side * 0.84, 125, 0.31, col('#d4d9eb'), FLAT)
  }
  for (let x = -48; x <= 48; x += 2.5) {
    b.box(x, 0.42, 12.5, 0.14, 0.84, 0.16, col(WOOD_DARK))
    b.sphere(x, 0.85, 12.5, 0.12, 0.08, 0.12, snow)
  }
  for (const y of [0.29, 0.62]) b.box(0, y, 12.5, 97, 0.08, 0.09, col(WOOD))
  for (const x of [-19, -8.8, 4.4, 15.8, 26.7]) {
    b.cylinder(x, 1.41, 2.57, 0.067, 0.042, 2.75, 8, navy)
    b.cylinder(x, 0.16, 2.57, 0.18, 0.11, 0.31, 9, navy)
    b.cylinder(x, 3.19, 2.57, 0.3, 0.05, 0.24, 7, navy)
    b.cylinder(x, 2.74, 2.57, 0.19, 0.14, 0.10, 7, navy)
    builders.glow.cylinder(x, 2.93, 2.57, 0.15, 0.22, 0.39, 7, [gold, cream])
    builders.halo.billboard(x, 2.93, 2.57, 2.7, 2.7, col('#865323'))
  }
  for (const side of [-1, 1]) {
    addGroundLantern(builders, side * 3.1, startZ + 2.4)
    for (let distance = -7; distance < 0; distance += 2.5) {
      addMound(builders, side * 4.2, startZ - distance, 1.05, 0.23, 1.5)
    }
  }
}

function addCourseSurface({ solid: b, rnd }: Builders, startZ: number): void {
  const length = FINISH + FINISH_RUNOUT + 20
  const strip = (x: number, width: number, offset: number, paint: THREE.Color) => {
    b.quad(x, slopeHeight(length / 2) + offset, startZ - length / 2, width, Math.hypot(length, length * GRADE), paint, SLOPE)
  }
  strip(0, 180, 0, bank)
  strip(0, TRACK_HALF_WIDTH * 2, 0.018, packed)
  strip(0, TRACK_HALF_WIDTH * 2 - 0.3, 0.025, col('#e2ecf7'))
  for (const lane of [-1, 0, 1]) {
    const center = lane * LANE_WIDTH
    strip(center - 0.24, 0.055, 0.033, col('#cadbec'))
    strip(center + 0.24, 0.055, 0.033, col('#cadbec'))
  }
  for (let distance = 2; distance < FINISH + 20; distance += 2.9) {
    for (const side of [-1, 1]) {
      const x = side * rnd.range(4.1, 6.1)
      const y = slopeHeight(distance)
      const z = startZ - distance
      b.sphere(x, y - 0.09, z, rnd.range(0.6, 1.35), rnd.range(0.19, 0.48), rnd.range(0.85, 2.1), snow)
      for (const edge of [LANE_WIDTH / 2, TRACK_HALF_WIDTH - 0.26]) {
        b.quad(side * edge, y + 0.036, z, edge < 2 ? 0.043 : 0.09, rnd.range(0.45, 1.38), col('#b5cce4'), SLOPE)
      }
    }
  }
  for (let distance = 5; distance < FINISH + 24; distance += 11) {
    for (const side of [-1, 1]) {
      const x = side * rnd.range(4.25, 4.7)
      const y = slopeHeight(distance)
      const z = startZ - distance
      b.cylinder(x, y + 0.33, z, 0.054, 0.049, 0.66, 7, navy)
      b.box(x, y + 0.63, z, 0.104, 0.19, 0.1, red)
      b.box(x, y + 0.67, z + 0.053, 0.09, 0.060, 0.012, cream)
    }
  }
}

function addForest(scene: THREE.Scene, builders: Builders, material: THREE.Material, startZ: number): void {
  const { rnd } = builders
  const placements: [x: number, y: number, z: number, height: number][] = []
  for (let distance = -9; distance <= FINISH + FINISH_RUNOUT; distance += rnd.range(3.05, 5.8)) {
    for (const side of [-1, 1]) {
      const offset = distance + rnd.range(-1.3, 1.45)
      placements.push([side * rnd.range(5.95, 10.3), slopeHeight(offset), startZ - offset, rnd.range(3.4, 7.3)])
      placements.push([side * rnd.range(11.3, 20.6), slopeHeight(offset), startZ - offset, rnd.range(5.5, 10.2)])
      if (rnd.chance(0.65)) {
        placements.push([side * rnd.range(20.8, 38), slopeHeight(offset), startZ - offset, rnd.range(6.2, 12)])
      }
    }
  }
  for (let x = -47; x <= 47; x += rnd.range(2.5, 4.3)) {
    if (Math.abs(x) < 5.8) continue
    placements.push([x, 0, rnd.range(-10.2, -6.45), rnd.range(4.4, 7.4)])
    placements.push([x, 0, rnd.range(15.2, 20.25), rnd.range(3.6, 7.2)])
  }

  const tree = new Builder()
  addFir({ ...builders, solid: tree }, 0, 0, 1)
  const forest = new THREE.InstancedMesh(tree.batch.build('lit'), material, placements.length)
  const transform = new THREE.Object3D()
  const tint = new THREE.Color()
  placements.forEach(([x, y, z, height], index) => {
    const width = height * rnd.range(0.74, 1.1)
    transform.position.set(x, y, z)
    transform.rotation.y = rnd.range(0, Math.PI * 2)
    transform.scale.set(width, height, width)
    transform.updateMatrix()
    forest.setMatrixAt(index, transform.matrix)
    const shade = rnd.range(0.68, 0.94)
    forest.setColorAt(index, tint.setRGB(shade * 0.9, shade * 0.96, shade))
  })
  forest.computeBoundingSphere()
  scene.add(forest)
}

function addLog(b: Builder, height: BarrierHeight): void {
  const { bottom, top } = BARRIERS[height]
  const y = (bottom + top) / 2
  const radius = (top - bottom) / 2 - 0.018
  const halfWidth = TRACK_HALF_WIDTH + 0.16
  const across = { z: Math.PI / 2 }
  const grain = col('#c98d58')
  b.cylinder(0, y, 0, radius, radius * 0.94, halfWidth * 2, 13, col('#78503e'), across)
  b.sphere(0, top - 0.061, 0.01, halfWidth - 0.15, 0.064, radius * 0.65, snow)
  for (const side of [-1, 1]) {
    const end = { rotation: { y: side * Math.PI / 2 } }
    b.disc(side * (halfWidth + 0.004), y, 0, radius * 0.83, grain, end)
    b.disc(side * (halfWidth + 0.008), y, 0, radius * 0.57, col('#a86c48'), end)
    b.disc(side * (halfWidth + 0.012), y, 0, radius * 0.44, grain, end)
    b.cylinder(side * (halfWidth - 0.19), y, 0, radius + 0.014, radius + 0.014, 0.082, 13, col('#493744'), across)
    if (height === 'high') {
      b.cylinder(side * (halfWidth - 0.035), bottom / 2, -0.04, 0.25, 0.18, top - 0.17, 10, col(WOOD_DARK), { z: side * 0.105 })
    }
  }
  for (const x of [-2.4, -0.88, 1.45, 2.77]) {
    b.cylinder(x, y + 0.05, radius * 0.66, 0.105, 0.069, 0.24, 8, col('#8c6044'), { x: 0.72, z: x < 0 ? 0.95 : -0.95 })
  }
}

function addCandyBarrier(builders: Builders, height: BarrierHeight): void {
  const { solid: b } = builders
  const { bottom, top } = BARRIERS[height]
  const radius = (top - bottom) / 2
  const y = (bottom + top) / 2
  const across = { z: Math.PI / 2 }
  const sections = 23
  const stripe = (TRACK_HALF_WIDTH * 2 + 0.3) / sections
  for (let index = 0; index < sections; index++) {
    b.cylinder((index - (sections - 1) / 2) * stripe, y, 0, radius, radius, stripe + 0.001, 12, index % 2 ? cream : red, across)
  }
  for (const side of [-1, 1]) {
    const scale = height === 'high' ? 2.04 : 1.21
    b.within(new THREE.Matrix4().makeScale(scale, scale, scale).setPosition(side * 4.02, 0, -0.11), () => {
      addCandyCane(builders, 0, 0, side)
    })
    b.sphere(side * (TRACK_HALF_WIDTH + 0.15), y, 0, 0.13, radius, radius, red)
    b.sphere(side * 4.02, 0.05, -0.11, 0.44, 0.16, 0.41, snow)
  }
}

function addRamp({ solid: b }: Builders): void {
  const halfWidth = 1.04
  const segments = 8
  for (let index = 0; index < segments; index++) {
    const from = index / segments
    const to = (index + 1) / segments
    const zNear = RAMP_LENGTH * (1 - from)
    const zFar = RAMP_LENGTH * (1 - to)
    const yNear = GRADE * zNear + rampRise(from)
    const yFar = GRADE * zFar + rampRise(to)
    const rotation = Math.atan2(zFar - zNear, yFar - yNear)
    const length = Math.hypot(zFar - zNear, yFar - yNear)
    const y = (yNear + yFar) / 2
    const z = (zNear + zFar) / 2
    b.quad(0, y + 0.028, z, halfWidth * 2, length + 0.006, snow, { x: rotation })
    for (const side of [-1, 1]) {
      b.within(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(side * halfWidth, 0, 0), () => {
        b.polygon([[-zNear, GRADE * zNear], [-zFar, GRADE * zFar], [-zFar, yFar + 0.028], [-zNear, yNear + 0.028]],
          0, side > 0 ? bank : packed, { flip: side < 0 })
      })
      b.quad(side * (halfWidth - 0.08), y + 0.038, z, 0.085, length, ice, { x: rotation })
    }

    if (index % 3 === 1) {
      b.within(new THREE.Matrix4().makeRotationX(rotation).setPosition(0, y + 0.045, z), () => {
        for (const side of [-1, 1]) b.quad(side * 0.23, 0, 0, 0.103, 0.59, ice, { z: side * 0.96 })
      })
    }
  }
  const height = rampRise(1)
  b.quad(0, height / 2, -0.009, halfWidth * 2, height + 0.03, bank, { y: Math.PI })
  b.box(0, height - 0.021, 0.011, halfWidth * 2, 0.093, 0.124, ice)
  for (const side of [-1, 1]) {
    const x = side * (halfWidth + 0.053)
    b.cylinder(x, height + 0.18, -0.045, 0.033, 0.029, 0.48, 7, navy)
    b.box(x, height + 0.41, -0.045, 0.45, 0.25, 0.045, gold)
    b.box(x, height + 0.41, -0.016, 0.064, 0.25, 0.014, red)
  }
}

function addCourseFeatures(builders: Builders, startZ: number): void {
  const { solid: b } = builders
  for (const feature of COURSE) {
    const z = startZ - feature.distance
    const y = slopeHeight(feature.distance)
    if (feature.kind === 'tree') {
      for (const lane of feature.lanes) {
        b.within(new THREE.Matrix4().makeTranslation(laneX(lane), y, z), () => {
          addFir(builders, 0, 0, 3.44 - 0.12 * lane)
          b.sphere(0, 0.008, 0.04, 0.86, 0.135, 0.7, snow)
        })
      }
      continue
    }
    const x = feature.kind === 'ramp' ? laneX(feature.lane) : 0
    b.within(new THREE.Matrix4().makeTranslation(x, y, z), () => {
      if (feature.kind === 'ramp') addRamp(builders)
      if (feature.kind === 'log') addLog(b, feature.height)
      if (feature.kind === 'cane') addCandyBarrier(builders, feature.height)
    })
  }
}

function addGates(scene: THREE.Scene, builders: Builders, startZ: number): void {
  const { solid: b } = builders
  for (const distance of [4.7, ...CHECKPOINTS.slice(1), FINISH]) {
    const z = startZ - distance
    const y = slopeHeight(distance)
    const finish = distance === FINISH
    const width = TRACK_HALF_WIDTH + 0.3
    for (const side of [-1, 1]) {
      const x = side * width
      const height = finish ? 4.15 : 1.84
      b.box(x, y + height / 2, z, 0.24, height, 0.26, col(WOOD_DARK))
      b.sphere(x, y + height + 0.04, z, 0.18, 0.102, 0.18, snow)
      b.box(x + side * 0.165, y + height - 0.21, z + 0.016, 0.54, 0.28, 0.07, finish ? red : ice)
      b.box(x + side * 0.165, y + height - 0.21, z + 0.062, 0.065, 0.28, 0.024, cream)
      addBulb(builders, x, y + height - 0.04, z + 0.15, gold, 0.106, 0.12)
    }
    if (finish) {
      b.box(0, y + 3.91, z, width * 2, 0.4, 0.29, col(WOOD_DARK))
      b.box(0, y + 4.15, z, width * 2 + 0.3, 0.095, 0.39, snow)
      b.quad(0, y + 0.05, z, TRACK_HALF_WIDTH * 2, 0.38, gold, SLOPE)
      for (let index = -7; index <= 7; index++) {
        addBulb(builders, index * 0.5, y + 3.64 + 0.005 * index ** 2, z + 0.195, index % 2 === 0 ? gold : cream, 0.05)
      }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.54, 0.635), new THREE.MeshBasicMaterial({
        map: createSignTexture('ZIEL').texture, alphaTest: 0.5,
      }))
      sign.position.set(0, y + 4.07, z + 0.2)
      scene.add(sign)
    }
  }
}

export function buildSkiWorld(day: number, time: TimeUniform) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY.horizon)
  scene.fog = new THREE.FogExp2(SKY.horizon, 0.016)
  scene.add(new THREE.HemisphereLight('#c6dcff', '#eed1cc', 2.3))
  const moonlight = new THREE.DirectionalLight('#e7eeff', 1.55)
  moonlight.position.set(-3, 7, 5)
  scene.add(moonlight)

  const { plots } = createStreetLayout()
  const { spec } = plots[day - 1]
  const startZ = -spec.depth - 11.4
  const material = createSolidMaterial()
  const glow = createGlowMaterial(time)
  glow.side = THREE.DoubleSide
  const halo = createGlowMaterial(time, { halo: true })
  const builders = { solid: new Builder(), glow: new Builder(), halo: new Builder(), rnd: createRandom(208) }

  buildVillage(scene, plots, day, startZ, builders, { solid: material, glow, halo })
  addCourseSurface(builders, startZ)
  addCourseFeatures(builders, startZ)
  addForest(scene, builders, material, startZ)
  addGates(scene, builders, startZ)
  scene.add(new THREE.Mesh(builders.solid.batch.build('lit'), material),
    new THREE.Mesh(builders.glow.batch.build('glow'), glow), new THREE.Mesh(builders.halo.batch.build('glow'), halo))

  return { scene, material, startZ, roof: ridgeHeight(spec), depth: spec.depth }
}
