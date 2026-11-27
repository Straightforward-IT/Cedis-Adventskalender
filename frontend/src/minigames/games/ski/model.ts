export type Lane = -1 | 0 | 1
export type SkiAction = 'left' | 'right' | 'jump' | 'duck'
export type BarrierHeight = 'low' | 'high'

export type CourseFeature =
  | { distance: number; kind: 'tree'; lanes: readonly Lane[] }
  | { distance: number; kind: 'log' | 'cane'; height: BarrierHeight }
  | { distance: number; kind: 'ramp'; lane: Lane }

export const LANE_WIDTH = 2.15
export const TRACK_HALF_WIDTH = 3.75
export const FINISH = 330
export const FINISH_RUNOUT = 130
export const CHECKPOINTS = [0, 109, 217] as const
export const GRADE = 0.065
export const RAMP_LENGTH = 5.6
export const RAMP_HEIGHT = 1.08
export const BARRIERS = {
  low: { bottom: 0.06, top: 0.66 },
  high: { bottom: 1.13, top: 1.71 },
} as const

export const COURSE: readonly CourseFeature[] = [
  { distance: 25, kind: 'tree', lanes: [0] },
  { distance: 47, kind: 'log', height: 'low' },
  { distance: 69, kind: 'log', height: 'high' },
  { distance: 92, kind: 'ramp', lane: 0 },
  { distance: 123, kind: 'tree', lanes: [-1, 0] },
  { distance: 145, kind: 'cane', height: 'low' },
  { distance: 168, kind: 'ramp', lane: 1 },
  { distance: 192, kind: 'cane', height: 'high' },
  { distance: 234, kind: 'tree', lanes: [0, 1] },
  { distance: 254, kind: 'log', height: 'low' },
  { distance: 275, kind: 'ramp', lane: -1 },
  { distance: 298, kind: 'cane', height: 'high' },
  { distance: 316, kind: 'tree', lanes: [-1, 0] },
]

const DUCK_SECONDS = 1.12
const HOP_SECONDS = 1.04
const RAMP_SECONDS = 1.43
const RAMP_HALF_WIDTH = 0.94
const TREE_REACH = 1.1
const RECOVERY_SECONDS = 0.85

type Motion =
  | { kind: 'hop' | 'duck'; time: number }
  | { kind: 'ramp'; time: number; spinAt: number | null }

export interface SkiProgress {
  checkpoint: number
  styleJumps: number
  finished: boolean
}

export interface Run extends SkiProgress {
  distance: number
  x: number
  lane: Lane
  nextFeature: number
  motion: Motion | null
  recovery: number
  queuedSpin: boolean
}

export type RunEvent = 'bump' | 'cross' | 'spin'

export const slopeHeight = (distance: number): number => -GRADE * Math.max(0, distance)
export const laneX = (lane: Lane): number => lane * LANE_WIDTH
export const rampRise = (fraction: number): number => RAMP_HEIGHT * fraction ** 2

export function restoreProgress(value: unknown): SkiProgress {
  if (typeof value !== 'object' || value === null) return { checkpoint: 0, styleJumps: 0, finished: false }
  const { checkpoint, styleJumps, finished } = value as Partial<SkiProgress>
  return {
    checkpoint: typeof checkpoint === 'number' && Number.isInteger(checkpoint) && checkpoint >= 0 && checkpoint < CHECKPOINTS.length ? checkpoint : 0,
    styleJumps: typeof styleJumps === 'number' && Number.isInteger(styleJumps) ? Math.min(3, Math.max(0, styleJumps)) : 0,
    finished: finished === true,
  }
}

export function createRun(progress: SkiProgress): Run {
  const distance = progress.finished ? FINISH : CHECKPOINTS[progress.checkpoint]
  return {
    ...progress,
    distance,
    x: 0,
    lane: 0,
    nextFeature: COURSE.filter((feature) => feature.distance < distance).length,
    motion: null,
    recovery: 0,
    queuedSpin: false,
  }
}

function isOnRamp(run: Run, feature: CourseFeature | undefined, approach = 0): feature is Extract<CourseFeature, { kind: 'ramp' }> {
  return feature?.kind === 'ramp' && Math.abs(run.x - laneX(feature.lane)) <= RAMP_HALF_WIDTH &&
    run.distance >= feature.distance - RAMP_LENGTH - approach && run.distance <= feature.distance
}

export function trigger(run: Run, action: SkiAction): void {
  if (run.finished) return
  if (action === 'left' || action === 'right') {
    run.lane = Math.max(-1, Math.min(1, run.lane + (action === 'left' ? -1 : 1))) as Lane
    return
  }

  const motion = run.motion
  if (motion?.kind === 'ramp' && action === 'jump' && motion.spinAt === null && motion.time < 0.72) {
    motion.spinAt = motion.time
  } else if (!motion && action === 'jump' && isOnRamp(run, COURSE[run.nextFeature], 1.8)) {
    run.queuedSpin = true
  } else if (!motion) {
    run.motion = { kind: action === 'jump' ? 'hop' : 'duck', time: 0 }
  }
}

export function motionFraction(run: Run): number {
  const motion = run.motion
  if (!motion) return 0
  const length = motion.kind === 'duck' ? DUCK_SECONDS : motion.kind === 'hop' ? HOP_SECONDS : RAMP_SECONDS
  return Math.min(1, motion.time / length)
}

export function duckAmount(run: Run): number {
  if (run.motion?.kind !== 'duck') return 0
  const time = run.motion.time
  const amount = Math.max(0, Math.min(1, time / 0.12, (DUCK_SECONDS - time) / 0.18))
  return amount * amount * (3 - 2 * amount)
}

export function rampFraction(run: Run): number {
  const feature = COURSE[run.nextFeature]
  if (!isOnRamp(run, feature)) return 0
  return 1 - (feature.distance - run.distance) / RAMP_LENGTH
}

export function skiHeight(run: Run): number {
  const fraction = motionFraction(run)
  const arc = 4 * fraction * (1 - fraction)
  if (run.motion?.kind === 'hop') return 1.36 * arc
  if (run.motion?.kind === 'ramp') return 2.12 * arc + RAMP_HEIGHT * (1 - fraction)
  return rampRise(rampFraction(run))
}

export function spinFraction(run: Run): number {
  const motion = run.motion
  if (motion?.kind !== 'ramp' || motion.spinAt === null) return 0
  const fraction = (motion.time - motion.spinAt) / (RAMP_SECONDS - motion.spinAt)
  return Math.min(1, fraction * fraction * (3 - 2 * fraction))
}

function blocks(run: Run, feature: Exclude<CourseFeature, { kind: 'ramp' }>): boolean {
  if (feature.kind === 'tree') return feature.lanes.some((lane) => Math.abs(run.x - laneX(lane)) < TREE_REACH)
  const feet = skiHeight(run)
  const top = feet + 1.87 - duckAmount(run) * 1.04
  const barrier = BARRIERS[feature.height]
  return feet < barrier.top && top > barrier.bottom
}

function move(run: Run, dt: number, speed: number): RunEvent | undefined {
  run.distance = Math.min(FINISH, run.distance + speed * dt)
  run.x += (laneX(run.lane) - run.x) * (1 - Math.exp(-dt * 14))
  run.recovery = Math.max(0, run.recovery - dt)
  if (!run.motion) return

  run.motion.time += dt
  if (motionFraction(run) < 1) return
  const motion = run.motion
  run.motion = null
  if (motion.kind === 'ramp') {
    run.styleJumps++
    return motion.spinAt === null ? 'cross' : 'spin'
  }
}

/** Evaluate each feature at its crossing, even when a frame steps past it. */
export function advanceRun(run: Run, dt: number): RunEvent | undefined {
  if (run.finished || dt <= 0) return
  const speed = (8.6 + 3.5 * run.distance / FINISH) * (run.recovery > 0 ? 0.57 : 1)
  const feature = COURSE[run.nextFeature]
  let event: RunEvent | undefined

  if (feature && run.distance + speed * dt >= feature.distance) {
    const before = Math.max(0, (feature.distance - run.distance) / speed)
    event = move(run, before, speed)
    run.distance = feature.distance
    if (feature.kind === 'ramp') {
      if (isOnRamp(run, feature) && run.motion?.kind !== 'hop') {
        run.motion = { kind: 'ramp', time: 0, spinAt: run.queuedSpin ? 0 : null }
      }
      run.queuedSpin = false
    } else if (blocks(run, feature)) {
      run.motion = null
      run.recovery = RECOVERY_SECONDS
      event = 'bump'
    }
    run.nextFeature++
    dt -= before
  }

  event = move(run, dt, event === 'bump' ? speed * 0.57 : speed) ?? event
  const nextCheckpoint = CHECKPOINTS[run.checkpoint + 1]
  if (nextCheckpoint !== undefined && run.distance >= nextCheckpoint) run.checkpoint++
  run.finished = run.distance >= FINISH
  return event
}
