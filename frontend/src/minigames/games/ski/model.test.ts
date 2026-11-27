import { describe, expect, it } from 'vitest'
import {
  CHECKPOINTS, FINISH, advanceRun, createRun, restoreProgress, skiHeight, spinFraction, trigger,
} from './model.ts'
import type { Run, RunEvent } from './model.ts'

function fresh(): Run {
  return createRun(restoreProgress(undefined))
}

function skiTo(run: Run, distance: number): RunEvent[] {
  const events: RunEvent[] = []
  for (let frame = 0; frame < 2400 && run.distance < distance; frame++) {
    const event = advanceRun(run, 1 / 60)
    if (event) events.push(event)
  }
  expect(run.distance).toBeGreaterThanOrEqual(distance)
  return events
}

describe('House 8 ski course', () => {
  it('clears a fir by changing lanes and recovers from a collision in the same lane', () => {
    const run = fresh()
    trigger(run, 'right')
    trigger(run, 'right')
    expect(run.lane).toBe(1)
    expect(skiTo(run, 26)).toEqual([])

    const collision = fresh()
    expect(skiTo(collision, 26)).toEqual(['bump'])
    expect(collision.recovery).toBeGreaterThan(0)
    expect(skiTo(collision, 37)).toEqual([])
    expect(collision.recovery).toBe(0)
  })

  it('uses the height of each trunk and candy cane for clearance', () => {
    const run = fresh()
    skiTo(run, 42.9)
    trigger(run, 'jump')
    expect(skiTo(run, 48)).toEqual([])
    skiTo(run, 64.8)
    trigger(run, 'duck')
    expect(skiTo(run, 70)).toEqual([])

    skiTo(run, 140.3)
    trigger(run, 'duck')
    expect(skiTo(run, 146)).toEqual(['bump'])
    skiTo(run, 187.3)
    trigger(run, 'jump')
    expect(skiTo(run, 193)).toEqual(['bump'])
  })

  it('lifts the skis on approach, launches the skier, and only counts a trick on landing', () => {
    const run = fresh()
    skiTo(run, 90.5)
    expect(skiHeight(run)).toBeGreaterThan(0.4)
    trigger(run, 'jump')
    skiTo(run, 95)
    expect(run.motion?.kind).toBe('ramp')
    expect(skiHeight(run)).toBeGreaterThan(1.6)
    expect(spinFraction(run)).toBeGreaterThan(0)
    expect(run.styleJumps).toBe(0)
    expect(skiTo(run, 109)).toEqual(['spin'])
    expect(run.styleJumps).toBe(1)

    const skip = fresh()
    trigger(skip, 'left')
    skiTo(skip, 109)
    expect(skip.styleJumps).toBe(0)
  })

  it('resumes from the last marker and stores the finished run for the reward', () => {
    const run = createRun(restoreProgress({ checkpoint: 1, styleJumps: 1 }))
    expect(run.distance).toBe(CHECKPOINTS[1])
    trigger(run, 'right')
    expect(skiTo(run, 185)).toContain('cross')
    expect(run.styleJumps).toBe(2)
    skiTo(run, FINISH)
    expect(run.checkpoint).toBe(2)
    expect(run.finished).toBe(true)
    expect(createRun(restoreProgress(run))).toMatchObject({ distance: FINISH, finished: true })
  })
})
