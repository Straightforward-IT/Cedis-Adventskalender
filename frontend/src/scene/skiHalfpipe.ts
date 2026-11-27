import * as THREE from 'three'
import { Builder } from './batch.ts'
import type { Point } from './batch.ts'
import { GOLD, IRON, SNOW, col } from './palette.ts'
import { createSkier } from './skier.ts'

const HALF_WIDTH = 1.38
const HALF_DEPTH = 0.53
const FLOOR = 0.19
const BANK = 0.92
const CURVE = 3.3
/** Height of the platforms on both sides – flush with the top of the walls. */
const DECK_Y = FLOOR + BANK
const DECK_WIDTH = 0.52
/** Loose powder on top of the packed riding surface; the skis sink into it. */
const POWDER = 0.035
/** The elf is small next to the pipe, so the walls look like a proper halfpipe. */
const SKIER_SCALE = 0.3

/** One run: drop in from one platform, ride across and come to a stand on the other. */
const RIDE_SECONDS = 2.7
/** Standing on a platform: catch your breath, turn around, crouch, go. */
const STAND_SECONDS = 1.3
/** Where the elf stands on a platform (centre of the skis). */
const STAND_X = HALF_WIDTH + DECK_WIDTH * 0.42
/** Facing for travel towards +x and −x (see skier.ts: the rig looks along −z at 0). */
const FACING_RIGHT = Math.PI * 1.5
const FACING_LEFT = Math.PI * 0.5
/** Over this distance before the lip the elf straightens up from the wall tilt. */
const LIP_EASE = 0.2
/** Rounding of the platform edge for the rider's path: from this far inside the pipe … */
const EDGE_IN = 0.16
/** … to this far out on the platform. */
const EDGE_OUT = 0.08
const FLAT = { x: -Math.PI / 2 }

/** Packed riding surface (where the skis actually run). */
function surfaceY(x: number): number {
  const along = Math.min(Math.abs(x), HALF_WIDTH)
  return Math.abs(x) > HALF_WIDTH ? DECK_Y : FLOOR + BANK * (along / HALF_WIDTH) ** CURVE
}

function surfaceAngle(x: number): number {
  if (Math.abs(x) >= HALF_WIDTH) return 0
  const slope = Math.sign(x) * BANK * CURVE / HALF_WIDTH * (Math.abs(x) / HALF_WIDTH) ** (CURVE - 1)
  return Math.atan(slope)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

function buildPipe(): THREE.BufferGeometry {
  const b = new Builder()
  const snow = col(SNOW)
  const powder = col('#eef4fd')
  const track = col('#c3d8ec')
  const sideSnow = [col('#aebcd8'), snow] as const
  const sections = 36
  const top = (x: number) => surfaceY(x) + POWDER

  // Cheeks and powder follow the riding curve, a little higher: that is the loose snow on top.
  for (let index = 0; index < sections; index++) {
    const left = -HALF_WIDTH + 2 * HALF_WIDTH * index / sections
    const right = -HALF_WIDTH + 2 * HALF_WIDTH * (index + 1) / sections
    const from: Point = [left, top(left)]
    const to: Point = [right, top(right)]
    const cheek: Point[] = [[left, 0.01], [right, 0.01], to, from]
    const rise = to[1] - from[1]
    const length = Math.hypot(right - left, rise)
    const transform = new THREE.Matrix4().makeRotationZ(Math.atan2(rise, right - left))
      .setPosition((left + right) / 2, (from[1] + to[1]) / 2, 0)

    b.polygon(cheek, HALF_DEPTH, sideSnow)
    b.polygon(cheek, -HALF_DEPTH, sideSnow, { flip: true })
    b.within(transform, () => {
      b.quad(0, 0, 0, length + 0.004, HALF_DEPTH * 2, powder, FLAT)
      // Ski tracks pressed into the powder
      for (const z of [-0.07, 0.03]) b.quad(0, 0.002, z, length + 0.004, 0.045, track, FLAT)
      // Soft, continuous snow bead along the front and back edges hides the hard corner of the cheeks.
      for (const side of [-1, 1]) {
        b.cylinder(0, 0.012, side * (HALF_DEPTH - 0.03), 0.055, 0.055, length + 0.03, 10, snow, { z: Math.PI / 2 })
      }
    })
  }

  // Platforms on both sides: snow-covered blocks flush with the top of the walls.
  for (const side of [-1, 1]) {
    const centre = side * (HALF_WIDTH + DECK_WIDTH / 2)
    b.box(centre, DECK_Y / 2, 0, DECK_WIDTH, DECK_Y, HALF_DEPTH * 2, sideSnow)
    b.box(centre, DECK_Y + POWDER / 2, 0, DECK_WIDTH, POWDER, HALF_DEPTH * 2, powder)
    // Rounded snow beads on the deck edges and along the lip, where the deck meets the pipe.
    const along = { x: Math.PI / 2 }
    b.cylinder(side * HALF_WIDTH, DECK_Y + POWDER, 0, 0.045, 0.045, HALF_DEPTH * 2, 10, snow, along)
    b.cylinder(side * (HALF_WIDTH + DECK_WIDTH), DECK_Y + POWDER - 0.01, 0, 0.07, 0.07, HALF_DEPTH * 2 + 0.04, 10, snow, along)
    for (const z of [-1, 1]) {
      b.cylinder(centre, DECK_Y + POWDER, z * (HALF_DEPTH - 0.01), 0.055, 0.055, DECK_WIDTH + 0.05, 10, snow, { z: Math.PI / 2 })
    }
    // Snow drifts piled against the outer wall of the platform
    b.sphere(side * (HALF_WIDTH + DECK_WIDTH), 0.12, 0, 0.26, 0.2, 0.62, snow)
    // Flag at the back corner of the platform
    const pole = side * (HALF_WIDTH + DECK_WIDTH - 0.08)
    b.cylinder(pole, DECK_Y + 0.16, -0.4, 0.022, 0.02, 0.36, 8, col(IRON))
    b.box(pole - side * 0.1, DECK_Y + 0.27, -0.4, 0.18, 0.12, 0.02, col('#b73a4a'))
    b.sphere(pole, DECK_Y + 0.35, -0.4, 0.034, 0.034, 0.034, col(GOLD))
  }

  return b.batch.build('lit')
}

/** How the elf finishes a run at the far wall. */
type Finish = 'stand' | 'air180'

/** Where an air-180 takes off: just below the lip, still on the wall. */
const LIP_X = HALF_WIDTH - 0.09
/** Hang time over the lip for the 180. */
const AIR180_SECONDS = 0.95
/** Height above the lip at the top of the air. */
/** How far he shoots up past the lip along the line of the wall before turning around. */
const AIR180_RISE = 0.52

/**
 * The fixed loop of runs (left → right, right → left, …). Mostly he comes to a stand on the
 * platform; now and then he flies over the lip instead, turns 180° in the air and rides straight
 * back. Six runs make one loop, so both directions get both endings.
 */
const RUNS: { direction: 1 | -1; finish: Finish; hop360: boolean }[] = [
  { direction: 1, finish: 'stand', hop360: false },
  { direction: -1, finish: 'air180', hop360: true },
  { direction: 1, finish: 'stand', hop360: false },
  { direction: -1, finish: 'stand', hop360: true },
  { direction: 1, finish: 'air180', hop360: false },
  { direction: -1, finish: 'stand', hop360: true },
]

interface Segment {
  kind: 'ride' | 'stand' | 'air180'
  start: number
  duration: number
  direction: 1 | -1
  from: number
  to: number
  hop360: boolean
}

/** All segments of one loop with their start times – built once. */
const SEGMENTS: Segment[] = (() => {
  const list: Segment[] = []
  let t = 0
  // The loop starts on the left platform (where the last run of the loop ends).
  let x = -STAND_X
  for (const run of RUNS) {
    const to = run.direction * (run.finish === 'stand' ? STAND_X : LIP_X)
    const ride = RIDE_SECONDS * (0.6 + 0.4 * Math.abs(to - x) / (2 * STAND_X))
    list.push({ kind: 'ride', start: t, duration: ride, direction: run.direction, from: x, to, hop360: run.hop360 })
    t += ride
    const duration = run.finish === 'stand' ? STAND_SECONDS : AIR180_SECONDS
    list.push({ kind: run.finish, start: t, duration, direction: run.direction, from: to, to, hop360: false })
    t += duration
    x = to
  }
  return list
})()
const LOOP = SEGMENTS.reduce((sum, segment) => sum + segment.duration, 0)

/** Wall angle at the takeoff point of the 180. */
const LIP_ANGLE = Math.abs(Math.atan(BANK * CURVE / HALF_WIDTH * (LIP_X / HALF_WIDTH) ** (CURVE - 1)))
/**
 * Sideways speed (m/s) at the lip on runs into or out of a 180. It matches the speed with which
 * he leaves (and comes back to) the lip in the air – so he never stops at the lip, only at the top.
 */
const LIP_SPEED_X = AIR180_RISE * Math.PI / AIR180_SECONDS * Math.cos(LIP_ANGLE)
/** Roughly the fastest he gets at the bottom – used to scale the crouch. */
const TOP_SPEED = 1.9

/**
 * Position along a run as a cubic Hermite curve: starts and ends at the given sideways speeds
 * (0 on a platform, LIP_SPEED_X at a lip), fastest in between.
 */
function rideX(segment: Segment, u: number): { x: number; velocity: number } {
  const span = segment.to - segment.from
  const endSpeed = (x: number) => (Math.abs(x) < HALF_WIDTH ? LIP_SPEED_X * segment.direction : 0)
  const m0 = (endSpeed(segment.from) * segment.duration) / span
  const m1 = (endSpeed(segment.to) * segment.duration) / span
  const u2 = u * u
  const u3 = u2 * u
  const f = (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1
  const df = (3 * u2 - 4 * u + 1) * m0 + (-6 * u2 + 6 * u) + (3 * u2 - 2 * u) * m1
  return { x: segment.from + span * f, velocity: (span * df) / segment.duration }
}

function segmentAt(time: number): { segment: Segment; u: number } {
  const t = ((time % LOOP) + LOOP) % LOOP
  const segment = SEGMENTS.find((s) => t < s.start + s.duration) ?? SEGMENTS[SEGMENTS.length - 1]
  return { segment, u: THREE.MathUtils.clamp((t - segment.start) / segment.duration, 0, 1) }
}

export function createSkiHalfpipe(material: THREE.Material) {
  const group = new THREE.Group()
  const skier = createSkier(material)
  skier.group.scale.setScalar(SKIER_SCALE)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 20),
    new THREE.MeshBasicMaterial({ color: '#607ca0', opacity: 0.25, transparent: true, depthWrite: false }),
  )
  shadow.scale.set(SKIER_SCALE * 3, SKIER_SCALE * 1.8, 1)
  group.add(new THREE.Mesh(buildPipe(), material), shadow, skier.group)

  return {
    group,
    update(time: number): void {
      const { segment, u } = segmentAt(time)
      const { kind, direction } = segment
      const riding = kind === 'ride'

      // Riding: still on a platform, but carrying speed through a lip into or out of a 180.
      const ride = riding ? rideX(segment, u) : null
      const x = ride ? ride.x : segment.to
      // How fast he goes (0–1): in the 180 the speed along the wall fades to zero at the top and comes back.
      const speed = ride
        ? Math.min(1, Math.abs(ride.velocity) / TOP_SPEED)
        : kind === 'air180' ? (LIP_SPEED_X / TOP_SPEED) * Math.abs(Math.cos(Math.PI * u)) : 0

      // Facing: along the direction of travel; at the end of a run turn around for the next one –
      // slowly on the platform, as a quick 180 in the air over the lip.
      const arriving = direction > 0 ? FACING_RIGHT : FACING_LEFT
      const leaving = direction > 0 ? FACING_LEFT : FACING_RIGHT
      const turn = kind === 'stand'
        ? smooth(THREE.MathUtils.clamp((u - 0.25) / 0.45, 0, 1))
        : kind === 'air180' ? smooth(THREE.MathUtils.clamp((u - 0.15) / 0.7, 0, 1)) : 0
      const facing = arriving + (leaving - arriving) * turn

      // 360 hop over the bottom of the pipe on some runs (vertical, sin² – no jolt at takeoff/landing).
      const hop = riding && segment.hop360 ? THREE.MathUtils.clamp((u - 0.38) / 0.24, 0, 1) : 0
      const lift = Math.sin(Math.PI * hop) ** 2
      const spin = hop > 0 ? (1 - Math.cos(Math.PI * hop)) / 2 : 0

      // Halfpipe 180: he keeps the tilt of the wall, shoots up past the lip along the wall's line,
      // spins around his own body axis at the top and drops back in facing down the wall.
      // sin: leaves the lip with the speed he came up with, slows to a stop at the top, falls back.
      const rise = kind === 'air180' ? Math.sin(Math.PI * u) : 0

      // Tilt with the wall. Only where he rides onto a platform does he straighten up before the lip;
      // on runs that end or start with a 180 he stays tilted all the way up.
      const side = Math.sign(x) || 1
      const end = Math.sign(segment.to) === side ? segment.to : segment.from
      const toPlatform = kind === 'stand' || (riding && Math.abs(end) > HALF_WIDTH)
      const lip = toPlatform ? smooth(THREE.MathUtils.clamp((Math.abs(x) - (HALF_WIDTH - LIP_EASE)) / LIP_EASE, 0, 1)) : 0
      const bank = surfaceAngle(x) * (1 - lip)
      // Up the wall at the takeoff point: outward and up along the tangent.
      const up = { x: side * Math.cos(Math.abs(bank)), y: Math.sin(Math.abs(bank)) }

      // Follow the packed surface; the loose powder above covers the skis wherever they dip in.
      // Where he rides on or off a platform, the hard edge is rounded off so he rolls over it smoothly.
      const edge = toPlatform ? smooth(THREE.MathUtils.clamp((Math.abs(x) - (HALF_WIDTH - EDGE_IN)) / (EDGE_IN + EDGE_OUT), 0, 1)) : 0
      const skiY = surfaceY(Math.sign(x) * Math.min(Math.abs(x), HALF_WIDTH)) * (1 - edge) + DECK_Y * edge

      // On the platform: settle in, catch breath, then crouch to drop in.
      const settle = kind === 'stand' ? smooth(THREE.MathUtils.clamp(u / 0.2, 0, 1)) : 0
      const ready = kind === 'stand' ? smooth(THREE.MathUtils.clamp((u - 0.65) / 0.35, 0, 1)) : 0
      const breathe = kind === 'stand' ? Math.sin(time * 3.2) * 0.03 * settle * (1 - ready) : 0
      const duck = kind === 'stand'
        ? 0.2 + (0.06 - 0.2) * settle + breathe + ready * 0.34
        : (0.2 + 0.24 * speed) * (1 - lift) + 0.15 * rise

      // The skis sit a little inside the powder – only the elf above the snow is visible.
      // Slight drift towards the front in the middle of the pipe – depends on position, so it never jumps.
      const z = -0.04 + 0.08 * (1 - Math.min(1, (x / STAND_X) ** 2))
      const out = rise * AIR180_RISE
      skier.group.position.set(x + up.x * out, skiY + 0.008 + lift * 0.3 + up.y * out, z)
      skier.group.rotation.z = bank * (1 - lift * 0.84)
      // Grab-style pose in the 180: arms out, skis tucked a little.
      const style = Math.max(lift, rise * 0.8)
      skier.pose({ duck, jump: Math.max(lift, rise * 0.6), style, spin, carve: 0, facing, time })

      shadow.position.set(x, surfaceY(x) + POWDER + 0.006, z)
      shadow.rotation.set(-Math.PI / 2, 0, bank, 'ZXY')
      shadow.material.opacity = 0.25 - Math.max(lift, rise) * 0.15
    },
    dispose() {
      group.removeFromParent()
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose()
      })
      shadow.material.dispose()
    },
  }
}
