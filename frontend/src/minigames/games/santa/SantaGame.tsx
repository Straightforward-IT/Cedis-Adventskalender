import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import {
  BOARD, COURSE, GRAB_R, pointAt, restoreCheckpoint, SECTIONS, sectionAt, sectionStart, trace,
} from './model.ts'
import type { Point } from './model.ts'
import { SantaFallScene } from './SantaFallScene.ts'
import type { FallCue } from './SantaFallScene.ts'
import './santa.css'

type Stage = 'intro' | 'play' | 'done'
type Mood = 'dizzy' | 'ouch' | 'happy'

const RESET_MS = 750

const pathOf = (points: readonly Point[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')

function starPoints(r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
}

/** Kleine Spirale – so schauen Augen nach einem Sturz vom Schlitten. */
function Dizzy({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y}m0 -1a1 1 0 1 1 -1 1a3 3 0 1 1 3 3a5 5 0 1 1 -5 -5a7 7 0 1 1 7 7`}
      fill="none"
      stroke="#3a2418"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  )
}

/** Der Weihnachtsmann von vorn – frisch im Schnee gelandet. */
function Santa({ mood }: { mood: Mood }) {
  return (
    <g className="santa-body" data-mood={mood}>
      {/* Arme mit Handschuhen */}
      <path d="M100 262Q60 300 52 372" fill="none" stroke="#b72f29" strokeWidth="46" strokeLinecap="round" />
      <path d="M300 262Q340 300 348 372" fill="none" stroke="#b72f29" strokeWidth="46" strokeLinecap="round" />
      <circle cx="50" cy="388" r="24" fill="#2f6d3d" />
      <circle cx="350" cy="388" r="24" fill="#2f6d3d" />
      {/* Beine und Stiefel */}
      <rect x="138" y="420" width="50" height="86" rx="12" fill="#b72f29" />
      <rect x="226" y="420" width="50" height="86" rx="12" fill="#b72f29" />
      <ellipse cx="160" cy="522" rx="48" ry="24" fill="#2b211d" />
      <ellipse cx="266" cy="524" rx="54" ry="24" fill="#2b211d" />
      <rect x="132" y="494" width="62" height="12" rx="6" fill="#fff8ee" />
      <rect x="220" y="494" width="62" height="12" rx="6" fill="#fff8ee" />
      {/* Mantel mit Pelz und Gürtel */}
      <ellipse cx="200" cy="340" rx="128" ry="116" fill="#d33b33" />
      <ellipse cx="200" cy="356" rx="104" ry="92" fill="#e04a41" opacity="0.5" />
      <rect x="186" y="236" width="28" height="216" rx="12" fill="#fff8ee" />
      <rect x="76" y="324" width="248" height="30" rx="8" fill="#2b211d" />
      <rect x="180" y="318" width="40" height="42" rx="7" fill="none" stroke="#e8b04a" strokeWidth="7" />
      {/* Bart */}
      <path d="M132 172Q126 236 166 262Q186 282 200 278Q214 282 234 262Q274 236 268 172Q240 206 200 206Q160 206 132 172Z" fill="#fff8ee" />
      {/* Gesicht */}
      <circle cx="200" cy="168" r="52" fill="#f6c9a3" />
      <circle cx="168" cy="184" r="10" fill="#ec8f80" opacity="0.7" />
      <circle cx="232" cy="184" r="10" fill="#ec8f80" opacity="0.7" />
      {mood === 'happy' ? (
        <>
          <path d="M172 158q8 -9 16 0M212 158q8 -9 16 0" fill="none" stroke="#3a2418" strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : mood === 'ouch' ? (
        <>
          <path d="M172 152l14 8l-14 8M228 152l-14 8l14 8" fill="none" stroke="#3a2418" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Dizzy x={180} y={158} />
          <Dizzy x={220} y={158} />
        </>
      )}
      <circle className="santa-nose" cx="200" cy="178" r="11" />
      {/* Schnurrbart */}
      <path d="M200 192q-18 -8 -38 6q20 10 38 -2q18 12 38 2q-20 -14 -38 -6Z" fill="#fff8ee" />
      {mood === 'happy' && <path d="M186 212q14 12 28 0" fill="none" stroke="#a5523e" strokeWidth="3" strokeLinecap="round" />}
      {mood === 'ouch' && <ellipse cx="200" cy="214" rx="8" ry="10" fill="#7a2f28" />}
      {/* Mütze */}
      <path d="M128 124Q144 60 300 46Q258 82 272 124Z" fill="#d33b33" />
      <rect x="116" y="108" width="168" height="32" rx="16" fill="#fff8ee" />
      <circle cx="306" cy="50" r="20" fill="#fff8ee" />
    </g>
  )
}

export default function SantaGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [checkpoint, setCheckpoint] = useState(() => restoreCheckpoint(savedState))
  const [stage, setStage] = useState<Stage>(() => {
    const restored = restoreCheckpoint(savedState)
    return restored >= SECTIONS.length ? 'done' : restored > 0 ? 'play' : 'intro'
  })
  const [s, setS] = useState(() => sectionStart(COURSE, Math.min(restoreCheckpoint(savedState), SECTIONS.length - 1)))
  const [probe, setProbe] = useState<Point>(() => pointAt(COURSE, sectionStart(COURSE, Math.min(restoreCheckpoint(savedState), SECTIONS.length - 1))))
  const [holding, setHolding] = useState(false)
  const [ouch, setOuch] = useState<Point | null>(null)
  const [ouches, setOuches] = useState(0)
  const [cleared, setCleared] = useState<number | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fall = useRef<SantaFallScene | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef<{ dx: number; dy: number; id: number } | null>(null)
  const timer = useRef<number | null>(null)
  /** Stand des Sterns ohne Verzögerung – Zeigerereignisse kommen schneller als React neu zeichnet. */
  const live = useRef({ s, probe, checkpoint })
  const save = useEffectEvent(saveState)

  useEffect(() => { save({ checkpoint }) }, [checkpoint])
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  // Vorspann: Schlitten über der Straße, der Weihnachtsmann purzelt heraus.
  const onCue = useEffectEvent((cue: FallCue) => {
    if (cue === 'bump') setCaption('Hoppla!')
    if (cue === 'land') setCaption('Plumps! 💫')
    if (cue === 'done') {
      timer.current = window.setTimeout(() => {
        setCaption(null)
        setStage('play')
      }, 300)
    }
  })
  useEffect(() => {
    if (stage !== 'intro' || !canvas.current) return
    const scene = new SantaFallScene(canvas.current, { onCue: (cue) => onCue(cue) })
    fall.current = scene
    return () => {
      scene.dispose()
      fall.current = null
    }
  }, [stage])

  const done = stage === 'done'
  const section = sectionAt(COURSE, s)

  const toBoard = (event: { clientX: number; clientY: number }): Point => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return [0, 0]
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return [p.x, p.y]
  }

  const fail = (at: Point) => {
    grab.current = null
    setHolding(false)
    setOuch(at)
    setOuches((n) => n + 1)
    navigator.vibrate?.(140)
    const back = sectionStart(COURSE, live.current.checkpoint)
    timer.current = window.setTimeout(() => {
      setOuch(null)
      live.current = { ...live.current, s: back, probe: pointAt(COURSE, back) }
      setS(back)
      setProbe(live.current.probe)
    }, RESET_MS)
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (stage !== 'play' || ouch) return
    const p = toBoard(event)
    // Den Stern greifen – auch knapp daneben, dann bleibt er versetzt und der Finger verdeckt ihn nicht.
    if (Math.hypot(p[0] - probe[0], p[1] - probe[1]) > GRAB_R) return
    event.preventDefault()
    try {
      svg.current?.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture geht es auch.
    }
    grab.current = { dx: probe[0] - p[0], dy: probe[1] - p[1], id: event.pointerId }
    setHolding(true)
    setCleared(null)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const held = grab.current
    if (!held || held.id !== event.pointerId || stage !== 'play') return
    const [fx, fy] = toBoard(event)
    const target: Point = [fx + held.dx, fy + held.dy]
    const now = live.current
    const result = trace(COURSE, now.s, now.probe, target)
    if (result.touched) {
      fail(result.at)
      return
    }
    live.current = { ...now, s: result.s, probe: target }
    setS(result.s)
    setProbe(target)
    // Ende eines Abschnitts erreicht?
    const reached = now.checkpoint
    if (reached < SECTIONS.length && result.s >= COURSE.ends[reached] - 2) {
      const next = reached + 1
      live.current.checkpoint = next
      setCheckpoint(next)
      if (next >= SECTIONS.length) {
        grab.current = null
        setHolding(false)
        setStage('done')
      } else {
        setCleared(reached)
      }
    }
  }

  const onPointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (grab.current?.id !== event.pointerId) return
    grab.current = null
    setHolding(false)
  }

  const replay = () => {
    live.current = { s: 0, probe: pointAt(COURSE, 0), checkpoint: 0 }
    setCheckpoint(0)
    setS(0)
    setProbe(live.current.probe)
    setOuches(0)
    setCleared(null)
    setStage('intro')
  }

  const mood: Mood = done ? 'happy' : ouch ? 'ouch' : 'dizzy'
  const status = done
    ? 'Geschafft! Der Weihnachtsmann ist wieder putzmunter. 🎅'
    : ouch
      ? `Autsch! Das kitzelt – nochmal ab ${SECTIONS[checkpoint].name}.`
      : cleared !== null
        ? `${SECTIONS[cleared].name} geschafft! ✨ Weiter geht’s.`
        : holding
          ? `Ganz ruhig … ${SECTIONS[section].name}`
          : checkpoint === 0 && s === 0 && ouches === 0
            ? 'Rette den Weihnachtsmann! Greif den Stern und führ ihn durch die Rinne – ohne den Rand zu berühren.'
            : 'Tipp auf den Stern und mach weiter.'

  if (stage === 'intro') {
    return (
      <div className="santa">
        <div className="santa__intro">
          <canvas ref={canvas} className="santa__canvas" />
          {caption && <p key={caption} className="santa__caption">{caption}</p>}
          <button type="button" className="santa__skip" onClick={() => fall.current?.skip()}>
            Überspringen ›
          </button>
        </div>
        <p className="santa__status" role="status">Der Weihnachtsmann ist unterwegs …</p>
      </div>
    )
  }

  const end = COURSE.points[COURSE.points.length - 1]

  return (
    <div className="santa">
      <div className="santa__board" data-ouch={ouch !== null}>
        <svg
          ref={svg}
          viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
          role="application"
          aria-label="Santa Bibber: Führe den Stern mit dem Finger durch die Rinne, ohne den Rand zu berühren."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          data-holding={holding}
        >
          <defs>
            <radialGradient id="santa-snow" cx="50%" cy="45%" r="75%">
              <stop offset="0" stopColor="#f8fbff" />
              <stop offset="1" stopColor="#d6e1f0" />
            </radialGradient>
            <filter id="santa-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <rect width={BOARD.width} height={BOARD.height} fill="url(#santa-snow)" />
          <ellipse cx="200" cy="548" rx="190" ry="20" fill="rgb(70 80 110 / 0.14)" />

          <Santa mood={mood} />

          {/* Die Rinne: Metallrand und ein heller, durchscheinender Graben – Abschnitt für Abschnitt enger. */}
          <g className="santa-groove" pointerEvents="none">
            {SECTIONS.map((section, i) => (
              <path key={`rim-${i}`} d={pathOf(section.points)} stroke="#eef1f6" strokeWidth={section.width + 7} opacity="0.9" />
            ))}
            {SECTIONS.map((section, i) => (
              <path key={`edge-${i}`} d={pathOf(section.points)} stroke="#8a93a3" strokeWidth={section.width + 2.5} />
            ))}
            {SECTIONS.map((section, i) => (
              <path key={`groove-${i}`} d={pathOf(section.points)} stroke={i < checkpoint ? 'rgb(255 236 170 / 0.55)' : 'rgb(255 255 255 / 0.5)'} strokeWidth={section.width} />
            ))}
            {/* Geschaffte Abschnitte schimmern golden. */}
            {SECTIONS.map((section, i) => i < checkpoint && (
              <path key={`done-${i}`} d={pathOf(section.points)} stroke="#e8b04a" strokeWidth="4" strokeDasharray="2 10" opacity="0.9" />
            ))}
            {/* Kontrollpunkte und Ziel */}
            {COURSE.ends.slice(0, -1).map((at, i) => {
              const [x, y] = pointAt(COURSE, at)
              return <circle key={i} cx={x} cy={y} r={SECTIONS[i + 1].width / 2 + 2} fill="none" stroke="#e8b04a" strokeWidth="3" strokeDasharray="5 4" />
            })}
            <g transform={`translate(${end[0]} ${end[1]})`}>
              <circle r="17" fill="#3f8a4f" stroke="#fff8ee" strokeWidth="3" />
              <path d="M0 7C-11 -1 -7 -10 0 -5C7 -10 11 -1 0 7Z" fill="#fff8ee" />
            </g>
          </g>

          {/* Der Heilstern */}
          {!done && (
            <g transform={`translate(${probe[0].toFixed(1)} ${probe[1].toFixed(1)})`} pointerEvents="none">
              {!holding && !ouch && <circle className="santa-grab" r="18" />}
              <polygon points={starPoints(13)} fill="#ffe08a" filter="url(#santa-glow)" opacity="0.9" />
              <polygon points={starPoints(10)} fill="#f5c542" stroke="#b9851f" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          )}

          {ouch && (
            <g transform={`translate(${ouch[0]} ${ouch[1]})`} pointerEvents="none">
              <g className="santa-zap">
                <polygon points={starPoints(22)} fill="#ff5a4a" opacity="0.85" />
                <text y="-28" textAnchor="middle" className="santa-ouch">Autsch!</text>
              </g>
            </g>
          )}
          {done && (
            <g className="santa-sparkles" pointerEvents="none">
              {[[90, 120], [320, 150], [70, 300], [336, 290], [120, 470], [300, 440]].map(([x, y], i) => (
                <polygon key={i} points={starPoints(12)} transform={`translate(${x} ${y})`} fill="#f5c542" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </g>
          )}
        </svg>
      </div>

      <p className="santa__status" role="status" data-tone={ouch ? 'hint' : done ? 'done' : undefined}>{status}</p>

      <ol className="santa__sections" aria-label="Abschnitte">
        {SECTIONS.map((section, i) => (
          <li key={section.name} data-state={i < checkpoint ? 'done' : i === checkpoint && !done ? 'active' : 'todo'}>
            {i < checkpoint ? '✓ ' : ''}{section.name}
          </li>
        ))}
      </ol>

      {done && (
        <div className="santa__actions">
          <button type="button" className="button" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
          </button>
          <button type="button" className="button button--quiet" onClick={replay}>
            Noch einmal retten
          </button>
        </div>
      )}
    </div>
  )
}
