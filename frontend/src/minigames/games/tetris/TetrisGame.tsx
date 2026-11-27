import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import {
  bag,
  BOW,
  cellsOf,
  clearRows,
  dropTarget,
  emptyBoard,
  fits,
  fallInterval,
  GOAL,
  HEIGHT,
  KINDS,
  lock,
  move,
  restore,
  rotate,
  shapeCells,
  spawn,
  WIDTH,
} from './model.ts'
import type { Board, Piece } from './model.ts'
import './tetris.css'

/** So lange darf ein aufgesetztes Paket noch geschoben werden. */
const LOCK_DELAY = 0.5
const LOCK_MOVES = 15
const FLASH = 0.42

interface Game {
  board: Board
  piece: Piece | null
  queue: number[]
  rows: number
  done: boolean
  flash: { rows: number[]; left: number } | null
  fall: number
  grounded: number
  moves: number
}

type Action = 'left' | 'right' | 'cw' | 'ccw' | 'down' | 'drop'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Eine Zelle: Geschenkpapier, Band über Kreuz, auf der Schleifenzelle eine Schleife. */
function drawPresent(ctx: CanvasRenderingContext2D, cell: number, px: number, py: number, size: number, alpha = 1) {
  const kind = KINDS[cell & 7]
  const pad = size * 0.06
  const s = size - pad * 2
  const x = px + pad
  const y = py + pad
  ctx.globalAlpha = alpha
  roundRect(ctx, x, y, s, s, size * 0.14)
  ctx.fillStyle = kind.paper
  ctx.fill()
  // Licht oben, Schatten unten.
  ctx.fillStyle = 'rgb(255 255 255 / 0.18)'
  ctx.fillRect(x + s * 0.1, y + s * 0.08, s * 0.8, s * 0.12)
  ctx.fillStyle = 'rgb(0 0 0 / 0.16)'
  ctx.fillRect(x + s * 0.1, y + s * 0.84, s * 0.8, s * 0.08)
  // Das Band.
  ctx.fillStyle = kind.ribbon
  const band = s * 0.18
  ctx.fillRect(x + (s - band) / 2, y, band, s)
  ctx.fillRect(x, y + (s - band) / 2, s, band)
  if (cell & BOW) {
    const cx = x + s / 2
    const cy = y + s / 2
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.17, cy - s * 0.06, s * 0.17, s * 0.11, -0.5, 0, Math.PI * 2)
    ctx.ellipse(cx + s * 0.17, cy - s * 0.06, s * 0.17, s * 0.11, 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgb(0 0 0 / 0.25)'
    ctx.lineWidth = Math.max(1, size * 0.03)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy - s * 0.04, s * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function Preview({ kind }: { kind: number }) {
  const cells = shapeCells(kind, 0)
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const w = Math.max(...xs) - Math.min(...xs) + 1
  const h = Math.max(...ys) - Math.min(...ys) + 1
  const { paper, ribbon } = KINDS[kind]
  return (
    <svg viewBox={`-0.1 -0.1 ${w + 0.2} ${h + 0.2}`} className="tetris__preview" aria-label={`Als Nächstes: ${KINDS[kind].name}`}>
      {cells.map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x - Math.min(...xs)} ${y - Math.min(...ys)})`}>
          <rect x={0.05} y={0.05} width={0.9} height={0.9} rx={0.13} fill={paper} />
          <rect x={0.41} y={0.05} width={0.18} height={0.9} fill={ribbon} />
          <rect x={0.05} y={0.41} width={0.9} height={0.18} fill={ribbon} />
        </g>
      ))}
    </svg>
  )
}

export default function TetrisGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [start] = useState(() => restore(savedState))
  const game = useRef<Game>(null as unknown as Game)
  if (!game.current) {
    const queue = [...bag(), ...bag()]
    const first = queue.shift()!
    game.current = {
      board: start.board,
      piece: start.rows >= GOAL ? null : spawn(first),
      queue,
      rows: start.rows,
      done: start.rows >= GOAL,
      flash: null,
      fall: 0,
      grounded: 0,
      moves: 0,
    }
  }
  const [rows, setRows] = useState(start.rows)
  const [next, setNext] = useState(game.current.queue[0])
  const [done, setDone] = useState(game.current.done)
  const [paused, setPaused] = useState(game.current.done)
  const [bump, setBump] = useState(0)
  const [message, setMessage] = useState<{ text: string; tone?: 'hint' | 'done' }>(() =>
    game.current.done
      ? { text: 'Der Schlitten ist voll beladen!', tone: 'done' }
      : start.rows > 0
        ? { text: `Weiter geht’s – ${start.rows} von ${GOAL} Reihen sind schon verladen.` }
        : { text: 'Staple die Geschenke so, dass Reihen ganz voll werden.' },
  )
  const gesture = useRef<{ id: number; x: number; y: number; t: number; cols: number; rows: number; moved: boolean } | null>(null)

  const save = () => saveState({ rows: game.current.rows, board: game.current.board })

  const spawnNext = () => {
    const g = game.current
    if (g.queue.length < 8) g.queue.push(...bag())
    g.piece = spawn(g.queue.shift()!)
    g.fall = 0
    g.grounded = 0
    g.moves = 0
    setNext(g.queue[0])
    if (!fits(g.board, g.piece)) topple()
  }

  /** Der Stapel reicht bis unters Dach: umkippen, frisch anfangen – verladene Reihen bleiben. */
  const topple = () => {
    const g = game.current
    g.board = emptyBoard()
    g.piece = null
    setMessage({ text: 'Hoppla, der Stapel ist umgekippt! Frisch aufgestapelt – die verladenen Reihen bleiben.', tone: 'hint' })
    save()
    spawnNext()
  }

  const settle = () => {
    const g = game.current
    if (!g.piece) return
    const result = lock(g.board, g.piece)
    g.piece = null
    if (result.overflow) {
      topple()
      return
    }
    g.board = result.board
    if (result.full.length) {
      g.flash = { rows: result.full, left: FLASH }
      return
    }
    save()
    spawnNext()
  }

  const finishFlash = () => {
    const g = game.current
    if (!g.flash) return
    const count = g.flash.rows.length
    g.board = clearRows(g.board, g.flash.rows)
    g.flash = null
    const before = g.rows
    g.rows = Math.min(GOAL, g.rows + count)
    setRows(g.rows)
    setBump((b) => b + 1)
    if (g.rows >= GOAL && before < GOAL) {
      g.done = true
      setDone(true)
      setPaused(true)
      setMessage({ text: 'Geschafft – der Schlitten ist voll beladen!', tone: 'done' })
      save()
      return
    }
    if (!g.done) {
      setMessage(
        count >= 4
          ? { text: 'Vier Reihen auf einmal – ein ganzer Gabenstapel!', tone: 'done' }
          : count > 1
            ? { text: `${count} Reihen auf einmal – prima!`, tone: 'done' }
            : { text: 'Eine Reihe ist auf dem Schlitten!', tone: 'done' },
      )
    }
    save()
    spawnNext()
  }

  const act = (action: Action) => {
    const g = game.current
    if (paused || !g.piece || g.flash) return
    const piece = g.piece
    let moved: Piece | null = null
    switch (action) {
      case 'left':
        moved = move(g.board, piece, -1, 0)
        break
      case 'right':
        moved = move(g.board, piece, 1, 0)
        break
      case 'cw':
        moved = rotate(g.board, piece, 1)
        break
      case 'ccw':
        moved = rotate(g.board, piece, -1)
        break
      case 'down':
        moved = move(g.board, piece, 0, 1)
        if (moved) g.fall = 0
        break
      case 'drop':
        g.piece = dropTarget(g.board, piece)
        settle()
        return
    }
    if (!moved) return
    g.piece = moved
    // Wer am Boden noch schiebt, bekommt etwas mehr Zeit – aber nicht unendlich.
    if (g.grounded > 0 && g.moves < LOCK_MOVES && action !== 'down') {
      g.grounded = 0
      g.moves++
    }
  }

  // Spielschleife und Zeichnen.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    let frame = 0
    let last = 0
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()

    const draw = (now: number) => {
      const g = game.current
      const size = el.width / WIDTH
      ctx.clearRect(0, 0, el.width, el.height)
      // Ein leises Raster wie Regalfächer.
      ctx.strokeStyle = 'rgb(255 255 255 / 0.05)'
      ctx.lineWidth = 1
      for (let x = 1; x < WIDTH; x++) {
        ctx.beginPath()
        ctx.moveTo(x * size, 0)
        ctx.lineTo(x * size, el.height)
        ctx.stroke()
      }
      for (let y = 1; y < HEIGHT; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * size)
        ctx.lineTo(el.width, y * size)
        ctx.stroke()
      }
      g.board.forEach((row, y) => row.forEach((cell, x) => cell && drawPresent(ctx, cell, x * size, y * size, size)))
      if (g.flash) {
        const pulse = 0.45 + 0.4 * Math.abs(Math.sin(now / 60))
        ctx.fillStyle = `rgb(255 248 220 / ${pulse})`
        for (const y of g.flash.rows) ctx.fillRect(0, y * size, el.width, size)
      }
      if (g.piece) {
        {
          const ghost = dropTarget(g.board, g.piece)
          for (const [x, y] of cellsOf(ghost)) {
            if (y < 0) continue
            roundRect(ctx, x * size + size * 0.1, y * size + size * 0.1, size * 0.8, size * 0.8, size * 0.14)
            ctx.strokeStyle = KINDS[g.piece.kind].paper
            ctx.globalAlpha = 0.55
            ctx.lineWidth = Math.max(1.5, size * 0.06)
            ctx.setLineDash([size * 0.12, size * 0.1])
            ctx.stroke()
            ctx.setLineDash([])
            ctx.globalAlpha = 1
          }
        }
        cellsOf(g.piece).forEach(([x, y], i) => y >= 0 && drawPresent(ctx, g.piece!.kind + (i === 0 ? BOW : 0), x * size, y * size, size))
      }
    }

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      const g = game.current
      if (!paused) {
        if (g.flash) {
          g.flash.left -= dt
          if (g.flash.left <= 0) finishFlash()
        } else if (g.piece) {
          const below = move(g.board, g.piece, 0, 1)
          if (below) {
            g.grounded = 0
            g.fall += dt
            if (g.fall >= fallInterval(g.rows)) {
              g.fall = 0
              g.piece = below
            }
          } else {
            g.grounded += dt
            if (g.grounded >= LOCK_DELAY) settle()
          }
        }
      }
      draw(now)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    if (import.meta.env.DEV) Object.assign(window, { __tetris: game.current })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // Die Schleife liest den Spielstand aus dem Ref; nur Pause startet sie neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  // Tastatur: Pfeile schieben und drehen, Leertaste lässt fallen.
  useEffect(() => {
    const keys: Record<string, Action> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowDown: 'down',
      ArrowUp: 'cw',
      KeyX: 'cw',
      KeyZ: 'ccw',
      KeyY: 'ccw',
      Space: 'drop',
    }
    const onKey = (event: KeyboardEvent) => {
      const action = keys[event.code]
      if (!action) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, button')) {
        if (event.code === 'Space') return
      }
      event.preventDefault()
      if (event.repeat && action === 'drop') return
      act(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Wischen: zur Seite schieben, nach unten ziehen, schnell runter = fallen lassen, Tippen = drehen.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button > 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture endet die Geste, wenn der Finger das Feld verlässt.
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), cols: 0, rows: 0, moved: false }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || g.id !== event.pointerId) return
    const cell = event.currentTarget.clientWidth / WIDTH
    const cols = Math.trunc((event.clientX - g.x) / cell)
    const rowsDown = Math.max(0, Math.trunc((event.clientY - g.y) / cell))
    for (; g.cols < cols; g.cols++) act('right')
    for (; g.cols > cols; g.cols--) act('left')
    for (; g.rows < rowsDown; g.rows++) act('down')
    if (Math.hypot(event.clientX - g.x, event.clientY - g.y) > 8) g.moved = true
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || g.id !== event.pointerId) return
    gesture.current = null
    const time = performance.now() - g.t
    const dy = event.clientY - g.y
    const dx = event.clientX - g.x
    if (!g.moved && time < 350) act('cw')
    else if (dy > 40 && dy / time > 0.9 && Math.abs(dx) < dy * 0.6) act('drop')
  }

  const restack = () => {
    const g = game.current
    g.board = emptyBoard()
    g.flash = null
    g.queue = [...bag(), ...bag()]
    spawnNext()
    save()
    setPaused(false)
    setMessage(
      g.done
        ? { text: 'Frisch gestapelt – der Schlitten bleibt voll, jetzt nur noch zum Spaß.' }
        : { text: `Frisch gestapelt! Die ${g.rows} verladenen Reihen bleiben auf dem Schlitten.` },
    )
    canvas.current?.focus()
  }

  return (
    <div className="tetris">
      <div className="tetris__top">
        <div className="tetris__sleigh" aria-label={`${rows} von ${GOAL} Reihen auf den Schlitten geladen`}>
          <span className="tetris__sleigh-icon" aria-hidden="true">🛷</span>
          <div className="tetris__bar" aria-hidden="true">
            <div key={bump} className="tetris__fill" style={{ width: `${(rows / GOAL) * 100}%` }} data-full={rows >= GOAL} />
            {Array.from({ length: GOAL - 1 }, (_, i) => (
              <span key={i} className="tetris__tick" style={{ left: `${((i + 1) / GOAL) * 100}%` }} />
            ))}
          </div>
          <span className="tetris__count">
            <b key={bump}>{rows}</b>/{GOAL}
          </span>
        </div>
        <div className="tetris__next">
          <span>Als Nächstes</span>
          <Preview kind={next} />
        </div>
      </div>

      <div className="tetris__view">
        <canvas
          ref={canvas}
          className="tetris__canvas"
          tabIndex={0}
          role="application"
          aria-label="Geschenke-Tetris. Pfeiltasten schieben, Pfeil hoch dreht, Leertaste lässt fallen. Auf dem Handy: wischen zum Schieben, tippen zum Drehen."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (gesture.current = null)}
        />
        {done && paused && (
          <div className="tetris__done" aria-hidden="true">
            <strong>Schlitten beladen!</strong>
          </div>
        )}
      </div>

      <p className="tetris__status" data-tone={message.tone} role="status">
        {message.text}
      </p>

      {!paused && (
        <div className="tetris__pad">
          <button type="button" className="tetris__key" aria-label="Nach links" onClick={() => act('left')}>◀</button>
          <button type="button" className="tetris__key" aria-label="Drehen" onClick={() => act('cw')}>↻</button>
          <button type="button" className="tetris__key" aria-label="Nach rechts" onClick={() => act('right')}>▶</button>
          <button type="button" className="tetris__key" aria-label="Ein Stück runter" onClick={() => act('down')}>▼</button>
          <button type="button" className="tetris__key tetris__key--drop" aria-label="Fallen lassen" onClick={() => act('drop')}>⤓</button>
        </div>
      )}

      <div className="tetris__actions">
        {done && (
          <button type="button" className="button" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
          </button>
        )}
        <button type="button" className="button button--quiet" onClick={restack}>
          ↺ Neu stapeln
        </button>
      </div>
    </div>
  )
}
