import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import {
  BOARD, BOX, freeLength, isDone, lampColor, lampsAlong, LEVEL, OUTLET_STRIP, OUTLETS, outletNear, plugPose, pointAt,
  pull, restore, slice, startStates, wirePoints,
} from './model.ts'
import type { Cable, CableState, Point } from './model.ts'
import './lights.css'

/** So nah muss der Finger am Stecker sein, um ihn zu greifen. */
const GRAB = 34
/** Lose Stecker bleiben in diesem Bereich – nicht in der Kiste, nicht im Rand. */
const PLUG_AREA = { left: 22, right: BOARD.width - 22, top: 60, bottom: BOX.y - 24 }
/** Oberkante der Schreibtischplatte; darüber Wand und Regalbrett. */
const DESK_Y = 146

type Tone = 'hint' | 'good' | 'done'

const clampPlug = (p: Point): Point => ({
  x: Math.max(PLUG_AREA.left, Math.min(PLUG_AREA.right, p.x)),
  y: Math.max(PLUG_AREA.top, Math.min(PLUG_AREA.bottom, p.y)),
})

const pathOf = (points: readonly Point[]) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')

/** Ein Kabelstück: dunkler Rand, Farbe, ein Glanzstreifen. */
function Wire({ d, cable }: { d: string; cable: Cable }) {
  if (!d) return null
  return (
    <g>
      <path d={d} fill="none" stroke={cable.spec.dark} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={cable.spec.color} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.8 -1.2)" />
    </g>
  )
}

/** Der Netzstecker (zeigt nach +x): Knickschutz, Gehäuse, zwei Stifte. */
function Plug({ cable }: { cable: Cable }) {
  return (
    <g>
      <rect x="-18" y="-5" width="12" height="10" rx="3" fill={cable.spec.dark} />
      <path d="M-9 -11H8Q16 -11 16 -3V3Q16 11 8 11H-9Z" fill="#f5f2ec" stroke={cable.spec.dark} strokeWidth="2" strokeLinejoin="round" />
      <rect x="-5" y="-11" width="4" height="22" fill={cable.spec.color} />
      <rect x="15" y="-6.5" width="11" height="3.6" rx="1.8" fill="#c7ccd2" stroke="#6d7580" strokeWidth="1" />
      <rect x="15" y="2.9" width="11" height="3.6" rx="1.8" fill="#c7ccd2" stroke="#6d7580" strokeWidth="1" />
    </g>
  )
}

/** Ein Lämpchen, das vom Kabel absteht: Fassung und Glaskolben – an oder aus. */
function Lamp({ at, angle, color, lit, index }: { at: Point; angle: number; color: string; lit: boolean; index: number }) {
  return (
    <g
      transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
      className="lights-lamp"
      data-lit={lit}
      style={{ '--lamp': color, '--delay': `${index * 55}ms`, '--twinkle': `${(index * 0.37) % 1.6}s` } as CSSProperties}
    >
      {lit && <circle cx="13" r="15" className="lights-lamp__glow" />}
      <rect x="1" y="-3.8" width="6" height="7.6" rx="1.5" fill="#1f3a26" />
      <ellipse cx="13" rx="7.5" ry="5.4" className="lights-lamp__bulb" />
      <ellipse cx="11.5" cy="-1.8" rx="2.6" ry="1.4" fill="#fff" opacity="0.65" />
    </g>
  )
}

export default function LightsGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [cables, setCables] = useState<CableState[]>(() => restore(savedState))
  const [active, setActive] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone?: Tone } | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  const done = isDone(cables)
  const save = useEffectEvent(saveState)
  useEffect(() => {
    if (active === null) save({ cables })
  }, [cables, active])

  const toBoard = (event: { clientX: number; clientY: number }): Point => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  const update = (index: number, next: CableState) => setCables((all) => all.map((s, i) => (i === index ? next : s)))

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (done) return
    const p = toBoard(event)
    let best: number | null = null
    let bestD = GRAB
    cables.forEach((state, i) => {
      if (state.status === 'plugged') return
      const { at } = plugPose(LEVEL, i, state)
      const d = Math.hypot(at.x - p.x, at.y - p.y)
      // Bei Gleichstand gewinnt der Stecker, der oben liegt (später gezeichnet).
      if (d <= bestD) {
        best = i
        bestD = d
      }
    })
    if (best === null) return
    event.preventDefault()
    try {
      svg.current?.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture geht es auch.
    }
    setActive(best)
    setTouched(true)
    setMessage(cables[best].status === 'free' ? { text: 'Ab in eine freie Dose oben!' } : null)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (active === null) return
    const finger = toBoard(event)
    const state = cables[active]
    const cable = LEVEL.cables[active]
    if (state.status === 'free') {
      update(active, { ...state, plug: clampPlug(finger) })
      return
    }
    if (state.status !== 'tangled') return
    const result = pull(LEVEL, active, cables, finger)
    if (result.freed) {
      update(active, { status: 'free', length: result.length, plug: clampPlug(finger), outlet: null })
      setMessage({ text: `Der ${cable.spec.name} Strang ist frei! Steck ihn oben in die Mehrfachsteckdose.`, tone: 'good' })
      return
    }
    if (result.length !== state.length) update(active, { ...state, length: result.length })
    if (result.blocker !== null) {
      const other = LEVEL.cables[result.blocker].spec
      setMessage({ text: `Halt! Durch diese Schlaufe steckt noch der ${other.name} Strang – sie zieht sich nur fester zu.`, tone: 'hint' })
    } else if (result.taut) {
      setMessage({ text: 'Der Strang spannt – folge seinem Weg rückwärts durch die Schlaufen.', tone: 'hint' })
    } else if (message?.tone === 'hint') {
      setMessage(null)
    }
  }

  const endDrag = () => {
    if (active === null) return
    const state = cables[active]
    setActive(null)
    if (state.status !== 'free' || !state.plug) return
    const outlet = outletNear(state.plug, cables)
    if (outlet === null) return
    const next = cables.map((s, i) => (i === active ? { ...s, status: 'plugged' as const, plug: null, outlet } : s))
    setCables(next)
    setMessage(isDone(next)
      ? { text: 'Die ganze Lichterkette leuchtet! ✨', tone: 'done' }
      : { text: 'Klick – es werde Licht! 💡', tone: 'good' })
  }

  const replay = () => {
    setCables(startStates())
    setMessage(null)
    setTouched(false)
  }

  /** Kreuzungen, an denen ein Strang durch eine Schlaufe steckt: rein von oben, raus unter der Schlaufe durch. */
  const overlays = LEVEL.threads.flatMap((thread, k) => {
    const by = LEVEL.cables[thread.by]
    const owner = LEVEL.cables[thread.owner]
    const byState = cables[thread.by]
    const ownerState = cables[thread.owner]
    const byVisible = byState.status === 'tangled' ? byState.length : freeLength(LEVEL, thread.by)
    const ownerVisible = ownerState.status === 'tangled' ? ownerState.length : freeLength(LEVEL, thread.owner)
    const pieces = []
    if (byVisible > thread.enter) {
      pieces.push(<Wire key={`in-${k}`} cable={by} d={pathOf(slice(by, thread.enter - 12, Math.min(byVisible, thread.enter + 12)))} />)
    }
    if (byVisible > thread.exit - 4) {
      // Das Stück der Schlaufe, das über dem durchgesteckten Strang liegt.
      const loop = owner.loops[thread.loop]
      const crossing = pointAt(by, thread.exit)
      const gap = (s: number) => Math.hypot(pointAt(owner, s).x - crossing.x, pointAt(owner, s).y - crossing.y)
      let s = loop.from
      for (let t = loop.from; t <= loop.to; t += 2) if (gap(t) < gap(s)) s = t
      if (ownerVisible > s) {
        pieces.push(<Wire key={`out-${k}`} cable={owner} d={pathOf(slice(owner, s - 13, Math.min(ownerVisible, s + 13)))} />)
      }
    }
    return pieces
  })

  const status = done
    ? 'Die ganze Lichterkette leuchtet! ✨'
    : message?.text ?? 'Greif einen Stecker und schieb ihn rückwärts durch die Schlaufen, bis sein Strang frei ist.'
  const tone = done ? 'done' : message?.tone
  const litCount = cables.filter((s) => s.status === 'plugged').length

  // Gezogener Strang zuletzt, damit er oben liegt.
  const order = LEVEL.cables.map((_, i) => i).sort((a, b) => Number(a === active) - Number(b === active))
  const wires = LEVEL.cables.map((_, i) => wirePoints(LEVEL, i, cables[i]))

  return (
    <div className="lights">
      <div className="lights__board" data-done={done}>
        <svg
          ref={svg}
          viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
          role="group"
          aria-label={`Lichterketten-Schlamassel: ${cables.filter((s) => s.status !== 'tangled').length} von ${cables.length} Strängen entwirrt, ${litCount} leuchten`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-dragging={active !== null}
        >
          <defs>
            <linearGradient id="lights-desk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c99863" />
              <stop offset="1" stopColor="#b07e4b" />
            </linearGradient>
            <filter id="lights-soft" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id="lights-bloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* Wand mit Regalbrett, darunter der Schreibtisch mit Maserung */}
          <rect width={BOARD.width} height={BOARD.height} fill="url(#lights-desk)" />
          {[200, 262, 330, 404, 470].map((y, i) => (
            <path key={y} d={`M0 ${y}Q${100 + i * 20} ${y - 8} 200 ${y + 2}T400 ${y - 4}`} fill="none" stroke="#a06f3f" strokeOpacity="0.45" strokeWidth="1.5" />
          ))}
          <rect width={BOARD.width} height={DESK_Y} fill="#7d5236" />
          <rect y={DESK_Y - 8} width={BOARD.width} height="8" fill="#5e3c27" />
          <path d="M0 6Q100 0 200 6T400 4" fill="none" stroke="#fffaf2" strokeWidth="7" strokeLinecap="round" />
          {/* Fenster mit Schneeflocken links oben */}
          <g transform="translate(20 22)">
            <rect width="40" height="34" rx="4" fill="#24365e" stroke="#e9dcc6" strokeWidth="3" />
            <path d="M20 0V34M0 17H40" stroke="#e9dcc6" strokeWidth="2" />
            {[[8, 8], [30, 12], [13, 26], [33, 28]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#fff" />)}
          </g>
          {/* Ein Tannenzweig als Deko */}
          <g transform="translate(372 186) rotate(-20)" opacity="0.9">
            <path d="M0 0L-34 26" stroke="#3f6b45" strokeWidth="3" strokeLinecap="round" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(${-8 - i * 7} ${6 + i * 5.3})`}>
                <path d="M0 0l-10 -6M0 0l2 -11" stroke="#4f8a57" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            ))}
            <circle cx="-30" cy="30" r="5" fill="#d33b3b" />
          </g>

          {/* Mehrfachsteckdose auf dem Regalbrett, ihr Kabel läuft zur Wand */}
          <g>
            <path d={`M${OUTLET_STRIP.x + OUTLET_STRIP.width} ${OUTLET_STRIP.y + 26}Q${OUTLET_STRIP.x + OUTLET_STRIP.width + 40} ${OUTLET_STRIP.y + 30} 400 ${OUTLET_STRIP.y + 10}`} fill="none" stroke="#e7e3da" strokeWidth="7" strokeLinecap="round" />
            <rect x={OUTLET_STRIP.x + 3} y={OUTLET_STRIP.y + 5} width={OUTLET_STRIP.width} height={OUTLET_STRIP.height} rx="12" fill="rgb(40 25 15 / 0.35)" />
            <rect x={OUTLET_STRIP.x} y={OUTLET_STRIP.y} width={OUTLET_STRIP.width} height={OUTLET_STRIP.height} rx="12" fill="#f4f1ea" stroke="#b9b1a3" strokeWidth="2" />
            <rect x={OUTLET_STRIP.x + 10} y={OUTLET_STRIP.y + 18} width="16" height="16" rx="4" fill="#d9483c" />
            <rect x={OUTLET_STRIP.x + 14} y={OUTLET_STRIP.y + 22} width="8" height="8" rx="2" fill="#ff8f84" className="lights-switch" />
            {OUTLETS.map((o) => (
              <g key={o.x} transform={`translate(${o.x} ${o.y})`}>
                <circle r="19" fill="#e3ded3" stroke="#b9b1a3" strokeWidth="1.5" />
                <circle cx="-6" r="2.6" fill="#5e574d" />
                <circle cx="6" r="2.6" fill="#5e574d" />
              </g>
            ))}
          </g>

          {/* Wenn alles leuchtet, wird es im Zimmer gemütlich dunkel. */}
          <rect width={BOARD.width} height={BOARD.height} className="lights-dusk" />

          {/* Die Kiste: hinten offen, die Stränge kommen über den Rand */}
          <rect x={BOX.x} y={BOX.y - 10} width={BOX.width} height="16" rx="3" fill="#9a6b3c" />

          {/* Die Stränge – der gezogene leuchtet ein wenig */}
          {order.map((i) => {
            const cable = LEVEL.cables[i]
            const d = pathOf(wires[i])
            return (
              <g key={i}>
                {active === i && <path d={d} fill="none" stroke="#fffbe8" strokeOpacity="0.75" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" filter="url(#lights-soft)" />}
                <Wire d={d} cable={cable} />
              </g>
            )
          })}
          {overlays}

          {/* Lämpchen: aus, bis ihr Strang in der Dose steckt */}
          {order.map((i) => {
            const lit = cables[i].status === 'plugged'
            return (
              <g key={i}>
                {lampsAlong(wires[i]).map((lamp, k) => (
                  <Lamp key={k} at={lamp.at} angle={lamp.angle} color={lampColor(i, k)} lit={lit} index={k} />
                ))}
              </g>
            )
          })}

          {/* Kiste vorn */}
          <g>
            <path d={`M${BOX.x} ${BOX.y}H${BOX.x + BOX.width}L${BOX.x + BOX.width - 8} ${BOARD.height}H${BOX.x + 8}Z`} fill="#c08a52" stroke="#8a5a2e" strokeWidth="2" />
            <path d={`M${BOX.x + 6} ${BOX.y + 14}H${BOX.x + BOX.width - 6}`} stroke="#a7743f" strokeWidth="2" />
            <rect x={BOX.x + BOX.width / 2 - 46} y={BOX.y + 22} width="92" height="22" rx="4" fill="#f3e6cf" stroke="#8a5a2e" strokeWidth="1.5" />
            <text x={BOX.x + BOX.width / 2} y={BOX.y + 33} className="lights-label">Weihnachtsdeko</text>
          </g>

          {/* Stecker: eingesteckt in der Dose, sonst lose oder im Knäuel */}
          {order.map((i) => {
            const state = cables[i]
            const cable = LEVEL.cables[i]
            const { at, angle } = plugPose(LEVEL, i, state)
            const plugged = state.status === 'plugged'
            return (
              <g key={i} className="lights-plug" data-active={active === i} data-plugged={plugged}>
                {!touched && state.status === 'tangled' && <circle cx={at.x} cy={at.y} r="24" className="lights-plug__pulse" />}
                {/* Eingesteckt steht der Stecker mit den Stiften in der Dose, man sieht ihn von hinten. */}
                <g transform={`translate(${at.x.toFixed(1)} ${(plugged ? at.y + 24 : at.y).toFixed(1)}) rotate(${angle.toFixed(1)})`}>
                  <Plug cable={cable} />
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      <p className="lights__status" role="status" data-tone={tone}>{status}</p>

      {done ? (
        <div className="lights__controls">
          <button type="button" className="button" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Ab aufs Haus – Überraschung öffnen'}
          </button>
          <button type="button" className="button button--quiet" onClick={replay}>
            Noch einmal verheddern
          </button>
        </div>
      ) : (
        <p className="lights__hint">
          Tipp: Eine Schlaufe lässt sich erst aufziehen, wenn kein anderer Strang mehr hindurch steckt.
        </p>
      )}
    </div>
  )
}
