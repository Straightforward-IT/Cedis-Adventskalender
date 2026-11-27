import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { MinigameProps } from '../../types.ts'
import {
  BOARD, CANDY_TYPES, canPlace, isBuilt, isDecorated, MIN_CANDIES, nearSlot, onHouse,
  pieceById, PIECES, restoreState, TRAY_Y,
} from './model.ts'
import type { Candy, CandyType, GingerbreadState, PieceId } from './model.ts'
import './gingerbread.css'

const DOUGH = '#c27a3e'
const DOUGH_EDGE = '#8a4f22'
const ICING = '#fffaf2'
/** Süßigkeiten auf dem Haus etwas größer, damit man sie gut sieht und wieder greifen kann. */
const CANDY_SCALE = 1.35
const SMARTIES = ['#d33b33', '#3f6fb5', '#f5d04a', '#4f9a5a', '#f08bb0', '#f2a33a']

/** In der Ablage liegen die Teile durcheinander – sonst wäre die Reihenfolge verraten. */
const TRAY_ORDER: PieceId[] = ['roofRight', 'door', 'base', 'chimney', 'wall', 'roofLeft']
const trayX = (i: number, count: number) => 36 + (i * (BOARD.width - 72)) / (count - 1)
const TRAY_CENTER_Y = TRAY_Y + 50
/** Jedes Teil liegt auf einer eigenen Kachel – die ganze Kachel ist anfassbar (gut 50 px auf dem Handy). */
const TILE = { w: 58, h: 86 }

type Drag =
  | { kind: 'piece'; id: PieceId; x: number; y: number }
  | { kind: 'candy'; candy: Candy; isNew: boolean }

/** Verzierungen, die zu jedem Teil gehören – mit Zuckerguss gemalt. */
function PieceArt({ id }: { id: PieceId }) {
  const piece = pieceById(id)
  const body = <path d={piece.path} fill={id === 'door' ? '#8a4f22' : DOUGH} stroke={DOUGH_EDGE} strokeWidth="3" strokeLinejoin="round" />
  const icing = { fill: 'none', stroke: ICING, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (id) {
    case 'base':
      return <g>{body}{Array.from({ length: 16 }, (_, i) => <circle key={i} cx={86 + i * 15.2} cy={271} r={2.4} fill={ICING} />)}</g>
    case 'wall':
      return (
        <g>
          {body}
          {[124, 240].map((x) => (
            <g key={x}>
              <rect x={x} y={188} width={36} height={32} rx={4} fill="#ffd37a" />
              <rect x={x} y={188} width={36} height={32} rx={4} {...icing} />
              <path d={`M${x + 18} 188V220M${x} 204H${x + 36}`} {...icing} strokeWidth={2.4} />
            </g>
          ))}
          <path d="M116 244q8 -6 16 0t16 0M252 244q8 -6 16 0t16 0" {...icing} strokeWidth={2.4} />
        </g>
      )
    case 'roofLeft':
    case 'roofRight': {
      const side = id === 'roofLeft' ? -1 : 1
      const x = (t: number) => 200 + side * 112 * t
      return (
        <g>
          {body}
          {Array.from({ length: 7 }, (_, i) => {
            const t = (i + 0.6) / 7.4
            return <circle key={i} cx={x(t)} cy={102 + 88 * t} r={2.6} fill={ICING} />
          })}
        </g>
      )
    }
    case 'chimney':
      return <g>{body}<path d="M244 116H272M244 132H272M258 100V116M251 116V132M265 116V132" {...icing} strokeWidth={2} /></g>
    case 'door':
      return <g>{body}<path d={piece.path} {...icing} strokeWidth={2.4} /><circle cx={208} cy={248} r={2.6} fill="#f5d04a" /><path d="M200 236c-3-4-8-1-5 3l5 4 5-4c3-4-2-7-5-3Z" fill="#d33b33" /></g>
  }
}

/** Zuckerguss: dicke Schicht über dem Dachfirst mit Tropfen, Schnee auf Schornstein und Platte. */
function Icing() {
  const drips: ReactNode[] = []
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    for (let t = 0.06; t < 1; t += 0.11) {
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      drips.push(<path key={`${x}-${y}`} d={`M${x - 4} ${y}q0 ${9 + (Math.round(t * 10) % 3) * 4} 4 ${9 + (Math.round(t * 10) % 3) * 4}q4 0 4 -${9 + (Math.round(t * 10) % 3) * 4}Z`} fill={ICING} />)
    }
  }
  edge(80, 186, 200, 90)
  edge(200, 90, 320, 186)
  return (
    <g className="ginger-icing" pointerEvents="none">
      <path d="M78 188L200 86L322 188" fill="none" stroke={ICING} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      {drips}
      <path d="M240 101q4-8 9-2q5-7 10 0q5-7 10 0q5-6 8 2Z" fill={ICING} />
      <path d="M74 263q12-8 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t20 0V266H74Z" fill={ICING} />
    </g>
  )
}

function star(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
}

/** Eine Süßigkeit, gezeichnet um (0, 0). */
function CandyArt({ type, variant }: { type: CandyType; variant: number }) {
  switch (type) {
    case 'gumdropRed':
    case 'gumdropGreen': {
      const color = type === 'gumdropRed' ? '#d9363e' : '#3e9a55'
      return (
        <g>
          <path d="M-9 6Q-9 -10 0 -10Q9 -10 9 6Z" fill={color} stroke="rgb(0 0 0 / 0.25)" strokeWidth="1" />
          {[[-4, -2], [3, -5], [4, 2], [-1, 3]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1} fill="#fff" opacity="0.8" />)}
        </g>
      )
    }
    case 'smartie':
      return (
        <g>
          <ellipse rx="7.5" ry="6.5" fill={SMARTIES[variant % SMARTIES.length]} stroke="rgb(0 0 0 / 0.2)" strokeWidth="1" />
          <ellipse cx="-2.5" cy="-2.5" rx="2.4" ry="1.5" fill="#fff" opacity="0.6" />
        </g>
      )
    case 'cane':
      return (
        <g fill="none" strokeLinecap="round">
          <path d="M3 12V-5a5 5 0 0 0 -10 0" stroke="#fff" strokeWidth="5" />
          <path d="M3 12V-5a5 5 0 0 0 -10 0" stroke="#d33b33" strokeWidth="5" strokeDasharray="3 3" />
        </g>
      )
    case 'star':
      return <polygon points={star(0, 0, 10)} fill="#f5d04a" stroke="#c9952a" strokeWidth="1.2" strokeLinejoin="round" />
    case 'heart':
      return <path d="M0 9C-14 0 -9 -11 0 -5C9 -11 14 0 0 9Z" fill="#a9622e" stroke={ICING} strokeWidth="2" strokeLinejoin="round" />
  }
}

export default function GingerbreadGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [state, setState] = useState<GingerbreadState>(() => restoreState(savedState))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [settled, setSettled] = useState<PieceId | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const nextId = useRef(state.candies.reduce((max, c) => Math.max(max, c.id), 0) + 1)
  const save = useEffectEvent(saveState)
  useEffect(() => { save(state) }, [state])
  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [message])

  const built = isBuilt(state.placed)
  const decorated = isDecorated(state)
  const remaining = TRAY_ORDER.filter((id) => !state.placed.includes(id))

  const toBoard = (event: { clientX: number; clientY: number }) => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  const capture = (event: PointerEvent) => {
    try {
      svg.current?.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture geht es auch.
    }
  }

  const place = (id: PieceId) => {
    if (!canPlace(state.placed, id)) {
      setMessage(pieceById(id).hint)
      return false
    }
    setState((s) => ({ ...s, placed: [...s.placed, id] }))
    setSettled(id)
    setMessage(null)
    return true
  }

  const newCandy = (type: CandyType, x: number, y: number): Candy => ({
    id: nextId.current++,
    type,
    x,
    y,
    rotate: Math.round((Math.random() - 0.5) * 50),
    variant: Math.floor(Math.random() * SMARTIES.length),
  })

  const onPiecePointerDown = (event: PointerEvent, id: PieceId) => {
    event.preventDefault()
    capture(event)
    setDrag({ kind: 'piece', id, ...toBoard(event) })
  }

  const onCandyPointerDown = (event: PointerEvent, candy: Candy, isNew: boolean) => {
    event.preventDefault()
    event.stopPropagation()
    capture(event)
    const p = toBoard(event)
    setDrag({ kind: 'candy', candy: { ...candy, x: p.x, y: p.y }, isNew })
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return
    const p = toBoard(event)
    setDrag(drag.kind === 'piece' ? { ...drag, ...p } : { ...drag, candy: { ...drag.candy, ...p } })
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.kind === 'piece') {
      if (nearSlot(drag.id, drag.x, drag.y)) place(drag.id)
      else if (drag.y < TRAY_Y) setMessage(`${pieceById(drag.id).label}: Das passt noch nicht an diese Stelle.`)
    } else {
      const { candy, isNew } = drag
      const keep = onHouse(candy.x, candy.y)
      setState((s) => {
        const others = s.candies.filter((c) => c.id !== candy.id)
        return { ...s, candies: keep ? [...others, candy] : others }
      })
      if (!keep && isNew) setMessage('Süßigkeiten halten nur auf dem Haus.')
    }
    setDrag(null)
  }

  const onPieceKey = (event: KeyboardEvent, id: PieceId) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    place(id)
  }

  const onCandyKey = (event: KeyboardEvent, type: CandyType) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    // Ohne Maus: irgendwo aufs Haus setzen.
    let x = 200
    let y = 220
    for (let i = 0; i < 40; i++) {
      x = 90 + Math.random() * 220
      y = 100 + Math.random() * 170
      if (onHouse(x, y)) break
    }
    setState((s) => ({ ...s, candies: [...s.candies, newCandy(type, x, y)] }))
  }

  const draggingPiece = drag?.kind === 'piece' ? drag.id : null
  const status = message
    ?? (!built
      ? `Bau das Haus: Zieh die Teile an ihren Platz (${state.placed.length} von ${PIECES.length}).`
      : !state.icing
        ? 'Das Haus steht! Jetzt kommt der Zuckerguss.'
        : decorated
          ? 'Ein richtiges Hexenhäuschen! 🍬'
          : `Verzier dein Haus – noch ${MIN_CANDIES - state.candies.length} Süßigkeiten.`)

  return (
    <div className="ginger" data-built={built}>
      <div className="ginger__board">
        <svg
          ref={svg}
          viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
          role="group"
          aria-label={built ? `Lebkuchenhaus mit ${state.candies.length} Süßigkeiten` : `Lebkuchenhaus, ${state.placed.length} von ${PIECES.length} Teilen gebaut`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          <defs>
            <radialGradient id="ginger-glow" cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#fff4dc" />
              <stop offset="1" stopColor="#f3dcb4" />
            </radialGradient>
          </defs>
          <rect width={BOARD.width} height={TRAY_Y} fill="url(#ginger-glow)" />
          <ellipse cx="200" cy="284" rx="170" ry="12" fill="#e6c79c" />
          <rect y={TRAY_Y} width={BOARD.width} height={BOARD.height - TRAY_Y} fill="#7a4b2e" />
          <rect y={TRAY_Y} width={BOARD.width} height="4" fill="#5c3720" />

          {/* Platzhalter für noch fehlende Teile */}
          {PIECES.filter((p) => !state.placed.includes(p.id)).map((p) => (
            <path
              key={p.id}
              d={p.path}
              className="ginger-ghost"
              data-ready={canPlace(state.placed, p.id)}
              data-target={draggingPiece === p.id}
            />
          ))}

          {/* Gebaute Teile in fester Zeichenreihenfolge */}
          {PIECES.filter((p) => state.placed.includes(p.id)).map((p) => (
            <g key={p.id} className="ginger-piece" data-settled={settled === p.id}>
              <PieceArt id={p.id} />
            </g>
          ))}

          {built && state.icing && <Icing />}

          {state.candies.map((candy) =>
            drag?.kind === 'candy' && drag.candy.id === candy.id ? null : (
              <g
                key={candy.id}
                className="ginger-candy"
                transform={`translate(${candy.x} ${candy.y}) rotate(${candy.rotate}) scale(${CANDY_SCALE})`}
                onPointerDown={(e) => onCandyPointerDown(e, candy, false)}
              >
                <CandyArt type={candy.type} variant={candy.variant} />
              </g>
            ),
          )}

          {/* Ablage: erst Bauteile, danach Süßigkeiten */}
          {!built && remaining.map((id) => {
            const piece = pieceById(id)
            const i = TRAY_ORDER.indexOf(id)
            const held = drag?.kind === 'piece' && drag.id === id ? drag : null
            const dragging = held !== null
            const s = held ? 1 : Math.min(0.55, (TILE.w - 8) / piece.size.w, (TILE.h - 14) / piece.size.h)
            const x = held ? held.x : trayX(i, TRAY_ORDER.length)
            const y = held ? held.y : TRAY_CENTER_Y
            return (
              <g
                key={id}
                className="ginger-tray-piece"
                data-dragging={dragging}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`${piece.label} einbauen`}
                onPointerDown={(e) => onPiecePointerDown(e, id)}
                onKeyDown={(e) => onPieceKey(e, id)}
              >
                {!held && <rect className="ginger-tile" x={-TILE.w / 2} y={-TILE.h / 2} width={TILE.w} height={TILE.h} rx="10" />}
                <g transform={`scale(${s}) translate(${-piece.center.x} ${-piece.center.y})`}>
                  <PieceArt id={id} />
                </g>
              </g>
            )
          })}

          {built && CANDY_TYPES.map(({ type, label }, i) => (
            <g
              key={type}
              className="ginger-tray-candy"
              transform={`translate(${trayX(i, CANDY_TYPES.length)} ${TRAY_CENTER_Y}) scale(2)`}
              role="button"
              tabIndex={0}
              aria-label={`${label} aufs Haus setzen`}
              onPointerDown={(e) => onCandyPointerDown(e, newCandy(type, 0, 0), true)}
              onKeyDown={(e) => onCandyKey(e, type)}
            >
              <rect className="ginger-tile" x={-TILE.w / 4} y={-TILE.h / 4} width={TILE.w / 2} height={TILE.h / 2} rx="5" />
              <CandyArt type={type} variant={i} />
            </g>
          ))}

          {drag?.kind === 'candy' && (
            <g transform={`translate(${drag.candy.x} ${drag.candy.y}) rotate(${drag.candy.rotate}) scale(${CANDY_SCALE * 1.15})`} pointerEvents="none" opacity={onHouse(drag.candy.x, drag.candy.y) ? 1 : 0.55}>
              <CandyArt type={drag.candy.type} variant={drag.candy.variant} />
            </g>
          )}
        </svg>
      </div>

      <p className="ginger__status" role="status" data-tone={message ? 'hint' : decorated ? 'done' : undefined}>{status}</p>

      {built && (
        <div className="ginger__actions">
          {!state.icing && (
            <button type="button" className="button" onClick={() => setState((s) => ({ ...s, icing: true }))}>
              <span aria-hidden="true">🧁</span> Zuckerguss drauf
            </button>
          )}
          {state.icing && (
            <button type="button" className="button" disabled={!decorated} onClick={onComplete}>
              {completedBefore ? 'Überraschung noch einmal ansehen' : 'Fertig – Überraschung öffnen'}
            </button>
          )}
          {state.candies.length > 0 && (
            <button type="button" className="button button--quiet" onClick={() => setState((s) => ({ ...s, candies: [] }))}>
              Süßigkeiten abräumen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
