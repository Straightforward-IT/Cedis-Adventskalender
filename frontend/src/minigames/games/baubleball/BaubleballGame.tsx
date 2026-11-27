import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { BaubleballScene } from './BaubleballScene.ts'
import type { Stage } from './BaubleballScene.ts'
import { GOAL, meter, restore, simulate, SPOTS, sweetZone } from './model.ts'
import type { Flight, Hit } from './model.ts'
import './baubleball.css'

type Tone = 'info' | 'good' | 'bad'

const HIT_TEXT: Record<Hit, string> = {
  rim: 'an den Ring',
  board: 'ans Brett',
  wall: 'an die Garage',
  house: 'an die Hauswand',
  ground: 'auf die Straße',
}

export default function BaubleballGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<BaubleballScene | null>(null)
  const [start] = useState(() => restore(savedState))
  const [stage, setStage] = useState<Stage>(start.scored > 0 ? 'play' : 'intro')
  const [scored, setScored] = useState(start.scored)
  const [shattered, setShattered] = useState(start.shattered)
  const [message, setMessage] = useState<{ text: string; tone: Tone; key: number } | null>(null)
  const [holding, setHolding] = useState(false)
  const counts = useRef({ ...start })
  const hold = useRef<{ id: number; since: number; frame: number } | null>(null)
  const lastPower = useRef(0)
  const needle = useRef<HTMLDivElement>(null)

  const spot = SPOTS[Math.min(scored, SPOTS.length - 1)]
  const zone = useMemo(() => sweetZone(spot), [spot])
  const zoneRef = useRef(zone)
  zoneRef.current = zone

  const say = (text: string, tone: Tone = 'info') => setMessage((m) => ({ text, tone, key: (m?.key ?? 0) + 1 }))

  useEffect(() => {
    if (!canvas.current) return
    const instance = new BaubleballScene(canvas.current, {
      onStage: setStage,
      onScore: () => say('Swish! Sauber durch den Ring … 🎄', 'good'),
      onLanded: (flight: Flight) => {
        const c = counts.current
        if (flight.scored) {
          c.scored = Math.min(GOAL, c.scored + 1)
          setScored(c.scored)
          saveState({ ...c })
          if (c.scored >= GOAL) {
            instance.finish()
          } else {
            say(`Treffer ${c.scored} von ${GOAL}! Unten zerspringt sie in tausend Glitzer. Weiter zum nächsten Platz …`, 'good')
            instance.goTo(c.scored)
          }
          return
        }
        c.shattered++
        setShattered(c.shattered)
        saveState({ ...c })
        const power = lastPower.current
        const z = zoneRef.current
        const why = power < z.from ? 'Zu wenig Kraft' : power > z.to ? 'Zu viel Kraft' : 'Knapp'
        say(`Klirr! ${why} – die Kugel ist ${HIT_TEXT[flight.hit]} geknallt und zersprungen.`, 'bad')
      },
    }, start.scored, start.scored > 0)
    scene.current = instance
    return () => {
      instance.dispose()
      scene.current = null
    }
    // Die Szene entsteht einmal pro Besuch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    if (hold.current) cancelAnimationFrame(hold.current.frame)
  }, [])

  const beginHold = (id: number) => {
    if (stage !== 'play' || hold.current || !scene.current?.ready) return
    const since = performance.now()
    if (needle.current) needle.current.style.bottom = '0%'
    const loop = () => {
      const state = hold.current
      if (!state) return
      const power = meter((performance.now() - state.since) / 1000)
      if (needle.current) needle.current.style.bottom = `${power * 100}%`
      scene.current?.windUp(power)
      state.frame = requestAnimationFrame(loop)
    }
    hold.current = { id, since, frame: requestAnimationFrame(loop) }
    setHolding(true)
  }

  const release = (id: number) => {
    const state = hold.current
    if (!state || state.id !== id) return
    cancelAnimationFrame(state.frame)
    hold.current = null
    setHolding(false)
    const power = meter((performance.now() - state.since) / 1000)
    lastPower.current = power
    if (needle.current) needle.current.style.bottom = `${power * 100}%`
    scene.current?.throw(simulate(spot, power))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture endet der Wurf eben, wenn der Finger die Fläche verlässt.
    }
    beginHold(event.pointerId)
  }

  useEffect(() => {
    // Leertaste: gedrückt halten und loslassen – wie mit dem Finger.
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      event.preventDefault()
      beginHold(-1)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      release(-1)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const done = stage === 'done'
  const status = done
    ? `Alle ${GOAL} Kugeln versenkt – die Garage glitzert! ✨`
    : message?.text
      ?? (stage === 'intro'
        ? 'Tock, tock, tock! Zwischen Haus 14 und 15 wird ein Korb an die Garage geschlagen …'
        : `${spot.name}: Halte gedrückt, um Schwung zu holen – und lass im grünen Bereich los.`)

  return (
    <div className="baubleball" data-stage={stage}>
      <div
        className="baubleball__view"
        role="application"
        aria-label="Weihnachtskugelball: Gedrückt halten lädt die Kraft, loslassen wirft. Auch mit der Leertaste."
        onPointerDown={onPointerDown}
        onPointerUp={(e) => release(e.pointerId)}
        onPointerCancel={(e) => release(e.pointerId)}
      >
        <canvas ref={canvas} className="baubleball__canvas" />

        {stage !== 'intro' && (
          <div className="baubleball__score" aria-label={`${scored} von ${GOAL} Kugeln im Korb, ${shattered} zersprungen`}>
            <span aria-hidden="true">🎄</span>
            <span key={scored} className="baubleball__count">{scored}</span>
            <span className="baubleball__goal">/ {GOAL}</span>
            {shattered > 0 && <span className="baubleball__broken" aria-hidden="true">💥 {shattered}</span>}
          </div>
        )}

        {stage === 'play' && (
          <div className="baubleball__meter" data-holding={holding} aria-hidden="true">
            <div className="baubleball__zone" style={{ bottom: `${zone.from * 100}%`, height: `${(zone.to - zone.from) * 100}%` }} />
            <div ref={needle} className="baubleball__needle" />
            <span className="baubleball__meter-label">Kraft</span>
          </div>
        )}

        {stage === 'play' && (
          <div className="baubleball__spots" aria-hidden="true">
            {SPOTS.map((s, i) => (
              <span key={s.name} data-state={i < scored ? 'done' : i === scored ? 'now' : 'next'} />
            ))}
          </div>
        )}

        {stage === 'intro' && (
          <button type="button" className="baubleball__skip" onPointerDown={(e) => e.stopPropagation()} onClick={() => scene.current?.skipIntro()}>
            Überspringen ›
          </button>
        )}
      </div>

      <p className="baubleball__hint" role="status" data-tone={done ? 'good' : message?.tone ?? 'info'} key={message?.key}>{status}</p>

      {done && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
