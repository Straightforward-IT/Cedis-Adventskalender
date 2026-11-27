import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { SquirrelHead } from '../../../ui/SquirrelHead.tsx'
import type { MinigameProps } from '../../types.ts'
import { fullAmmo, GOAL, MAX_AMMO, restoreHits, roll, take } from './model.ts'
import type { Ammo } from './model.ts'
import { SnowballScene } from './SnowballScene.ts'
import type { Stage } from './SnowballScene.ts'
import './snowball.css'

/** Unterer Teil der Fläche: Hier wird im Schnee gerollt statt geworfen. */
const ROLL_ZONE = 0.24

export default function SnowballGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<SnowballScene | null>(null)
  const [startHits] = useState(() => restoreHits(savedState))
  const [hits, setHits] = useState(startHits)
  const [stage, setStage] = useState<Stage>(startHits > 0 ? 'play' : 'intro')
  const [ammo, setAmmo] = useState<Ammo>(fullAmmo)
  const [empty, setEmpty] = useState(0)
  const [bump, setBump] = useState(0)
  const rolling = useRef<{ id: number; x: number; y: number } | null>(null)
  const hitCount = useRef(startHits)
  const save = useEffectEvent(saveState)

  useEffect(() => {
    if (!canvas.current) return
    const instance = new SnowballScene(canvas.current, {
      onStage: setStage,
      onHit: () => {
        const next = Math.min(GOAL, hitCount.current + 1)
        hitCount.current = next
        setHits(next)
        setBump((n) => n + 1)
        save({ hits: next })
        if (next >= GOAL) instance.finish()
      },
      onMiss: () => {},
    }, startHits > 0)
    scene.current = instance
    return () => {
      instance.dispose()
      scene.current = null
    }
    // Die Szene entsteht einmal pro Besuch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inRollZone = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY - rect.top > rect.height * (1 - ROLL_ZONE)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (stage !== 'play') return
    if (inRollZone(event)) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ohne Capture endet das Rollen eben am Rand.
      }
      rolling.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      return
    }
    const next = take(ammo)
    if (!next) {
      setEmpty((n) => n + 1)
      return
    }
    setAmmo(next)
    scene.current?.throwAt(event.clientX, event.clientY)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = rolling.current
    if (!start || start.id !== event.pointerId) return
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    rolling.current = { ...start, x: event.clientX, y: event.clientY }
    setAmmo((a) => roll(a, distance))
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (rolling.current?.id === event.pointerId) rolling.current = null
  }

  const done = stage === 'done'
  const status =
    stage === 'intro' ? 'Psst … da drüben raschelt es.'
      : done ? 'Zehn Treffer! Die Eichhörnchen geben auf. 🐿️'
        : ammo.balls === 0 ? 'Keine Schneebälle mehr – roll unten im Schnee neue!'
          : 'Tipp auf die Eichhörnchen, um sie abzuwerfen!'

  return (
    <div className="snowball" data-stage={stage}>
      <div
        className="snowball__view"
        role="application"
        aria-label="Schneeballschlacht: Tippe auf Eichhörnchen, um zu werfen. Unten im Schnee wischen formt neue Schneebälle."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <canvas ref={canvas} className="snowball__canvas" />

        {stage !== 'intro' && (
          <>
            <div className="snowball__score" aria-hidden="true">
              <SquirrelHead className="snowball__head" />
              <span key={bump} className="snowball__count">{hits}</span>
              <span className="snowball__goal">/ {GOAL}</span>
            </div>

            {!done && (
              <div className="snowball__roll" data-full={ammo.balls >= MAX_AMMO} aria-hidden="true">
                <div className="snowball__ammo">
                  {Array.from({ length: MAX_AMMO }, (_, i) => (
                    <span key={i} data-filled={i < ammo.balls} data-empty-flash={ammo.balls === 0 ? empty : undefined} />
                  ))}
                </div>
                {ammo.balls < MAX_AMMO && (
                  <div className="snowball__forming">
                    <span style={{ transform: `scale(${0.25 + ammo.forming * 0.75})` }} />
                    <em>↔ Hier im Schnee rollen</em>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {stage === 'intro' && (
          <button type="button" className="snowball__skip" onPointerDown={(e) => e.stopPropagation()} onClick={() => scene.current?.skipIntro()}>
            Überspringen ›
          </button>
        )}
      </div>

      <p className="snowball__hint" role="status">{status}</p>

      {done && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
