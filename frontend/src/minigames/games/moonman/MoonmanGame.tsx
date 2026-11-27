import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { MoonScene, SWIPE_STRONG } from './MoonScene.ts'
import type { Stage } from './MoonScene.ts'
import { DECOR, restoreProgress } from './model.ts'
import type { Decor } from './model.ts'
import './moonman.css'

/** Wie weit (Pixel) der Finger vom Startpunkt weg muss, um mit voller Kraft zu rollen. */
const STICK_RANGE = 70

const DECOR_LABEL: Record<Decor, { icon: string; text: string }> = {
  sticks: { icon: '🪵', text: 'Stöcke' },
  coins: { icon: '🪙', text: 'Münzen' },
  helmet: { icon: '🧑‍🚀', text: 'Helm' },
}

const BALL_NAME = ['Bauch', 'Brust', 'Kopf']

function hint(stage: Stage, ball: number, weak: boolean): string {
  switch (stage) {
    case 'intro': return 'Ab zum Mond! 🚀'
    case 'rolling':
      return ball === 0
        ? 'Zieh mit dem Finger und roll die Kugel durch den Mondstaub.'
        : `Jetzt die ${ball === 1 ? 'zweite' : 'letzte'} Kugel – etwas kleiner. Such frischen Staub!`
    case 'moving': return 'Ab vor den Schneemann …'
    case 'aiming': return weak ? 'Kräftiger nach oben wischen!' : 'Wisch nach oben, um die Kugel hochzuwerfen!'
    case 'flying': return weak ? 'Hopp – fast!' : 'Hui …'
    case 'decorate': return 'Schmück deinen Mondstaub-Mann!'
    case 'done': return 'Ein echter Mondstaub-Mann! 🌙'
  }
}

export default function MoonmanGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<MoonScene | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [ball, setBall] = useState(0)
  const [size, setSize] = useState(0)
  const [weak, setWeak] = useState(false)
  const [flash, setFlash] = useState(0)
  const [decor, setDecor] = useState<Decor[]>(() => restoreProgress(savedState)?.decor ?? [])
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const keys = useRef(new Set<string>())
  const save = useEffectEvent(saveState)

  useEffect(() => {
    if (!canvas.current) return
    const instance = new MoonScene(canvas.current, {
      onStage: (next, index) => {
        setStage(next)
        setBall(index)
        if (next === 'rolling') setSize(0)
        if (next === 'aiming' || next === 'rolling') setWeak((w) => (next === 'aiming' ? w : false))
      },
      onSize: setSize,
      onThrow: (result) => setWeak(result === 'weak'),
      onFlash: () => setFlash((n) => n + 1),
      onSave: (progress) => {
        save(progress)
        setDecor(progress.decor)
      },
    }, restoreProgress(savedState))
    scene.current = instance
    return () => {
      instance.dispose()
      scene.current = null
    }
    // Die Szene entsteht einmal pro Besuch; der gemerkte Stand gilt nur beim Start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture geht es auch – dann endet das Ziehen am Rand der Fläche.
    }
    const rect = event.currentTarget.getBoundingClientRect()
    pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    if (stage === 'rolling') setStick({ x: event.clientX - rect.left, y: event.clientY - rect.top, dx: 0, dy: 0 })
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    if (!start || start.id !== event.pointerId || stage !== 'rolling') return
    let dx = event.clientX - start.x
    let dy = event.clientY - start.y
    const length = Math.hypot(dx, dy)
    if (length > STICK_RANGE) {
      dx *= STICK_RANGE / length
      dy *= STICK_RANGE / length
    }
    scene.current?.setDrive(dx / STICK_RANGE, dy / STICK_RANGE)
    setStick((s) => (s ? { ...s, dx, dy } : s))
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    if (!start || start.id !== event.pointerId) return
    pointer.current = null
    scene.current?.setDrive(0, 0)
    setStick(null)
    if (stage === 'aiming') scene.current?.swipe(start.y - event.clientY)
  }

  // Tastatur: Pfeiltasten rollen, Pfeil hoch / Leertaste wirft.
  const updateKeys = () => {
    const k = keys.current
    const x = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0)
    const z = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0)
    scene.current?.setDrive(x, z)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (stage === 'aiming' && (event.key === 'ArrowUp' || event.key === ' ')) {
      event.preventDefault()
      scene.current?.swipe(SWIPE_STRONG)
      return
    }
    if (stage !== 'rolling' || !event.key.startsWith('Arrow')) return
    event.preventDefault()
    keys.current.add(event.key)
    updateKeys()
  }
  const onKeyUp = (event: KeyboardEvent) => {
    keys.current.delete(event.key)
    updateKeys()
  }

  const done = stage === 'done'

  return (
    <div className="moonman" data-stage={stage}>
      <div
        className="moonman__view"
        tabIndex={0}
        role="application"
        aria-label="Mondoberfläche – mit Finger, Maus oder Pfeiltasten rollen, nach oben wischen zum Werfen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => { keys.current.clear(); scene.current?.setDrive(0, 0) }}
      >
        <canvas ref={canvas} className="moonman__canvas" />
        {flash > 0 && <div key={flash} className="moonman__flash" aria-hidden="true" />}

        {(stage === 'rolling' || stage === 'moving') && (
          <div className="moonman__hud" aria-hidden="true">
            <span className="moonman__balls">
              {[0, 1, 2].map((i) => <i key={i} data-state={i < ball ? 'done' : i === ball ? 'now' : 'todo'} style={{ width: `${14 - i * 3}px`, height: `${14 - i * 3}px` }} />)}
            </span>
            <span className="moonman__label">{BALL_NAME[ball]}</span>
            <span className="moonman__size"><span style={{ width: `${Math.round(size * 100)}%` }} /></span>
          </div>
        )}

        {stick && (
          <div className="moonman__stick" style={{ left: stick.x, top: stick.y }} aria-hidden="true">
            <span style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
          </div>
        )}

        {stage === 'aiming' && <div className="moonman__swipe" aria-hidden="true">⇡</div>}

        {stage === 'intro' && (
          <button type="button" className="moonman__skip" onClick={() => scene.current?.skipIntro()}>
            Überspringen ›
          </button>
        )}
      </div>

      <p className="moonman__hint" role="status">{hint(stage, ball, weak)}</p>

      {(stage === 'decorate' || done) && (
        <div className="moonman__decor">
          {DECOR.map((item) => (
            <button
              key={item}
              type="button"
              className="button button--quiet moonman__item"
              disabled={decor.includes(item)}
              onClick={() => scene.current?.addDecor(item)}
            >
              <span aria-hidden="true">{DECOR_LABEL[item].icon}</span> {DECOR_LABEL[item].text}
            </button>
          ))}
        </div>
      )}

      {done && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
