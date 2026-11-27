import * as THREE from 'three'
import { Builder } from './batch.ts'
import { addElfHat } from './elf.ts'
import { col } from './palette.ts'

const red = col('#da384e')
const darkRed = col('#951f35')
const wool = col('#fff2dc')
const skin = col('#f6c9a3')
const navy = col('#23304c')
const gold = col('#ffc65d')
const teal = col('#389291')

export interface SkierPose {
  duck: number
  jump: number
  style: number
  spin: number
  carve: number
  facing: number
  time: number
}

export function createSkier(material: THREE.Material) {
  const group = new THREE.Group()
  const rig = new THREE.Group()
  rig.rotation.order = 'YXZ'
  group.add(rig)

  const mesh = (build: (b: Builder) => void) => {
    const b = new Builder()
    build(b)
    return new THREE.Mesh(b.batch.build('lit'), material)
  }

  const chest = new THREE.Group()
  rig.add(chest)
  chest.add(mesh((b) => {
    b.cylinder(0, 0.15, 0, 0.245, 0.198, 0.48, 14, [darkRed, red])
    b.cylinder(0, -0.105, 0, 0.25, 0.245, 0.08, 14, wool)
    b.cylinder(0, 0.045, 0, 0.245, 0.237, 0.096, 14, navy)
    b.box(0, 0.048, -0.239, 0.135, 0.11, 0.045, gold)
    b.box(0, 0.048, -0.264, 0.071, 0.054, 0.016, navy)
    b.cylinder(0, 0.405, 0, 0.218, 0.22, 0.14, 14, teal)
    b.sphere(0.13, 0.39, 0.16, 0.11, 0.09, 0.1, teal)
  }))

  const scarf = new THREE.Group()
  scarf.position.set(0.13, 0.38, 0.18)
  scarf.add(mesh((b) => {
    b.box(0.028, -0.095, 0.21, 0.14, 0.046, 0.47, teal, { x: 0.38, y: 0.19 })
    b.box(0.06, -0.167, 0.376, 0.14, 0.05, 0.065, wool, { x: 0.38, y: 0.19 })
  }))
  chest.add(scarf)

  const head = new THREE.Group()
  head.position.set(0, 0.65, -0.035)
  head.add(mesh((b) => {
    b.sphere(0, 0, 0, 0.27, 0.258, 0.245, skin)
    b.sphere(0, 0.064, 0.137, 0.26, 0.204, 0.137, col('#834039'))
    b.sphere(0, -0.044, -0.241, 0.05, 0.043, 0.062, col('#e88f73'))
    for (const side of [-1, 1]) {
      b.cylinder(side * 0.275, 0.045, 0.005, 0.064, 0, 0.22, 8, col('#efb88f'), { z: -side * 1.01 })
      b.sphere(side * 0.152, -0.076, -0.196, 0.055, 0.035, 0.037, col('#ec8f80'))
      b.sphere(side * 0.093, 0.045, -0.215, 0.066, 0.08, 0.036, wool)
      b.sphere(side * 0.09, 0.04, -0.248, 0.035, 0.047, 0.017, navy)
    }
    b.sphere(0, -0.113, -0.221, 0.041, 0.012, 0.011, darkRed)
    addElfHat(b, 0, -0.018, 0.01, red, darkRed, 0.37)
  }))
  chest.add(head)

  const arms: THREE.Group[] = []
  const legs: THREE.Mesh[] = []
  const skis: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.21, 0.31, -0.017)
    arm.add(mesh((b) => {
      b.cylinder(0, -0.144, 0, 0.089, 0.11, 0.32, 10, [red, darkRed])
      b.cylinder(0, -0.303, 0, 0.09, 0.094, 0.058, 10, wool)
      b.sphere(0, -0.36, -0.014, 0.092, 0.087, 0.09, darkRed)
      b.cylinder(0, -0.637, 0.252, 0.019, 0.021, 0.77, 8, [teal, navy], { x: -0.79 })
      b.cylinder(0, -0.875, 0.494, 0.071, 0.071, 0.025, 10, gold, { x: -0.79 })
    }))
    chest.add(arm)
    arms.push(arm)

    const leg = mesh((b) => {
      b.cylinder(0, 0.27, -0.05, 0.095, 0.12, 0.31, 10, [darkRed, red], { x: 0.44 })
      b.cylinder(0, 0.5, -0.082, 0.105, 0.14, 0.31, 10, [red, darkRed], { x: -0.54 })
    })
    leg.position.x = side * 0.205
    rig.add(leg)
    legs.push(leg)

    const ski = new THREE.Group()
    ski.position.x = side * 0.215
    ski.add(mesh((b) => {
      b.box(0, 0.048, 0.04, 0.22, 0.074, 1.54, [navy, gold])
      b.box(0, 0.084, -0.01, 0.152, 0.018, 1.37, teal)
      b.box(0, 0.089, -0.837, 0.219, 0.069, 0.27, gold, { x: 0.28 })
      b.sphere(0, 0.129, -0.948, 0.107, 0.043, 0.09, gold)
      b.box(0, 0.079, 0.674, 0.153, 0.025, 0.145, wool)
      b.box(0, 0.12, -0.05, 0.18, 0.07, 0.47, navy)
      b.sphere(0, 0.212, -0.036, 0.101, 0.112, 0.198, navy)
      b.box(0, 0.263, 0.025, 0.198, 0.041, 0.097, wool)
    }))
    rig.add(ski)
    skis.push(ski)
  }

  return {
    group,
    pose({ duck, jump, style, spin, carve, facing, time }: SkierPose) {
      rig.rotation.y = facing + spin * Math.PI * 2 - carve * 0.23
      rig.rotation.z = carve * -0.17 + Math.sin(time * 2.1) * 0.012
      chest.position.set(0, 0.65 - duck * 0.3 + jump * 0.05, duck * -0.14)
      chest.scale.y = 1 - duck * 0.39
      chest.rotation.x = 0.16 + duck * 0.92 - jump * 0.35
      head.rotation.x = -duck * 0.44
      scarf.rotation.x = -0.16 - style * 0.32 + Math.sin(time * 9) * 0.11
      for (let index = 0; index < 2; index++) {
        const side = index === 0 ? -1 : 1
        arms[index].rotation.z = side * (0.46 + style * 0.87 + duck * 0.3)
        arms[index].rotation.x = -0.13 - style * 0.18 + duck * 0.38
        legs[index].scale.y = 1 - duck * 0.46
        legs[index].rotation.x = -duck * 0.29
        skis[index].rotation.y = side * style * 0.57
        skis[index].rotation.x = jump * 0.19 + side * style * 0.2
        skis[index].position.y = (index === 0 ? 0.12 : 0.02) * style
      }
    },
  }
}
