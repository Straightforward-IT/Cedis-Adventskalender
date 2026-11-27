import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { drawWorld, presentSparkles } from './draw.ts'
import type { Sparkle, View } from './draw.ts'
import { createWorld, GOAL, isDone, restore, step, WIDTH } from './model.ts'
import './cookiejump.css'

type Stage = 'ready' | 'play' | 'done'

export default function CookieJumpGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [start] = useState(() => restore(savedState))
  const world = useRef(createWorld(start))
  const [stage, setStage] = useState<Stage>('ready')
  const stageRef = useRef<Stage>('ready')
  const [collected, setCollected] = useState(start)
  const [message, setMessage] = useState<string | null>(null)
  /** Gedrückte Finger: wo sie aufgesetzt haben und wohin sie gerade lenken (−1 … 1). */
  const pointers = useRef(new Map<number, { anchor: number; steer: number }>())
  const keys = useRef({ left: false, right: false })

  const begin = () => {
    if (stageRef.current !== 'ready') return
    stageRef.current = 'play'
    setStage('play')
  }

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    let frame = 0
    let last = 0
    let sparkles: Sparkle[] = []
    const view: View = { width: 0, height: 0, scale: 1 }

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      view.width = element.clientWidth * ratio
      view.height = element.clientHeight * ratio
      view.scale = view.width / WIDTH
      element.width = view.width
      element.height = view.height
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()

    const tick = (now: number) => {
      const dt = last ? Math.min(0.04, (now - last) / 1000) : 1 / 60
      last = now
      const w = world.current
      if (stageRef.current !== 'ready') {
        const fingers = [...pointers.current.values()]
        const steer = (fingers.length ? fingers[fingers.length - 1].steer : 0) || (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
        // In kleinen Schritten rechnen, damit Santa auch bei Rucklern nicht durch Plätzchen fällt.
        for (let rest = dt; rest > 1e-6; rest -= 1 / 120) {
          const events = step(w, Math.min(rest, 1 / 120), stageRef.current === 'done' ? 0 : steer)
          for (const present of events.presents) {
            sparkles.push(...presentSparkles(view, w, present))
            setCollected(w.collected)
            saveState({ presents: w.collected })
            if (isDone(w) && stageRef.current !== 'done') {
              stageRef.current = 'done'
              setStage('done')
              setMessage('Alle acht Geschenke eingesammelt – ho ho ho! 🎁')
            } else if (!isDone(w)) {
              setMessage(`Geschenk ${w.collected} von ${GOAL}! Weiter nach oben …`)
            }
          }
          if (events.rescued) setMessage('Hoppla! Ein Schneewölkchen hat Santa aufgefangen. ☁️')
        }
      }
      sparkles = sparkles.filter((s) => s.t < s.life)
      for (const s of sparkles) {
        s.t += dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vy += 120 * dt
      }
      if (view.width) drawWorld(context, view, w, sparkles)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    if (import.meta.env.DEV) Object.assign(window, { __cookiejump: world })

    const key = (down: boolean) => (event: KeyboardEvent) => {
      const k = event.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.current.left = down
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.current.right = down
      else if (down && (k === ' ' || k === 'Enter') && stageRef.current === 'ready') begin()
      else return
      event.preventDefault()
      if (down) begin()
    }
    const onDown = key(true)
    const onUp = key(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
    // Spielwelt und Schleife entstehen einmal pro Besuch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Lenken durch Ziehen: Wo der Finger aufsetzt, passiert noch nichts. Erst das Ziehen nach
   * links oder rechts lenkt – je weiter, desto schneller (wie ein kleiner Joystick).
   */
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    begin()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture endet das Lenken eben am Rand.
    }
    pointers.current.set(event.pointerId, { anchor: event.clientX, steer: 0 })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const finger = pointers.current.get(event.pointerId)
    if (!finger) return
    const rect = event.currentTarget.getBoundingClientRect()
    // Ein kleiner toter Bereich gegen Zittern; volle Fahrt nach gut einem Achtel der Breite.
    const dead = 6
    const full = rect.width / 8
    const dx = event.clientX - finger.anchor
    const amount = Math.max(0, Math.abs(dx) - dead) / full
    finger.steer = Math.sign(dx) * Math.min(1, amount)
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
  }

  const done = stage === 'done'
  const hint = done
    ? 'Alle acht Geschenke eingesammelt – ho ho ho! 🎁'
    : message ?? 'Finger aufsetzen und nach links oder rechts ziehen (oder ← →), um Santa zu lenken. Springen geht von allein!'

  return (
    <div className="cookiejump" data-stage={stage}>
      <div
        className="cookiejump__view"
        role="application"
        aria-label="Plätzchen-Hüpfer: Finger aufsetzen und zur Seite ziehen lenkt Santa, auch mit den Pfeiltasten."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <canvas ref={canvas} className="cookiejump__canvas" />
        <div className="cookiejump__score" aria-label={`${collected} von ${GOAL} Geschenken`}>
          <span aria-hidden="true">🎁</span>
          <span key={collected} className="cookiejump__count">{collected}</span>
          <span className="cookiejump__goal">/ {GOAL}</span>
        </div>
        {stage === 'ready' && (
          <div className="cookiejump__start">
            <strong>Tippe, um loszuhüpfen!</strong>
            <span>Zum Lenken nach links oder rechts ziehen</span>
          </div>
        )}
      </div>

      <p className="cookiejump__hint" role="status" data-done={done}>{hint}</p>

      {done && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
