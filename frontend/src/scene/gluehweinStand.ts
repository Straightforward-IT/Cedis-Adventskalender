import * as THREE from 'three'
import { createRandom, hashSeed } from '../lib/rng.ts'
import { Builder } from './batch.ts'
import { buildStandingElf } from './elf.ts'
import { createGlowMaterial } from './materials.ts'
import type { TimeUniform } from './materials.ts'
import { BULB_COLORS, PINE, SNOW, WOOD, WOOD_DARK, col } from './palette.ts'
import { addBulb } from './props.ts'
import type { Builders } from './props.ts'
import { createSignTexture } from './textures.ts'

/**
 * Maße des Glühweinstands (Haus 13). Ursprung am Boden mitten vor der Theke; die Theke
 * zeigt nach +z zur Straße, dahinter (−z) steht man selbst. Aus Sicht hinter der Theke
 * liegt +x links: Glühwein links, Kakao rechts, Becher 1 links.
 */
export const STAND = {
  width: 3.6,
  counterTop: 0.99,
  /** Hier stehen die drei Becher auf der Theke. */
  cupZ: -0.3,
  cupX: [0.55, 0, -0.55] as const,
  /** Zapfhahn am Glühweintopf (links) und am Kakaokessel (rechts). */
  wineTap: new THREE.Vector3(1.08, 1.22, -0.3),
  cocoaTap: new THREE.Vector3(-1.08, 1.22, -0.3),
  /** Flaschen und Sahneschüssel. */
  rum: new THREE.Vector3(0.98, 0.99, -0.62),
  amaretto: new THREE.Vector3(0.72, 0.99, -0.66),
  cream: new THREE.Vector3(-0.86, 0.99, -0.62),
}

/** Vorderkante der Theke auf dem Gehweg – kurz vor dem Bordstein (z = 3). */
export const GLUEHWEIN_STAND_Z = 2.85

const CUP_RED = '#c4463c'

function builders(seed: string): Builders {
  return { solid: new Builder(), glow: new Builder(), halo: new Builder(), rnd: createRandom(hashSeed(13, seed)) }
}

/** Ein Holzrahmen-Dach: zwei schräge Flächen mit Schnee drauf. */
function addRoof({ solid }: Builders): void {
  const wood = col(WOOD_DARK)
  const snow = col(SNOW)
  const eaveY = 2.72
  const ridgeY = 3.38
  const front = 0.42
  const back = -2.5
  const ridgeZ = (front + back) / 2
  for (const [from, sign] of [[front, 1], [back, -1]] as const) {
    const run = Math.abs(from - ridgeZ)
    const rise = ridgeY - eaveY
    const length = Math.hypot(run, rise)
    const angle = sign * Math.atan2(rise, run)
    const cz = (from + ridgeZ) / 2
    const cy = (eaveY + ridgeY) / 2
    solid.box(0, cy, cz, STAND.width + 0.5, 0.07, length + 0.1, wood, { x: angle })
    solid.box(0, cy + 0.07, cz, STAND.width + 0.56, 0.08, length + 0.04, snow, { x: angle })
  }
  solid.box(0, ridgeY + 0.08, ridgeZ, STAND.width + 0.6, 0.13, 0.16, snow)
  // Giebelbalken links und rechts
  for (const side of [-1, 1]) {
    solid.box(side * (STAND.width / 2 + 0.02), eaveY - 0.04, ridgeZ, 0.1, 0.12, front - back, wood)
  }
}

function addFrame({ solid }: Builders): void {
  const wood = col(WOOD)
  const dark = col(WOOD_DARK)
  const half = STAND.width / 2
  // Pfosten
  for (const x of [-half, half]) {
    for (const z of [0.05, -2.15]) solid.box(x, 1.36, z, 0.13, 2.72, 0.13, dark)
  }
  // Rückwand und halbhohe Seitenwände
  solid.box(0, 1.36, -2.18, STAND.width, 2.72, 0.08, col('#6a4630'))
  for (const x of [-half, half]) solid.box(x, 0.55, -1.06, 0.07, 1.1, 2.2, wood)
  // Theke: Korpus aus senkrechten Brettern, Platte obendrauf
  solid.box(0, 0.47, -0.3, STAND.width - 0.1, 0.94, 0.56, wood)
  for (let x = -half + 0.2; x < half - 0.1; x += 0.3) solid.box(x, 0.47, -0.015, 0.025, 0.9, 0.02, dark)
  solid.box(0, STAND.counterTop - 0.03, -0.3, STAND.width + 0.1, 0.06, 0.76, dark)
  // Ablage hinten (aus der Spielersicht unsichtbar, von der Straße aus gemütlich)
  solid.box(0, 1.5, -2.08, STAND.width - 0.3, 0.05, 0.22, dark)
  for (let i = 0; i < 9; i++) {
    const x = -1.4 + i * 0.35
    solid.cylinder(x, 1.58, -2.06, 0.05, 0.05, 0.1, 10, col(i % 2 ? CUP_RED : '#fff2dc'))
  }
}

/** Tannengirlande an der Thekenfront mit Lichtern. */
function addGarland(b: Builders): void {
  const { solid } = b
  const half = STAND.width / 2
  const bulbs = BULB_COLORS.multi.map(col)
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const x = -half + t * STAND.width
    const y = 0.88 - Math.sin(t * Math.PI * 4) ** 2 * 0.16
    solid.sphere(x, y, 0.08, 0.1, 0.08, 0.07, col(PINE[i % PINE.length]))
    if (i % 2 === 0) addBulb(b, x, y - 0.06, 0.15, bulbs[(i / 2) % bulbs.length], 0.04, 0.6)
  }
  // Lichterkette unter der Dachkante
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const x = -half + t * STAND.width
    const y = 2.62 - Math.sin(t * Math.PI * 3) ** 2 * 0.14
    addBulb(b, x, y, 0.4, col('#ffd27a'), 0.045, 0.35)
  }
}

/** Kupfertopf mit Glühwein, Kakaokessel, Flaschen und Sahne. */
function addEquipment({ solid, glow }: Builders): void {
  const copper = col('#b8683c')
  const copperDark = col('#7d4024')
  const brass = col('#e0b252')
  const top = STAND.counterTop

  // Glühweintopf (aus Spielersicht links) – mit Hahn zur Mitte
  const wine = STAND.wineTap
  solid.cylinder(wine.x + 0.26, top + 0.04, wine.z, 0.24, 0.24, 0.08, 14, col('#2c2f42'))
  solid.cylinder(wine.x + 0.26, top + 0.34, wine.z, 0.25, 0.27, 0.5, 18, [copperDark, copper])
  solid.cylinder(wine.x + 0.26, top + 0.6, wine.z, 0.28, 0.24, 0.05, 18, copperDark)
  solid.sphere(wine.x + 0.26, top + 0.65, wine.z, 0.05, 0.04, 0.05, brass)
  solid.box(wine.x + 0.05, wine.y + 0.03, wine.z, 0.2, 0.05, 0.05, brass)
  solid.box(wine.x - 0.04, wine.y - 0.02, wine.z, 0.04, 0.1, 0.04, brass)
  solid.box(wine.x - 0.02, wine.y + 0.1, wine.z, 0.03, 0.12, 0.03, col('#2c2f42'))

  // Kakaokessel (aus Spielersicht rechts) – cremefarben mit Hahn zur Mitte
  const cocoa = STAND.cocoaTap
  solid.cylinder(cocoa.x - 0.26, top + 0.04, cocoa.z, 0.24, 0.24, 0.08, 14, col('#2c2f42'))
  solid.cylinder(cocoa.x - 0.26, top + 0.36, cocoa.z, 0.22, 0.22, 0.56, 18, [col('#d8c3a5'), col('#f3e4cc')])
  solid.cylinder(cocoa.x - 0.26, top + 0.36, cocoa.z + 0.005, 0.225, 0.225, 0.14, 18, col('#6b3e26'))
  solid.cylinder(cocoa.x - 0.26, top + 0.66, cocoa.z, 0.2, 0.16, 0.06, 18, col('#6b3e26'))
  solid.box(cocoa.x - 0.05, cocoa.y + 0.03, cocoa.z, 0.2, 0.05, 0.05, col('#c9c9d6'))
  solid.box(cocoa.x + 0.04, cocoa.y - 0.02, cocoa.z, 0.04, 0.1, 0.04, col('#c9c9d6'))
  solid.box(cocoa.x + 0.02, cocoa.y + 0.1, cocoa.z, 0.03, 0.12, 0.03, col('#2c2f42'))

  // Flaschen: dunkler Rum und eckiger Amaretto
  const rum = STAND.rum
  solid.cylinder(rum.x, top + 0.13, rum.z, 0.055, 0.055, 0.26, 10, col('#4a2414'))
  solid.cylinder(rum.x, top + 0.3, rum.z, 0.055, 0.022, 0.08, 10, col('#4a2414'))
  solid.cylinder(rum.x, top + 0.36, rum.z, 0.022, 0.022, 0.06, 8, col('#e8d9b0'))
  solid.box(rum.x, top + 0.13, rum.z + 0.05, 0.08, 0.1, 0.012, col('#f0e2bf'))
  const amaretto = STAND.amaretto
  solid.box(amaretto.x, top + 0.12, amaretto.z, 0.1, 0.24, 0.09, col('#c0661f'))
  solid.cylinder(amaretto.x, top + 0.28, amaretto.z, 0.04, 0.03, 0.08, 8, col('#c0661f'))
  solid.box(amaretto.x, top + 0.34, amaretto.z, 0.07, 0.05, 0.07, col('#2a1810'))
  solid.box(amaretto.x, top + 0.12, amaretto.z + 0.047, 0.07, 0.08, 0.01, col('#f7ead0'))

  // Sahneschüssel mit Spritzbeutel
  const cream = STAND.cream
  solid.cylinder(cream.x, top + 0.06, cream.z, 0.1, 0.16, 0.12, 16, col('#dfe6f2'))
  for (const [dx, dz] of [[-0.05, 0], [0.05, 0.02], [0, -0.04], [0.01, 0.04]] as const) {
    solid.sphere(cream.x + dx, top + 0.13, cream.z + dz, 0.07, 0.05, 0.07, col('#fffaf0'))
  }
  solid.cone(cream.x - 0.18, top, cream.z + 0.04, 0.07, 0.24, 10, col('#e4ecf7'))

  // Untersetzer für die drei Becher
  for (const x of STAND.cupX) solid.cylinder(x, top + 0.005, STAND.cupZ, 0.12, 0.12, 0.01, 18, col('#3b2a22'))

  // Glühende Kohle unter dem Topf
  glow.box(wine.x + 0.26, top + 0.06, wine.z + 0.2, 0.3, 0.02, 0.03, col('#ff7a3a'))
}

export interface GluehweinStandMeshes {
  group: THREE.Group
  /** Bewegt den Barkeeper (falls vorhanden) – einmal pro Bild mit der Szenenzeit aufrufen. */
  update(time: number): void
  dispose(): void
}

/** Wo der Barkeeper steht: hinter der Theke beim Glühweintopf, auf einer Kiste. */
const BARTENDER = new THREE.Vector3(0.62, 0.32, -1.0)

/**
 * Der Wichtel-Barkeeper: ein stehender Wichtel mit Schürze auf einer Kiste, der mit einer
 * Kelle im Glühweintopf rührt und dabei vergnügt wippt.
 */
function createBartender(solidMaterial: THREE.Material) {
  const crate = new Builder()
  crate.box(0, 0.16, 0, 0.6, 0.32, 0.5, col(WOOD_DARK))
  const elfGeometry = buildStandingElf(1)
  const apron = new Builder()
  apron.box(0, 0.58, 0.215, 0.32, 0.36, 0.03, col('#fff6ea'), { x: -0.08 })
  apron.box(0, 0.79, 0.19, 0.16, 0.08, 0.02, col('#fff6ea'))
  apron.box(0, 0.6, 0.235, 0.12, 0.08, 0.01, col('#c4463c'))
  const ladle = new Builder()
  ladle.cylinder(0, 0.28, 0, 0.014, 0.014, 0.56, 6, col('#c9c9d6'))
  ladle.sphere(0, 0, 0, 0.06, 0.035, 0.06, col('#c9c9d6'))

  const group = new THREE.Group()
  group.position.copy(BARTENDER)
  group.add(new THREE.Mesh(crate.batch.build('lit'), solidMaterial))
  const body = new THREE.Group()
  body.position.y = 0.32
  body.scale.setScalar(0.9)
  body.add(new THREE.Mesh(elfGeometry, solidMaterial), new THREE.Mesh(apron.batch.build('lit'), solidMaterial))
  group.add(body)

  // Die Kelle hängt im Topf; ihr Stiel zeigt schräg zum Wichtel.
  const pot = new THREE.Vector3(STAND.wineTap.x + 0.26, STAND.counterTop + 0.5, STAND.wineTap.z)
  const ladlePivot = new THREE.Group()
  ladlePivot.position.copy(pot)
  const ladleMesh = new THREE.Mesh(ladle.batch.build('lit'), solidMaterial)
  ladleMesh.rotation.z = 0.55
  ladlePivot.add(ladleMesh)

  return {
    objects: [group, ladlePivot],
    update(time: number) {
      // Rühren: die Kelle kreist im Topf, der Wichtel lehnt sich mit.
      const stir = time * 1.6
      ladleMesh.position.set(Math.cos(stir) * 0.1, 0, Math.sin(stir) * 0.08)
      ladlePivot.rotation.y = -0.6 + Math.sin(stir) * 0.25
      body.rotation.z = -0.06 + Math.sin(stir) * 0.04
      body.rotation.y = 0.35 + Math.sin(time * 0.4) * 0.25
      // Ab und zu ein fröhlicher Hüpfer
      const hop = Math.max(0, Math.sin(time * 0.9)) ** 12
      body.position.y = 0.32 + hop * 0.12
    },
  }
}

/** Der Glühweinstand als fertige Gruppe – im Spiel und als Easter Egg auf der Straße. */
export function createGluehweinStand(
  solidMaterial: THREE.Material,
  time: TimeUniform,
  options: { light?: boolean; bartender?: boolean } = {},
): GluehweinStandMeshes {
  const b = builders('stand')
  addFrame(b)
  addRoof(b)
  addGarland(b)
  addEquipment(b)

  const glowMaterial = createGlowMaterial(time)
  const haloMaterial = createGlowMaterial(time, { halo: true })
  const solid = b.solid.batch.build('lit')
  const glow = b.glow.batch.build('glow')
  const halo = b.halo.batch.build('glow')
  const sign = createSignTexture('Glühwein')
  const signMaterial = new THREE.MeshBasicMaterial({ map: sign.texture, alphaTest: 0.5, color: '#efe6d8' })
  const signGeometry = new THREE.PlaneGeometry(2.3, 0.575)
  const board = new THREE.Mesh(signGeometry, signMaterial)
  board.position.set(0, 2.38, 0.14)

  const group = new THREE.Group()
  group.add(new THREE.Mesh(solid, solidMaterial), new THREE.Mesh(glow, glowMaterial), new THREE.Mesh(halo, haloMaterial), board)
  if (options.light) {
    // Warmes Licht unter dem Dach – beleuchtet Theke und Kundschaft.
    const lamp = new THREE.PointLight('#ffc77a', 9, 9, 1.6)
    lamp.position.set(0, 2.3, 0.3)
    group.add(lamp)
  }
  const bartender = options.bartender ? createBartender(solidMaterial) : null
  if (bartender) group.add(...bartender.objects)

  return {
    group,
    update(time) {
      bartender?.update(time)
    },
    dispose() {
      if (bartender) {
        for (const object of bartender.objects) {
          object.traverse((child) => (child as THREE.Mesh).geometry?.dispose())
        }
      }
      for (const geometry of [solid, glow, halo, signGeometry]) geometry.dispose()
      for (const material of [glowMaterial, haloMaterial, signMaterial]) material.dispose()
      sign.texture.dispose()
    },
  }
}

/** Ein Becher mit Henkel; Ursprung am Boden, Henkel nach +x. */
export function buildMug(color = CUP_RED): THREE.BufferGeometry {
  const b = new Builder()
  const body = col(color)
  const white = col('#fff2dc')
  b.cylinder(0, 0.07, 0, 0.068, 0.08, 0.14, 16, body)
  b.cylinder(0, 0.105, 0, 0.081, 0.079, 0.03, 16, white)
  b.cylinder(0, 0.002, 0, 0.07, 0.07, 0.004, 16, col('#8f2f28'))
  b.torus(0.085, 0.075, 0, 0.035, 0.011, body)
  return b.batch.build('lit')
}

/** Dampf- und Gefühlsbildchen als kleine Leinwand-Textur (Emoji). */
export function createEmojiTexture(emoji: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '96px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
    context.fillText(emoji, 64, 72)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Wo der Stand vor einem Haus steht (x relativ zur Hausmitte): neben der Haustür, damit
 * Tür und Selfie frei bleiben – soweit das Haus breit genug ist.
 */
export function standOffset(doorX: number, houseWidth: number): number {
  const away = 0.5 + STAND.width / 2 + 0.35
  const x = doorX <= 0 ? doorX + away : doorX - away
  const limit = Math.max(0, houseWidth / 2 + 0.4 - STAND.width / 2)
  return Math.min(limit, Math.max(-limit, x))
}
