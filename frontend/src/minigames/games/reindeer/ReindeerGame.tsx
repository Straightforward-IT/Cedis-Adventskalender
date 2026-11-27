import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { ALL_DOTS, ANTLER_LEFT, ANTLER_RIGHT, BOARD, connect, connectedPath, currentDot, DOTS, freshGame, hintDot, HINT_AFTER, isComplete, startGame } from './model.ts'
import type { Dot, DotsState } from './model.ts'
import './reindeer.css'

/** So nah (in Spielfeld-Einheiten) muss ein Tipp an einem Punkt liegen. */
const PICK_RADIUS = 30
/** So lange bleibt eine falsche Linie sichtbar, bevor sie wieder verschwindet. */
const WRONG_LINE_MS = 650

type Flash = { from: number; to: number; key: number }
type Feedback = 'start' | 'correct' | 'wrong'

const points = (indices: readonly number[]) => indices.map((i) => `${DOTS[i].x},${DOTS[i].y}`).join(' ')

/** Reihenfolge im Dokument nach Lage statt nach Weg – sonst verriete die Tab-Reihenfolge die Lösung. */
const DOM_ORDER = ALL_DOTS.map((_, i) => i).sort((a, b) => ALL_DOTS[a].y - ALL_DOTS[b].y || ALL_DOTS[a].x - ALL_DOTS[b].x)

function nearestDot(point: Dot): number | null {
  let best: number | null = null
  let bestDistance = PICK_RADIUS
  ALL_DOTS.forEach((dot, i) => {
    const distance = Math.hypot(dot.x - point.x, dot.y - point.y)
    if (distance <= bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

function message(state: DotsState, feedback: Feedback): string {
  if (isComplete(state)) return 'Ein Rentier!'
  if (hintDot(state) !== null) return 'Folge dem goldenen Punkt.'
  if (feedback === 'wrong') return 'Nicht ganz!'
  if (state.lines === 0) return 'Starte am Stern.'
  return ''
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const path = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.45 : r
    return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`
  }).join(' ')
  return <polygon points={path} />
}

/** Das fertige Bild, das nach der letzten Linie im Umriss erscheint. */
function ReindeerArt() {
  return (
    <g className="dots-art" aria-hidden="true">
      <polygon points={points(DOTS.map((_, i) => i))} fill="url(#dots-fur)" />
      <polygon points={points(ANTLER_LEFT)} className="dots-art__antler" />
      <polygon points={points(ANTLER_RIGHT)} className="dots-art__antler" />
      <ellipse cx="66" cy="213" rx="22" ry="8" transform="rotate(-24 66 213)" fill="#e9a69a" />
      <ellipse cx="334" cy="213" rx="22" ry="8" transform="rotate(24 334 213)" fill="#e9a69a" />
      <path d="M152 186q48-26 96 0-10 26-48 28-38-2-48-28Z" fill="#b98457" opacity="0.55" />
      <ellipse cx="200" cy="374" rx="62" ry="44" fill="#e3c39c" />
      <circle cx="138" cy="318" r="15" fill="#e98b7d" opacity="0.45" />
      <circle cx="262" cy="318" r="15" fill="#e98b7d" opacity="0.45" />
      <g fill="#3a2418">
        <ellipse cx="162" cy="268" rx="10" ry="13" />
        <ellipse cx="238" cy="268" rx="10" ry="13" />
      </g>
      <g fill="#fff">
        <circle cx="165" cy="263" r="3.5" />
        <circle cx="241" cy="263" r="3.5" />
      </g>
      <path d="M142 246q18-10 32-2M226 244q14-8 32 2" fill="none" stroke="#5a3a26" strokeWidth="4" strokeLinecap="round" />
      <path d="M178 392q22 16 44 0" fill="none" stroke="#7a4b2e" strokeWidth="4" strokeLinecap="round" />
      <g className="dots-art__nose">
        <ellipse cx="200" cy="346" rx="26" ry="19" fill="#d33b33" />
        <ellipse cx="192" cy="340" rx="8" ry="5" fill="#ff9d8c" />
      </g>
      <g className="dots-art__sparkles" fill="#e8b04a">
        <Star x={30} y={120} r={9} />
        <Star x={372} y={110} r={11} />
        <Star x={52} y={330} r={7} />
        <Star x={352} y={340} r={9} />
        <Star x={200} y={70} r={8} />
      </g>
    </g>
  )
}

function Snow() {
  return (
    <g className="dots-snow" aria-hidden="true">
      <path d="M-10 432q90-26 190-6t230-10v44H-10Z" fill="#fff" />
      <g fill="#fff" opacity="0.9">
        <circle cx="20" cy="30" r="3" /><circle cx="380" cy="24" r="2.5" /><circle cx="300" cy="80" r="2" />
        <circle cx="12" cy="280" r="2.5" /><circle cx="390" cy="250" r="3" /><circle cx="260" cy="20" r="2" />
        <circle cx="150" cy="10" r="2" /><circle cx="388" cy="400" r="2" /><circle cx="14" cy="400" r="2.5" />
      </g>
    </g>
  )
}

export default function ReindeerGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [state, setState] = useState(() => startGame(savedState, completedBefore))
  // Schnelle Doppeltipps sollen auf dem neuesten Stand aufbauen, nicht auf dem letzten Render.
  const live = useRef(state)
  const [feedback, setFeedback] = useState<Feedback>('start')
  const [flash, setFlash] = useState<Flash | null>(null)
  const [pointer, setPointer] = useState<Dot | null>(null)
  const board = useRef<SVGSVGElement>(null)
  const save = useEffectEvent(saveState)
  useEffect(() => { save(state) }, [state])
  useEffect(() => {
    if (!flash) return
    const timeout = window.setTimeout(() => setFlash(null), WRONG_LINE_MS)
    return () => window.clearTimeout(timeout)
  }, [flash])

  const done = isComplete(state)
  const path = useMemo(() => connectedPath(state), [state])
  const connected = useMemo(() => new Set(path), [path])
  const current = currentDot(state)
  const hint = hintDot(state)
  const hovered = pointer && !done ? nearestDot(pointer) : null

  const update = (next: DotsState) => {
    live.current = next
    setState(next)
  }

  const tap = (dot: number) => {
    const before = live.current
    const { state: next, result } = connect(before, dot)
    if (result === 'ignored') return
    setFeedback(result)
    setFlash(result === 'wrong' ? { from: currentDot(before), to: dot, key: Date.now() } : null)
    update(next)
  }

  const toBoard = (event: { clientX: number; clientY: number }): Dot | null => {
    const matrix = board.current?.getScreenCTM()
    if (!matrix) return null
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }

  const onBoardClick = (event: MouseEvent<SVGSVGElement>) => {
    const point = toBoard(event)
    const near = point ? nearestDot(point) : null
    // Bildschirmleser lösen Klicks ohne Koordinaten aus – dann zählt das Element selbst.
    const target = (event.target as Element).closest('[data-dot]')?.getAttribute('data-dot')
    const dot = near ?? (target ? Number(target) : null)
    if (dot !== null) tap(dot)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse') setPointer(toBoard(event))
  }

  const onDotKey = (event: KeyboardEvent, dot: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    tap(dot)
  }

  const restart = () => {
    update(freshGame())
    setFeedback('start')
    setFlash(null)
  }

  const from = DOTS[current]
  const rubber = !done && pointer && !flash ? (hovered !== null ? ALL_DOTS[hovered] : pointer) : null

  return (
    <div className="dots" data-done={done}>
      <div className="dots__board">
        <svg
          ref={board}
          viewBox={`-12 -12 ${BOARD.width + 24} ${BOARD.height + 24}`}
          role="group"
          aria-label={done ? 'Fertiges Bild: ein Rentierkopf' : `Punktebild, ${state.lines} von ${DOTS.length} Linien gezogen`}
          onClick={onBoardClick}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setPointer(null)}
        >
          <defs>
            <radialGradient id="dots-fur" cx="50%" cy="55%" r="60%">
              <stop offset="0" stopColor="#b5804f" />
              <stop offset="1" stopColor="#8a5a36" />
            </radialGradient>
          </defs>
          <Snow />
          {done && <ReindeerArt />}
          {rubber && <line className="dots-rubber" x1={from.x} y1={from.y} x2={rubber.x} y2={rubber.y} />}
          <polyline className="dots-line" points={points(path)} />
          {flash && (
            <line key={flash.key} className="dots-wrong-line" x1={DOTS[flash.from].x} y1={DOTS[flash.from].y} x2={ALL_DOTS[flash.to].x} y2={ALL_DOTS[flash.to].y} />
          )}
          {!done && DOM_ORDER.map((i) => {
            const dot = ALL_DOTS[i]
            const isStart = i === 0 && state.lines === 0
            return (
              <g
                key={i}
                data-dot={i}
                className="dots-dot"
                data-connected={connected.has(i)}
                data-current={i === current}
                data-hint={i === hint}
                data-hover={i === hovered}
                data-wrong={flash?.to === i}
                role="button"
                tabIndex={0}
                aria-label={isStart ? 'Startpunkt' : connected.has(i) ? 'Verbundener Punkt' : 'Punkt'}
                onKeyDown={(event) => onDotKey(event, i)}
              >
                {i === hint && <circle className="dots-dot__hint" cx={dot.x} cy={dot.y} r="17" />}
                {isStart ? (
                  <g className="dots-dot__start"><Star x={dot.x} y={dot.y} r={13} /></g>
                ) : (
                  <circle className="dots-dot__core" cx={dot.x} cy={dot.y} r="7" />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <p className="dots__status" role="status" data-tone={done ? 'done' : hint !== null ? 'hint' : feedback}>
        {message(state, feedback)}
      </p>

      {done ? (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      ) : (
        <div className="dots__meta">
          <div className="dots__progress" aria-label={`${state.lines} von ${DOTS.length} Linien`}>
            <span style={{ width: `${(state.lines / DOTS.length) * 100}%` }} />
          </div>
          <div className="dots__misses" aria-label={`${state.misses} von ${HINT_AFTER} Fehlversuchen bis zum Tipp`}>
            {Array.from({ length: HINT_AFTER }, (_, i) => <span key={i} data-used={i < state.misses} aria-hidden="true">❄</span>)}
          </div>
          <button type="button" className="dots__restart" onClick={restart} disabled={state.lines === 0}>
            <span aria-hidden="true">↻</span> Von vorn
          </button>
        </div>
      )}
    </div>
  )
}
