import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { buildRound, GOAL, hits, isClean, LEVELS, LOG_TOTAL, logRotation, logsDone, restoreSplit } from './model.ts'
import type { Cut, LogSetup } from './model.ts'
import './firewood.css'

const BOARD = { width: 400, height: 448 }
/** Alles am Scheit wird in diesem Maßstab gezeichnet und dann pro Scheit verkleinert. */
const LOG_R = 84
const BLOCK_R = 118
/** Ab hier unten steht das Holzregal. */
const RACK_Y = 338

const BARK = '#5e3f2b'
const BARK_DARK = '#3f2a1d'
const SAPWOOD = '#ecc58c'
const RING = '#c8955c'
const CHALK = '#e0443a'

/** Wo die Scheite liegen – je nachdem, wie viele es in der Runde sind. */
const LAYOUTS: Record<number, { x: number; y: number; r: number }[]> = {
  1: [{ x: 200, y: 172, r: 84 }],
  2: [{ x: 105, y: 166, r: 58 }, { x: 295, y: 166, r: 58 }],
  3: [{ x: 68, y: 168, r: 40 }, { x: 200, y: 168, r: 40 }, { x: 332, y: 168, r: 40 }],
}

type Phase = 'aim' | 'swing' | 'split' | 'shatter'

const SWING_MS = 280
const SPLIT_MS = 950
const SHATTER_MS = 1150

const rad = (deg: number) => (deg * Math.PI) / 180

/** Gleichmäßig verteilt, aber je Scheit etwas anders: Jahresringe und Kern sitzen nie genau gleich. */
function logLook(seed: number) {
  const r = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    heart: { x: (r(1) - 0.5) * 18, y: (r(2) - 0.5) * 18 },
    rings: [62, 47, 33, 20].map((radius, i) => radius + (r(3 + i) - 0.5) * 6),
    cracks: [0, 1, 2].map((i) => r(10 + i) * 360),
  }
}

/** Kreidelinie quer durch (line) oder von der Mitte zum Rand (ray). */
function ChalkMark({ cut }: { cut: Cut }) {
  const end = LOG_R - 8
  return (
    <g transform={`rotate(${cut.angle})`}>
      <line x1={cut.kind === 'line' ? -end : 0} y1="0" x2={end} y2="0" stroke={CHALK} strokeWidth="4.5" strokeLinecap="round" strokeDasharray="11 7" />
      <circle cx={end} r="4.5" fill={CHALK} />
      {cut.kind === 'line' && <circle cx={-end} r="4.5" fill={CHALK} />}
    </g>
  )
}

/** Die Stirnseite eines Scheits samt Kreidelinien (im Koordinatensystem des Scheits). */
function LogFace({ seed, marks }: { seed: number; marks: Cut[] }) {
  const look = logLook(seed)
  const { x: hx, y: hy } = look.heart
  return (
    <g>
      <circle r={LOG_R} fill={BARK} />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2
        return (
          <line
            key={i}
            x1={Math.cos(a) * (LOG_R - 9)}
            y1={Math.sin(a) * (LOG_R - 9)}
            x2={Math.cos(a) * (LOG_R - 1)}
            y2={Math.sin(a) * (LOG_R - 1)}
            stroke={BARK_DARK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )
      })}
      <circle r={LOG_R - 10} fill={SAPWOOD} />
      {look.rings.map((radius, i) => (
        <circle key={i} cx={hx * (1 - i * 0.2)} cy={hy * (1 - i * 0.2)} r={radius} fill="none" stroke={RING} strokeWidth="2" />
      ))}
      {look.cracks.map((deg, i) => (
        <line
          key={i}
          x1={hx + Math.cos(rad(deg)) * 6}
          y1={hy + Math.sin(rad(deg)) * 6}
          x2={hx + Math.cos(rad(deg)) * (26 + i * 8)}
          y2={hy + Math.sin(rad(deg)) * (26 + i * 8)}
          stroke="#a9773f"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
      <circle cx={hx} cy={hy} r="4" fill="#a36d38" />
      {marks.map((cut, i) => <ChalkMark key={i} cut={cut} />)}
    </g>
  )
}

/** Die Axt von oben: in der Mitte der Stiel (von oben gesehen), drumherum die Klingen. */
function Axe({ blades }: { blades: Cut[] }) {
  return (
    <g>
      {blades.map((blade, i) => (
        <g key={i} transform={`rotate(${blade.angle})`}>
          {blade.kind === 'line' ? (
            <>
              <path d="M-72 0Q-32 -6 -12 -13H12Q32 -6 72 0Q32 6 12 13H-12Q-32 6 -72 0Z" fill="#8f99a5" stroke="#4f5863" strokeWidth="2" strokeLinejoin="round" />
              <path d="M-70 0Q-30 -2.5 0 -3Q30 -2.5 70 0Q30 2.5 0 3Q-30 2.5 -70 0Z" fill="#f4f8fc" />
            </>
          ) : (
            <>
              <path d="M8 -12H16Q42 -6 74 0Q42 6 16 12H8Z" fill="#8f99a5" stroke="#4f5863" strokeWidth="2" strokeLinejoin="round" />
              <path d="M14 -2.5Q44 -2 72 0Q44 2 14 2.5Z" fill="#f4f8fc" />
            </>
          )}
        </g>
      ))}
      <circle r="17" fill="#6f7883" stroke="#4f5863" strokeWidth="2" />
      <circle r="11" fill="#b9814a" stroke="#8a5a2e" strokeWidth="2" />
      <circle r="5" fill="none" stroke="#8a5a2e" strokeWidth="1.5" />
    </g>
  )
}

/** Gestrichelte Schatten der Klingen auf dem Scheit: Hier trifft die Axt. */
function Guides({ blades }: { blades: Cut[] }) {
  return (
    <g className="firewood-guide">
      {blades.map((blade, i) => (
        <line key={i} transform={`rotate(${blade.angle})`} x1={blade.kind === 'line' ? -112 : 0} y1="0" x2="112" y2="0" />
      ))}
    </g>
  )
}

/** Tortenstücke, in die ein sauber gespaltener Scheit zerfällt – getrennt an jeder Kreidelinie. */
function wedges(marks: Cut[]): { from: number; to: number }[] {
  const angles = [...new Set(marks.flatMap((m) => (m.kind === 'line' ? [m.angle, m.angle + 180] : [m.angle])).map((a) => ((a % 360) + 360) % 360))]
    .sort((a, b) => a - b)
  return angles.map((from, i) => ({ from, to: i + 1 < angles.length ? angles[i + 1] : angles[0] + 360 }))
}

function wedgePath(from: number, to: number, r = 100) {
  const large = to - from > 180 ? 1 : 0
  return `M0 0L${(Math.cos(rad(from)) * r).toFixed(2)} ${(Math.sin(rad(from)) * r).toFixed(2)}A${r} ${r} 0 ${large} 1 ${(Math.cos(rad(to)) * r).toFixed(2)} ${(Math.sin(rad(to)) * r).toFixed(2)}Z`
}

/** Splitter für den Fall, dass die Axt danebenhaut – Tortenstücke mit ausgefranstem Rand. */
const SPLINTERS = Array.from({ length: 9 }, (_, i) => {
  const a0 = (i / 9) * Math.PI * 2
  const a1 = ((i + 1) / 9) * Math.PI * 2
  const mid = (a0 + a1) / 2
  const r = LOG_R
  const pts = [
    [Math.cos(mid) * 10, Math.sin(mid) * 10],
    [Math.cos(a0) * r, Math.sin(a0) * r],
    [Math.cos(mid - 0.12) * r * 0.82, Math.sin(mid - 0.12) * r * 0.82],
    [Math.cos(mid) * r, Math.sin(mid) * r],
    [Math.cos(mid + 0.1) * r * 0.86, Math.sin(mid + 0.1) * r * 0.86],
    [Math.cos(a1) * r, Math.sin(a1) * r],
  ]
  const fly = 150 + (i % 3) * 40
  return {
    points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    style: {
      '--dx': `${(Math.cos(mid) * fly).toFixed(0)}px`,
      '--dy': `${(Math.sin(mid) * fly).toFixed(0)}px`,
      '--rot': `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
    } as CSSProperties,
  }
})

/** Ein kleines Zahnrad zwischen zwei Klötzen – es dreht sich mit. */
function Gear({ x, y, r, angle }: { x: number; y: number; r: number; angle: number }) {
  const teeth = 10
  const points = Array.from({ length: teeth * 4 }, (_, i) => {
    const a = (i / (teeth * 4)) * Math.PI * 2
    const outer = i % 4 === 1 || i % 4 === 2
    const radius = outer ? r : r * 0.78
    return `${(Math.cos(a) * radius).toFixed(1)},${(Math.sin(a) * radius).toFixed(1)}`
  }).join(' ')
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle.toFixed(1)})`}>
      <polygon points={points} fill="#8f99a5" stroke="#4f5863" strokeWidth="1.5" strokeLinejoin="round" />
      <circle r={r * 0.32} fill="#4f5863" />
    </g>
  )
}

/** Alle Scheite aller Runden in Regal-Reihenfolge – jeder mit dem Kreidemuster, an dem er gespalten wird. */
const RACK_LOGS = LEVELS.flatMap((level, round) => level.logs.map((log) => ({ round, pattern: log.pattern })))
const RACK_COLUMNS = Math.ceil(RACK_LOGS.length / 2)
/** Radius eines Scheits im Regal. */
const RACK_R = 18
const RACK_FLOOR = 432

/** Wo Scheit `index` liegt: erst die untere Reihe von links nach rechts, dann die obere darauf. */
function rackSlot(index: number) {
  const row = Math.floor(index / RACK_COLUMNS)
  const col = index % RACK_COLUMNS
  const spacing = RACK_R * 2 + 3
  const left = 200 - ((RACK_COLUMNS - 1) * spacing) / 2
  return { x: left + col * spacing, y: RACK_FLOOR - RACK_R - row * (RACK_R * 2 + 1) }
}

/** Ein gespaltener Scheit von vorn: seine Stücke liegen noch beieinander, mit kleinen Fugen dazwischen. */
function RackLog({ pattern, angle }: { pattern: Cut[]; angle: number }) {
  return (
    <g transform={`rotate(${angle})`}>
      {wedges(pattern).map(({ from, to }, w) => {
        const mid = rad((from + to) / 2)
        const ring = 10
        const large = to - from > 180 ? 1 : 0
        return (
          <g key={w} transform={`translate(${(Math.cos(mid) * 1.3).toFixed(2)} ${(Math.sin(mid) * 1.3).toFixed(2)})`}>
            <path d={wedgePath(from, to, RACK_R)} fill={BARK} />
            <path d={wedgePath(from, to, RACK_R - 3.5)} fill={SAPWOOD} />
            <path
              d={`M${(Math.cos(rad(from)) * ring).toFixed(2)} ${(Math.sin(rad(from)) * ring).toFixed(2)}A${ring} ${ring} 0 ${large} 1 ${(Math.cos(rad(to)) * ring).toFixed(2)} ${(Math.sin(rad(to)) * ring).toFixed(2)}`}
              fill="none"
              stroke={RING}
              strokeWidth="1.4"
            />
          </g>
        )
      })}
    </g>
  )
}

function Rack({ rounds, fresh }: { rounds: number; fresh: boolean }) {
  return (
    <g>
      <rect y={RACK_Y} width={BOARD.width} height={BOARD.height - RACK_Y} fill="#e7eef6" />
      {/* Unterstand: Rückwand aus Brettern, Pfosten, Dach mit Schnee, Boden */}
      <rect x="66" y="354" width="268" height={RACK_FLOOR - 354} fill="#7d5a40" />
      {[366, 380, 394, 408, 422].map((y) => <rect key={y} x="66" y={y} width="268" height="1.5" fill="#6a4a33" />)}
      <rect x="58" y="352" width="10" height={RACK_FLOOR - 352 + 8} fill="#5e4130" />
      <rect x="332" y="352" width="10" height={RACK_FLOOR - 352 + 8} fill="#5e4130" />
      <path d="M48 356L200 342L352 356V364H48Z" fill="#7b4040" />
      <path d="M44 356L200 340L356 356" fill="none" stroke="#fffaf2" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="54" y={RACK_FLOOR} width="292" height="8" rx="3" fill="#5e4130" />
      <ellipse cx="200" cy={RACK_FLOOR + 10} rx="150" ry="4" fill="rgb(70 80 110 / 0.18)" />
      {RACK_LOGS.map((log, i) => {
        const { x, y } = rackSlot(i)
        const stacked = log.round < rounds
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            {stacked ? (
              <g className="firewood-rack__piece" data-fresh={fresh && log.round === rounds - 1}>
                <RackLog pattern={log.pattern} angle={-90 + i * 37} />
              </g>
            ) : (
              <circle r={RACK_R - 1} fill="rgb(60 40 30 / 0.18)" stroke="rgb(255 246 230 / 0.35)" strokeWidth="1.5" strokeDasharray="4 4" />
            )}
          </g>
        )
      })}
    </g>
  )
}

function ratioLabel(ratio: number) {
  const arrow = ratio > 0 ? '↻' : '↺'
  return Math.abs(ratio) === 1 ? arrow : `${arrow} ×${Math.abs(ratio)}`
}

export default function FirewoodGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [split, setSplit] = useState(() => restoreSplit(savedState))
  const [logs, setLogs] = useState<LogSetup[]>(() => buildRound(LEVELS[Math.min(restoreSplit(savedState), LEVELS.length - 1)]))
  /** Der gemeinsame Drehwinkel – jeder Scheit dreht sich mit seiner Übersetzung mit. */
  const [turn, setTurn] = useState(0)
  const [phase, setPhase] = useState<Phase>('aim')
  /** Zählt die Versuche – jeder Scheit bekommt seine eigene Maserung. */
  const [attempt, setAttempt] = useState(1)
  const [lastHits, setLastHits] = useState<{ hit: number; total: number } | null>(null)
  /** Gerade frisch ins Regal gelegt – dann purzeln die neuen Scheite hinein. */
  const [fresh, setFresh] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ log: number; angle: number } | null>(null)
  const repeat = useRef<number | null>(null)
  const timer = useRef<number | null>(null)

  const save = useEffectEvent(saveState)
  useEffect(() => { save({ split }) }, [split])
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
    if (repeat.current) window.clearInterval(repeat.current)
  }, [])

  const done = split >= GOAL
  const level = LEVELS[Math.min(split, LEVELS.length - 1)]
  const layout = LAYOUTS[logs.length] ?? LAYOUTS[1]
  const aiming = phase === 'aim' && !done

  const later = (ms: number, then: () => void) => {
    timer.current = window.setTimeout(then, ms)
  }

  /** Neue Runde: im selben Level (nach einem Fehlschlag) oder im nächsten. */
  const nextRound = (levelIndex: number) => {
    if (levelIndex < LEVELS.length) setLogs(buildRound(LEVELS[levelIndex]))
    setTurn(0)
    setAttempt((n) => n + 1)
    setPhase('aim')
  }

  const stopRepeat = () => {
    if (repeat.current) window.clearInterval(repeat.current)
    repeat.current = null
  }

  const chop = () => {
    if (!aiming) return
    stopRepeat()
    drag.current = null
    setPhase('swing')
    const clean = isClean(logs, turn)
    setLastHits(hits(logs, turn))
    later(SWING_MS, () => {
      if (clean) {
        setPhase('split')
        later(SPLIT_MS, () => {
          const next = Math.min(GOAL, split + 1)
          setSplit(next)
          setFresh(true)
          setLastHits(null)
          nextRound(next)
        })
      } else {
        setPhase('shatter')
        later(SHATTER_MS, () => nextRound(split))
      }
    })
  }

  const rotate = (degrees: number) => {
    if (!aiming) return
    setTurn((t) => t + degrees)
  }

  const startRepeat = (event: PointerEvent, degrees: number) => {
    event.preventDefault()
    rotate(degrees)
    stopRepeat()
    repeat.current = window.setInterval(() => rotate(degrees), 70)
  }

  /** Tastatur auf dem Knopf (Enter/Leertaste): ein Schritt, kein Dauerdrehen. */
  const keyStep = (event: MouseEvent, degrees: number) => {
    if (event.detail === 0) rotate(degrees)
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('input, textarea, select')) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const step = event.shiftKey ? 5 : 1
      rotate(event.key === 'ArrowLeft' ? -step : step)
    } else if ((event.key === ' ' || event.key === 'Enter') && !target?.closest('button')) {
      event.preventDefault()
      chop()
    }
  })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const toBoard = (event: { clientX: number; clientY: number }) => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  const angleAround = (p: { x: number; y: number }, log: number) =>
    (Math.atan2(p.y - layout[log].y, p.x - layout[log].x) * 180) / Math.PI

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!aiming) return
    const p = toBoard(event)
    if (p.y > RACK_Y) return
    event.preventDefault()
    try {
      svg.current?.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture geht es auch.
    }
    // Den Scheit greifen, der dem Finger am nächsten liegt.
    let log = 0
    layout.forEach((spot, i) => {
      if (Math.hypot(p.x - spot.x, p.y - spot.y) < Math.hypot(p.x - layout[log].x, p.y - layout[log].y)) log = i
    })
    drag.current = { log, angle: angleAround(p, log) }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current || !aiming) return
    const angle = angleAround(toBoard(event), current.log)
    let delta = angle - current.angle
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    current.angle = angle
    // Der gegriffene Scheit folgt dem Finger, die anderen drehen sich über die Zahnräder mit.
    setTurn((t) => t + delta / logs[current.log].ratio)
  }

  const endDrag = () => {
    drag.current = null
  }

  const replay = () => {
    setSplit(0)
    setFresh(false)
    setLastHits(null)
    nextRound(0)
  }

  const status = done
    ? 'Das Regal ist voll – genug Holz für den Kamin! 🔥'
    : phase === 'shatter' && lastHits
      ? `Krach! Nur ${lastHits.hit} von ${lastHits.total} ${lastHits.total === 1 ? 'Klinge traf' : 'Klingen trafen'} die Kreide.`
      : phase === 'split'
        ? 'Sauber gespalten! 🪓'
        : level.hint

  return (
    <div className="firewood">
      <div className="firewood__board" data-phase={phase}>
        <svg
          ref={svg}
          viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
          role="group"
          aria-label={done
            ? `Holzregal voll, alle ${LOG_TOTAL} Scheite gespalten`
            : `${logsDone(split)} von ${LOG_TOTAL} Scheiten gespalten. Auf dem Klotz: ${logs.length} ${logs.length === 1 ? 'Scheit' : 'Scheite'}, ${logs.reduce((n, l) => n + l.blades.length, 0)} Klingen`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-aiming={aiming}
        >
          <defs>
            <radialGradient id="firewood-snow" cx="50%" cy="40%" r="70%">
              <stop offset="0" stopColor="#fbfdff" />
              <stop offset="1" stopColor="#dbe6f2" />
            </radialGradient>
            <filter id="firewood-soft" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Verschneiter Hof von oben, mit Spänen vom letzten Holzhacken */}
          <rect width={BOARD.width} height={RACK_Y} fill="url(#firewood-snow)" />
          {[[52, 70, 20], [338, 96, -30], [84, 300, 60], [322, 296, 10], [150, 318, -60], [250, 318, 40]].map(([x, y, r]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="16" height="5" rx="2" fill="#d8b07a" transform={`rotate(${r} ${x + 8} ${y + 2})`} />
          ))}

          <g className="firewood-stage">
            {/* Zahnräder zwischen verbundenen Klötzen */}
            {!done && layout.slice(1).map((spot, i) => {
              const prev = layout[i]
              const s = spot.r / LOG_R
              return <Gear key={i} x={(prev.x + spot.x) / 2} y={spot.y + BLOCK_R * s * 0.72} r={20 * s + 6} angle={-turn * 1.6} />
            })}

            {layout.map((spot, i) => {
              const log = logs[i]
              if (!log) return null
              const s = spot.r / LOG_R
              const rotation = logRotation(log, turn)
              return (
                <g key={i} transform={`translate(${spot.x} ${spot.y}) scale(${s})`}>
                  {/* Hackklotz */}
                  <circle cy="6" r={BLOCK_R + 4} fill="rgb(70 80 110 / 0.18)" filter="url(#firewood-soft)" />
                  <circle r={BLOCK_R} fill="#4f3526" />
                  <circle r={BLOCK_R - 12} fill="#9c7048" />
                  {[86, 66, 46].map((r) => <circle key={r} r={r} fill="none" stroke="#86603c" strokeWidth="2" />)}
                  <path d="M-112 -34q20-22 44-20" fill="none" stroke="#fffaf2" strokeWidth="9" strokeLinecap="round" />

                  {/* Der Scheit: ganz, in Stücken oder in Splittern */}
                  <g transform={`rotate(${rotation.toFixed(2)})`}>
                    {(phase === 'aim' || phase === 'swing') && !done && (
                      <g key={attempt} className="firewood-log">
                        <LogFace seed={attempt * 7 + i} marks={log.marks} />
                      </g>
                    )}
                    {phase === 'split' && wedges(log.marks).map(({ from, to }, w) => {
                      const mid = rad((from + to) / 2)
                      const id = `firewood-wedge-${attempt}-${i}-${w}`
                      return (
                        <g key={w}>
                          <defs><clipPath id={id}><path d={wedgePath(from, to)} /></clipPath></defs>
                          <g className="firewood-piece" style={{ '--dx': `${(Math.cos(mid) * 70).toFixed(0)}px`, '--dy': `${(Math.sin(mid) * 70).toFixed(0)}px` } as CSSProperties}>
                            <g clipPath={`url(#${id})`}><LogFace seed={attempt * 7 + i} marks={log.marks} /></g>
                          </g>
                        </g>
                      )
                    })}
                    {phase === 'shatter' && SPLINTERS.map((sp, k) => (
                      <g key={k} className="firewood-splinter" style={sp.style}>
                        <polygon points={sp.points} fill={SAPWOOD} stroke={BARK} strokeWidth="3" strokeLinejoin="round" />
                      </g>
                    ))}
                  </g>

                  {/* Die Axt schwebt über dem Klotz; ihre Schatten zeigen, wo die Klingen treffen. */}
                  {!done && (
                    <>
                      <Guides blades={log.blades} />
                      <g className="firewood-axe-shadow" filter="url(#firewood-soft)">
                        <g transform="translate(10 16)" opacity="0.3"><Axe blades={log.blades} /></g>
                      </g>
                      <g key={`${attempt}-${phase === 'aim' ? 'a' : 'b'}`} className="firewood-axe">
                        <Axe blades={log.blades} />
                      </g>
                    </>
                  )}
                </g>
              )
            })}

            {/* Drehrichtung und Übersetzung unter jedem Scheit, sobald mehrere verbunden sind */}
            {!done && logs.length > 1 && layout.map((spot, i) => logs[i] && (
              <g key={i} transform={`translate(${spot.x} ${spot.y + BLOCK_R * (spot.r / LOG_R) + 16})`}>
                <rect x="-26" y="-12" width="52" height="22" rx="11" fill="#fff6e6" stroke="#6b4a33" strokeWidth="1.5" />
                <text y="4" textAnchor="middle" className="firewood-ratio">{ratioLabel(logs[i].ratio)}</text>
              </g>
            ))}
          </g>

          <Rack rounds={split} fresh={fresh} />
          <g transform="translate(50 28)">
            <rect x="-36" y="-16" width="72" height="30" rx="10" fill="#fff6e6" stroke="#6b4a33" strokeWidth="2" />
            <text y="5" textAnchor="middle" className="firewood-count">🪵 {logsDone(split)}/{LOG_TOTAL}</text>
          </g>
        </svg>
      </div>

      <p className="firewood__status" role="status" data-tone={phase === 'shatter' ? 'hint' : done ? 'done' : undefined}>
        {status}
      </p>

      {!done ? (
        <div className="firewood__controls">
          <button
            type="button"
            className="button button--quiet firewood__turn"
            aria-label="Nach links drehen"
            disabled={!aiming}
            onPointerDown={(e) => startRepeat(e, -1)}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
            onClick={(e) => keyStep(e, -1)}
          >
            ⟲
          </button>
          <button type="button" className="button firewood__chop" disabled={!aiming} onClick={chop}>
            <span aria-hidden="true">🪓</span> Hacken!
          </button>
          <button
            type="button"
            className="button button--quiet firewood__turn"
            aria-label="Nach rechts drehen"
            disabled={!aiming}
            onPointerDown={(e) => startRepeat(e, 1)}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
            onClick={(e) => keyStep(e, 1)}
          >
            ⟳
          </button>
        </div>
      ) : (
        <div className="firewood__controls">
          <button type="button" className="button" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Ab in den Kamin – Überraschung öffnen'}
          </button>
          <button type="button" className="button button--quiet" onClick={replay}>
            Noch einmal hacken
          </button>
        </div>
      )}
      {!done && (
        <p className="firewood__hint">
          {logs.length > 1
            ? 'Greif einen Scheit und dreh ihn – die anderen drehen sich über die Zahnräder mit.'
            : 'Tipp: Scheit mit dem Finger drehen – die Pfeile helfen beim Feinjustieren.'}
        </p>
      )}
    </div>
  )
}
