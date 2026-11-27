import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { createMeter, openMicrophone, rms, updateMeter } from './mic.ts'
import type { Microphone } from './mic.ts'
import { blow, blownAway, CLEAR_AT, clearedFraction, COLS, isClear, MIN_STRENGTH, ROWS, snapshot, startSnow, sweep } from './model.ts'
import './snowwindow.css'

type Phase = 'intro' | 'asking' | 'playing' | 'caught' | 'gone'
type MicStatus = 'off' | 'live' | 'denied'

/** Pustestärke des Ersatz-Knopfs für alle ohne Mikrofon. */
const HOLD_STRENGTH = 0.7
/** So lange schaut der Wichtel ertappt, bevor er abtaucht. */
const CAUGHT_MS = 1500
const SAVE_EVERY_MS = 1500

/** Lage der Scheibe im Fenster-Bild (SVG-Einheiten) – die Schnee-Leinwand liegt genau darüber. */
const VIEW = { width: 300, height: 344 }
const GLASS = { x: 26, y: 26, width: 248, height: 288 }

interface Flake {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  r: number
}

/** Leichte Schattierung und Glitzer, die über den Schnee gelegt werden. */
function makeTexture(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.6, '#f3f7fc')
  gradient.addColorStop(1, '#dde8f4')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  const dots = Math.round((width * height) / 260)
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = i % 3 ? 'rgba(150, 175, 205, 0.13)' : 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(Math.random() * width, Math.random() * height, 0.6 + Math.random() * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  return canvas
}

interface Painter {
  grid: HTMLCanvasElement
  soft: HTMLCanvasElement
  texture: HTMLCanvasElement | null
}

function createPainter(): Painter {
  const grid = document.createElement('canvas')
  grid.width = COLS
  grid.height = ROWS
  const soft = document.createElement('canvas')
  soft.width = COLS * 4
  soft.height = ROWS * 4
  return { grid, soft, texture: null }
}

function paint(canvas: HTMLCanvasElement, painter: Painter, snow: readonly number[], flakes: readonly Flake[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.width) return
  const { width, height } = canvas
  if (!painter.texture || painter.texture.width !== width || painter.texture.height !== height) {
    painter.texture = makeTexture(width, height)
  }

  // Raster → Alphamaske. Zweimal weich hochskaliert, damit die Ränder flauschig statt eckig sind.
  const gctx = painter.grid.getContext('2d')!
  const image = gctx.createImageData(COLS, ROWS)
  for (let i = 0; i < snow.length; i++) {
    image.data[i * 4] = 255
    image.data[i * 4 + 1] = 255
    image.data[i * 4 + 2] = 255
    image.data[i * 4 + 3] = Math.min(255, Math.max(0, (snow[i] - 3) / 12) * 255)
  }
  gctx.putImageData(image, 0, 0)
  const sctx = painter.soft.getContext('2d')!
  sctx.clearRect(0, 0, painter.soft.width, painter.soft.height)
  sctx.imageSmoothingEnabled = true
  sctx.drawImage(painter.grid, 0, 0, painter.soft.width, painter.soft.height)

  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Weichzeichnen, wo der Browser es kann – sonst bleibt es beim weichen Hochskalieren.
  ctx.filter = `blur(${((width / COLS) * 0.45).toFixed(1)}px)`
  ctx.drawImage(painter.soft, 0, 0, width, height)
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-atop'
  ctx.drawImage(painter.texture, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  ctx.fillStyle = '#ffffff'
  for (const flake of flakes) {
    ctx.globalAlpha = Math.max(0, Math.min(1, flake.life * 2))
    ctx.beginPath()
    ctx.arc(flake.x * width, flake.y * height, flake.r * width, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Wo gepustet wird, stiebt der Schnee nach außen davon. */
function stepFlakes(flakes: Flake[], snow: readonly number[], strength: number, dt: number) {
  const spawn = strength >= MIN_STRENGTH ? strength * dt * 140 : 0
  for (let n = 0; n < spawn + Math.random() - 0.5 && flakes.length < 220; n++) {
    const i = Math.floor(Math.random() * snow.length)
    if (snow[i] <= 0) continue
    const x = ((i % COLS) + Math.random()) / COLS
    const y = (Math.floor(i / COLS) + Math.random()) / ROWS
    const push = 0.25 + strength * 0.9
    flakes.push({
      x,
      y,
      vx: (x - 0.5) * push * 2 + (Math.random() - 0.5) * 0.3,
      vy: (y - 0.42) * push * 2 - Math.random() * 0.25,
      life: 0.5 + Math.random() * 0.6,
      r: 0.004 + Math.random() * 0.008,
    })
  }
  for (let i = flakes.length - 1; i >= 0; i--) {
    const flake = flakes[i]
    flake.x += flake.vx * dt
    flake.y += flake.vy * dt
    flake.vy += 0.15 * dt
    flake.life -= dt
    if (flake.life <= 0) flakes.splice(i, 1)
  }
}

function Elf({ phase }: { phase: Phase }) {
  const caught = phase === 'caught' || phase === 'gone'
  return (
    <g className="snowwin-elf">
      {/* Ohren */}
      <path d="M114 262c-14-6-28-20-34-34 14 2 28 10 38 22Z" fill="#efb88f" />
      <path d="M186 262c14-6 28-20 34-34-14 2-28 10-38 22Z" fill="#efb88f" />
      <path d="M112 256c-8-4-16-12-22-20 8 2 16 8 24 14Z" fill="#e39a78" />
      <path d="M188 256c8-4 16-12 22-20-8 2-16 8-24 14Z" fill="#e39a78" />
      {/* Gesicht */}
      <ellipse cx="150" cy="276" rx="40" ry="38" fill="#f6c9a3" />
      <circle cx="124" cy="290" r="8" fill="#ec8f80" opacity="0.5" />
      <circle cx="176" cy="290" r="8" fill="#ec8f80" opacity="0.5" />
      {/* Mütze */}
      <path d="M108 254c2-40 30-70 62-78 14-4 30 2 36-6-2 18-14 22-20 34-6 14 2 34 6 50Z" fill="#3f8a4f" />
      <path d="M128 250c4-30 22-52 42-62" fill="none" stroke="#2f6d3d" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <circle cx="207" cy="168" r="9" fill="#e8b04a" />
      <circle cx="204" cy="165" r="3" fill="#fff3c4" />
      <rect x="104" y="244" width="94" height="17" rx="8.5" fill="#fff8ee" />
      <g fill="#ffffff">
        <circle cx="112" cy="252" r="6" /><circle cx="128" cy="249" r="6" /><circle cx="146" cy="251" r="6" />
        <circle cx="164" cy="249" r="6" /><circle cx="182" cy="251" r="6" /><circle cx="194" cy="252" r="5" />
      </g>
      {/* Augen */}
      {caught ? (
        <g>
          <ellipse cx="134" cy="278" rx="11" ry="13" fill="#fff" />
          <ellipse cx="166" cy="278" rx="11" ry="13" fill="#fff" />
          <circle cx="134" cy="279" r="4.5" fill="#3a2418" />
          <circle cx="166" cy="279" r="4.5" fill="#3a2418" />
          <path d="M120 258q12-8 24-2M156 256q12-6 24 2" fill="none" stroke="#7a4b2e" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      ) : (
        <g className="snowwin-elf__eyes">
          <ellipse cx="134" cy="279" rx="9" ry="10" fill="#fff" />
          <ellipse cx="166" cy="279" rx="9" ry="10" fill="#fff" />
          <circle cx="138" cy="281" r="5.5" fill="#3a2418" />
          <circle cx="170" cy="281" r="5.5" fill="#3a2418" />
          <circle cx="140" cy="279" r="1.8" fill="#fff" />
          <circle cx="172" cy="279" r="1.8" fill="#fff" />
          <path d="M123 266q11 4 22 0M155 266q11 4 22 0" fill="none" stroke="#7a4b2e" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}
      <ellipse cx="150" cy="294" rx="6" ry="5" fill="#e88f73" />
      {caught ? (
        <ellipse cx="150" cy="306" rx="5" ry="5" fill="#7a3a2e" />
      ) : (
        <path d="M138 304q12 8 26-2" fill="none" stroke="#7a3a2e" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* Finger am unteren Fensterrand */}
      <g fill="#f6c9a3" stroke="#e1a985" strokeWidth="1.5">
        <rect x="88" y="298" width="8" height="18" rx="4" /><rect x="97" y="296" width="8" height="20" rx="4" />
        <rect x="106" y="298" width="8" height="18" rx="4" />
        <rect x="186" y="298" width="8" height="18" rx="4" /><rect x="195" y="296" width="8" height="20" rx="4" />
        <rect x="204" y="298" width="8" height="18" rx="4" />
      </g>
      {phase === 'caught' && (
        <g className="snowwin-elf__alarm">
          <rect x="220" y="196" width="14" height="40" rx="7" fill="#e8b04a" stroke="#9a6a1c" strokeWidth="2.5" />
          <circle cx="227" cy="250" r="7.5" fill="#e8b04a" stroke="#9a6a1c" strokeWidth="2.5" />
        </g>
      )}
    </g>
  )
}

function Outside() {
  return (
    <g aria-hidden="true">
      <rect x={GLASS.x} y={GLASS.y} width={GLASS.width} height={GLASS.height} fill="url(#snowwin-sky)" />
      <circle cx="222" cy="66" r="18" fill="#fff4cf" />
      <circle cx="230" cy="60" r="16" fill="url(#snowwin-sky)" />
      <g fill="#fff8e1">
        <circle cx="60" cy="52" r="1.8" /><circle cx="108" cy="80" r="1.4" /><circle cx="160" cy="46" r="2" />
        <circle cx="86" cy="140" r="1.4" /><circle cx="250" cy="130" r="1.6" /><circle cx="186" cy="100" r="1.3" />
        <circle cx="46" cy="176" r="1.6" /><circle cx="262" cy="190" r="1.4" />
      </g>
      <path d="M40 232l16-34 16 34Zm-6 22l22-38 22 38Z" fill="#2a4d48" />
      <path d="M232 226l14-30 14 30Zm-6 20l20-34 20 34Z" fill="#2a4d48" />
      <path d="M26 246q60-22 124-12t124-8v88H26Z" fill="#e9f0f8" />
      <path d="M26 270q70-14 140-4t108-6v54H26Z" fill="#d6e2ef" />
    </g>
  )
}

function Frame() {
  const o = { x: 8, y: 8, w: 284, h: 314 }
  return (
    <svg className="snowwin__frame" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} aria-hidden="true">
      <path
        fillRule="evenodd"
        fill="#8a5a36"
        d={`M${o.x + 10} ${o.y}h${o.w - 20}a10 10 0 0 1 10 10v${o.h - 20}a10 10 0 0 1-10 10h-${o.w - 20}a10 10 0 0 1-10-10v-${o.h - 20}a10 10 0 0 1 10-10Z
            M${GLASS.x} ${GLASS.y}v${GLASS.height}h${GLASS.width}v-${GLASS.height}Z`}
      />
      <rect x={GLASS.x - 3} y={GLASS.y - 3} width={GLASS.width + 6} height={GLASS.height + 6} fill="none" stroke="#6b4129" strokeWidth="6" />
      <rect x={GLASS.x} y="112" width={GLASS.width} height="9" fill="#8a5a36" />
      <rect x={GLASS.x} y="119" width={GLASS.width} height="2" fill="#6b4129" />
      {/* Spiegelungen auf der Scheibe */}
      <g fill="#ffffff" opacity="0.16">
        <path d="M44 300l70-170h18L62 300Z" />
        <path d="M76 300l70-170h7L83 300Z" />
      </g>
      {/* Fensterbank mit Schnee */}
      <rect x="0" y="312" width="300" height="28" rx="7" fill="#9b6a42" />
      <rect x="0" y="330" width="300" height="10" rx="5" fill="#7a4d2d" />
      <path d="M2 316q12-12 34-8t46 0 48-2 52 2 48-2 40 4 28 6q-6 4-298 4Z" fill="#fff" />
      <path d="M10 10q20-10 60-6t80-2 80 2 60 6v8H10Z" fill="#fff" />
    </svg>
  )
}

export default function SnowWindowGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [initial] = useState(() => startSnow(savedState, completedBefore))
  const snow = useRef(initial)
  const [phase, setPhase] = useState<Phase>(() => (isClear(initial) ? 'gone' : 'intro'))
  const [mic, setMic] = useState<MicStatus>('off')
  const [progress, setProgress] = useState(() => blownAway(initial))
  const [power, setPower] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const painter = useRef<Painter>(null)
  const flakes = useRef<Flake[]>([])
  const microphone = useRef<Microphone | null>(null)
  const holding = useRef(false)
  const save = useEffectEvent(saveState)

  const redraw = () => {
    if (!canvas.current) return
    painter.current ??= createPainter()
    paint(canvas.current, painter.current, snow.current, flakes.current)
  }

  // Leinwand an die angezeigte Größe anpassen (scharf auf Retina, aber nicht übertrieben).
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      element.width = Math.round(element.clientWidth * ratio)
      element.height = Math.round(element.clientHeight * ratio)
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Mikrofon beim Verlassen des Hauses immer wieder freigeben.
  useEffect(() => {
    const open = microphone
    return () => {
      open.current?.close()
      open.current = null
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const meter = createMeter()
    const samples = new Float32Array(2048)
    let last = performance.now()
    let lastUi = 0
    let lastSave = last
    let sweeping = clearedFraction(snow.current) >= CLEAR_AT
    let frame = 0

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let strength = 0
      const live = microphone.current
      if (live) {
        live.analyser.getFloatTimeDomainData(samples)
        strength = updateMeter(meter, rms(samples), dt)
      }
      if (holding.current) strength = Math.max(strength, HOLD_STRENGTH)

      const cells = snow.current
      if (sweeping) sweep(cells, dt)
      else {
        blow(cells, strength, dt)
        sweeping = clearedFraction(cells) >= CLEAR_AT
      }
      stepFlakes(flakes.current, cells, sweeping ? 1 : strength, dt)
      redraw()

      if (now - lastUi > 90) {
        setProgress(blownAway(cells))
        setPower(strength)
        lastUi = now
      }
      if (now - lastSave > SAVE_EVERY_MS) {
        save(snapshot(cells))
        lastSave = now
      }
      if (sweeping && isClear(cells)) {
        setProgress(1)
        setPower(0)
        setPhase('caught')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Dasselbe Array, das `tick` bearbeitet – der Ref wird nie neu belegt.
    const cells = snow.current
    return () => {
      cancelAnimationFrame(frame)
      save(snapshot(cells))
    }
  }, [phase])

  // Ertappt! Kurz starren, dann blitzschnell abtauchen. Das Mikrofon wird nicht mehr gebraucht.
  useEffect(() => {
    if (phase !== 'caught') return
    microphone.current?.close()
    microphone.current = null
    flakes.current = []
    redraw()
    const timeout = window.setTimeout(() => setPhase('gone'), CAUGHT_MS)
    return () => window.clearTimeout(timeout)
  }, [phase])

  const startWithMic = async () => {
    setPhase('asking')
    try {
      microphone.current = await openMicrophone()
      setMic('live')
    } catch {
      setMic('denied')
    }
    setPhase('playing')
  }

  const startWithoutMic = () => {
    setMic('denied')
    setPhase('playing')
  }

  const hold = (on: boolean) => {
    holding.current = on
  }
  const onHoldKey = (event: KeyboardEvent, on: boolean) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) hold(on)
  }

  const percent = Math.round(progress * 100)
  const status =
    phase === 'intro' ? 'Das Fenster ist komplett eingeschneit. Ob da draußen jemand ist?'
      : phase === 'asking' ? 'Bitte erlaube den Zugriff auf dein Mikrofon …'
        : phase === 'caught' ? 'Ein Wichtel! Ertappt!'
          : phase === 'gone' ? 'Husch – weg ist er!'
            : mic === 'live' ? (power > 0.1 ? 'Weiter so – puste!' : 'Puste kräftig ins Mikrofon!')
              : 'Halte den Knopf gedrückt und puste mit!'

  return (
    <div className="snowwin" data-phase={phase}>
      <div className="snowwin__window">
        <svg className="snowwin__outside" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={phase === 'gone' || phase === 'caught' ? 'Freies Fenster in einer Winternacht' : `Eingeschneites Fenster, ${percent} Prozent frei`}>
          <defs>
            <linearGradient id="snowwin-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d2350" />
              <stop offset="1" stopColor="#4a4f8f" />
            </linearGradient>
            <clipPath id="snowwin-glass">
              <rect x={GLASS.x} y={GLASS.y} width={GLASS.width} height={GLASS.height} />
            </clipPath>
          </defs>
          <Outside />
          <g clipPath="url(#snowwin-glass)">
            <Elf phase={phase} />
          </g>
        </svg>
        <canvas
          ref={canvas}
          className="snowwin__snow"
          aria-hidden="true"
          style={{
            left: `${(GLASS.x / VIEW.width) * 100}%`,
            top: `${(GLASS.y / VIEW.height) * 100}%`,
            width: `${(GLASS.width / VIEW.width) * 100}%`,
            height: `${(GLASS.height / VIEW.height) * 100}%`,
          }}
        />
        <Frame />
      </div>

      <p className="snowwin__status" role="status">{status}</p>

      {phase === 'intro' && (
        <div className="snowwin__actions">
          <button type="button" className="button" onClick={startWithMic}>
            <span aria-hidden="true">🎤</span> Mikrofon erlauben & pusten
          </button>
          <button type="button" className="button button--quiet" onClick={startWithoutMic}>
            Ohne Mikrofon spielen
          </button>
          <p className="snowwin__note">Der Ton wird nur hier auf deinem Gerät gemessen – nichts wird aufgenommen oder gesendet.</p>
        </div>
      )}

      {phase === 'playing' && (
        <div className="snowwin__meta">
          {mic === 'live' && (
            <div className="snowwin__meter" aria-hidden="true">
              <span style={{ width: `${Math.round(power * 100)}%` }} />
            </div>
          )}
          <div className="snowwin__progress" aria-label={`${percent} Prozent frei`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          {mic === 'denied' && (
            <button
              type="button"
              className="button snowwin__hold"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); hold(true) }}
              onPointerUp={() => hold(false)}
              onPointerCancel={() => hold(false)}
              onLostPointerCapture={() => hold(false)}
              onKeyDown={(event) => onHoldKey(event, true)}
              onKeyUp={(event) => onHoldKey(event, false)}
              onBlur={() => hold(false)}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span aria-hidden="true">💨</span> Gedrückt halten zum Pusten
            </button>
          )}
        </div>
      )}

      {phase === 'gone' && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
