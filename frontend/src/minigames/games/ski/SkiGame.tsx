import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { eveningMoonPhase } from '../../../lib/moon.ts'
import { useStore } from '../../../state/store.ts'
import type { MinigameProps } from '../../types.ts'
import { SkiScene } from './SkiScene.ts'
import type { SkiMeter, SkiStage } from './SkiScene.ts'
import { CHECKPOINTS, FINISH, restoreProgress } from './model.ts'
import type { RunEvent, SkiAction } from './model.ts'
import './ski.css'

const KEYS: Readonly<Record<string, SkiAction>> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowDown: 'duck', s: 'duck', ArrowUp: 'jump', w: 'jump', ' ': 'jump',
}

const CONTROLS = [
  { action: 'left', icon: '←', label: 'Links' },
  { action: 'right', icon: '→', label: 'Rechts' },
  { action: 'duck', icon: '↓', label: 'Ducken' },
  { action: 'jump', icon: '↑', label: 'Springen' },
] as const

const FEEDBACK: Record<RunEvent, string> = {
  bump: 'Weiter geht’s!',
  cross: 'Kreuzsprung gelandet!',
  spin: '360° gelandet!',
}

function courseHint(cue: SkiMeter['cue']): { icon: string; text: string } | null {
  if (!cue) return null
  if (cue === 'spin') return { icon: '↑', text: 'Jetzt drücken oder wischen für 360°' }
  if (cue.kind === 'tree') return { icon: '↔', text: 'Tannen ausweichen' }
  if (cue.kind === 'ramp') {
    const direction = cue.lane === -1 ? 'links' : cue.lane === 1 ? 'rechts' : 'in der Mitte'
    return { icon: '↗', text: `Schanze ${direction}` }
  }
  const obstacle = cue.kind === 'cane' ? 'Zuckerstange' : 'Baumstamm'
  if (cue.height === 'low') return { icon: '↑', text: `${obstacle} überspringen` }
  return { icon: '↓', text: `Unter ${cue.kind === 'cane' ? 'der Zuckerstange' : 'dem Baumstamm'} ducken` }
}

export default function SkiGame({ day, savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const stageAction = useRef<HTMLButtonElement>(null)
  const scene = useRef<SkiScene | null>(null)
  const pointer = useRef<{ id: number; x: number; y: number; used: boolean } | null>(null)
  const [visit] = useState(() => {
    const { today, moonDate } = useStore.getState()
    return { progress: restoreProgress(savedState), moonPhase: eveningMoonPhase(moonDate ?? today) }
  })
  const [stage, setStage] = useState<SkiStage>('intro')
  const [meter, setMeter] = useState<SkiMeter>({ distance: 0, styleJumps: 0, cue: null })
  const [feedback, setFeedback] = useState<RunEvent | null>(null)
  const save = useEffectEvent(saveState)

  useEffect(() => {
    if (!canvas.current) return
    let hideFeedback: ReturnType<typeof setTimeout> | undefined
    const instance = new SkiScene(canvas.current, day, visit.progress, visit.moonPhase, {
      onStage: setStage,
      onMeter: setMeter,
      onSave: (progress) => save(progress),
      onEvent: (event) => {
        clearTimeout(hideFeedback)
        setFeedback(event)
        hideFeedback = setTimeout(() => setFeedback(null), 1200)
      },
    })
    scene.current = instance
    return () => {
      clearTimeout(hideFeedback)
      instance.dispose()
      scene.current = null
    }
  }, [day, visit])

  useEffect(() => {
    if (stage === 'paused' || stage === 'finished') stageAction.current?.focus({ preventScroll: true })
  }, [stage])

  function start() {
    scene.current?.start()
    view.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      if (event.repeat || (stage !== 'running' && stage !== 'paused')) return
      event.preventDefault()
      if (stage === 'paused') start()
      else scene.current?.pause()
      return
    }
    const action = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
    if (stage !== 'running' || !action || (event.key === ' ' && event.target instanceof HTMLButtonElement)) return
    event.preventDefault()
    if (!event.repeat) scene.current?.act(action)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (stage !== 'running' || pointer.current || event.button !== 0) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, used: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function readSwipe(event: PointerEvent<HTMLDivElement>) {
    const gesture = pointer.current
    if (gesture?.id !== event.pointerId || gesture.used) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 27) return
    gesture.used = true
    if (Math.abs(dx) > Math.abs(dy)) scene.current?.act(dx < 0 ? 'left' : 'right')
    else scene.current?.act(dy < 0 ? 'jump' : 'duck')
  }

  function endSwipe(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId) return
    pointer.current = null
  }

  const hint = courseHint(meter.cue)
  const cue = meter.cue
  const actNow = cue === 'spin' || (cue && (cue.kind === 'log' || cue.kind === 'cane') && cue.distance - meter.distance <= 6)
  return (
    <div className="ski-game" data-stage={stage} onKeyDown={onKeyDown}>
      <div
        className="ski-game__view"
        role="group"
        aria-label="Skipiste. Links und rechts lenken, nach oben springen, nach unten ducken."
        tabIndex={-1}
        ref={view}
        onPointerDown={onPointerDown}
        onPointerMove={readSwipe}
        onPointerUp={(event) => { readSwipe(event); endSwipe(event) }}
        onPointerCancel={endSwipe}
        onLostPointerCapture={endSwipe}
      >
        <canvas ref={canvas} aria-label="Verschneite Waldpiste mit einem rot gekleideten Wichtel auf Skiern" />
      </div>

      {stage !== 'intro' && (
        <div className="ski-game__hud">
          <div className="ski-game__meter">
            <div className="ski-game__meter-label"><span>Strecke</span><strong>{meter.distance} / {FINISH} m</strong></div>
            <div className="ski-game__track" role="progressbar" aria-label="Strecke" aria-valuemin={0} aria-valuemax={FINISH} aria-valuenow={meter.distance}>
              <i style={{ width: `${100 * meter.distance / FINISH}%` }} />
              {CHECKPOINTS.slice(1).map((distance) => <b key={distance} style={{ left: `${100 * distance / FINISH}%` }} />)}
            </div>
          </div>
          <div className="ski-game__hud-right">
            <span className="ski-game__tricks"><span aria-hidden="true">✦</span> {meter.styleJumps} {meter.styleJumps === 1 ? 'Trick' : 'Tricks'}</span>
            {stage === 'running' && (
              <button type="button" className="ski-game__pause" onClick={() => scene.current?.pause()} aria-label="Fahrt pausieren" title="Fahrt pausieren (P)">
                <i aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'intro' && (
        <button type="button" className="ski-game__skip" onClick={() => scene.current?.skipIntro()}>Kamerafahrt überspringen ›</button>
      )}
      {stage === 'ready' && (
        <div className="ski-game__card">
          <h3>{visit.progress.checkpoint > 0 ? 'Bereit zum Weiterfahren?' : 'Ab auf die Piste!'}</h3>
          <p>Weiche Tannen aus, spring über tiefe Hindernisse und duck dich unter hohen. Fahr über Schanzen für Tricks.</p>
          <p className="ski-game__input-hint">Wische oder benutze die Pfeiltasten.</p>
          <button type="button" className="button ski-game__primary" onClick={start}>{visit.progress.checkpoint > 0 ? 'Weiterfahren' : 'Losfahren'}</button>
        </div>
      )}
      {stage === 'paused' && (
        <div className="ski-game__card">
          <h3>Kurze Pause</h3>
          <button ref={stageAction} type="button" className="button ski-game__primary" onClick={start}>Weiterfahren</button>
        </div>
      )}
      {stage === 'finished' && (
        <div className="ski-game__card">
          <h3>Im Ziel!</h3>
          <button ref={stageAction} type="button" className="button ski-game__primary" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
          </button>
        </div>
      )}
      {stage === 'running' && (
        <div className="ski-game__controls">
          <div className="ski-game__feedback" role="status" data-bump={feedback === 'bump'}>{feedback && FEEDBACK[feedback]}</div>
          {hint && <div className="ski-game__cue" data-now={Boolean(actNow)}><span aria-hidden="true">{hint.icon}</span>{hint.text}</div>}
          <div className="ski-game__buttons" role="group" aria-label="Skisteuerung">
            {CONTROLS.map(({ action, icon, label }) => (
              <button key={action} type="button" onClick={() => scene.current?.act(action)}>
                <span aria-hidden="true">{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
