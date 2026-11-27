import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { WimmelBackdrop, WimmelDefs, WimmelItem, WimmelSnow } from './WimmelArt.tsx'
import { buildScene, FOUND_GOAL, HEIGHT, HIDEOUTS, isComplete, markFound, nextHidden, startGame, tapAt, WIDTH } from './model.ts'
import type { WimmelState } from './model.ts'
import './wimmel.css'

/** Höchste Vergrößerung in Bildschirmpixeln je Bildeinheit. */
const MAX_ZOOM = 2.4
/** So weit darf sich ein Finger bewegen, und es zählt noch als Tipp. */
const TAP_SLOP = 8
/** Trefferkreise wachsen um so viele Bildschirmpixel – Finger sind dick. */
const TAP_TOLERANCE = 12
/** Ohne Fund so lange suchen, dann gibt es einen Tipp. */
const HINT_AFTER_MS = 40_000

interface View {
  /** Bildmitte in Bildeinheiten. */
  cx: number
  cy: number
  /** Bildschirmpixel je Bildeinheit. */
  zoom: number
}

type Toast = { text: string; tone: 'found' | 'rudolph' | 'again'; key: number }
type Puff = { x: number; y: number; key: number }

const minZoom = (w: number, h: number) => Math.max(w / WIDTH, h / HEIGHT)

function clampView(view: View, w: number, h: number): View {
  const zoom = Math.min(Math.max(view.zoom, minZoom(w, h)), MAX_ZOOM)
  const halfW = w / zoom / 2
  const halfH = h / zoom / 2
  return {
    zoom,
    cx: Math.min(Math.max(view.cx, halfW), WIDTH - halfW),
    cy: Math.min(Math.max(view.cy, halfH), HEIGHT - halfH),
  }
}

function statusText(state: WimmelState): string {
  const left = FOUND_GOAL - state.found.length
  if (left === 0) return 'Alle fünf gefunden! Rudolph ist überglücklich.'
  if (state.found.length === 0) return 'Rudolph braucht Hilfe für den Schlitten! Fünf Rentiere haben sich im Bild versteckt.'
  return left === 1 ? 'Noch ein Rentier fehlt!' : `Noch ${left} Rentiere fehlen.`
}

export default function WimmelGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [state, setState] = useState(() => startGame(savedState, completedBefore))
  const save = useEffectEvent(saveState)
  useEffect(() => { save(state) }, [state])

  const items = useMemo(() => buildScene(), [])
  // Das Bild selbst ändert sich nie – React soll es beim Schieben und Zoomen nicht neu vergleichen.
  const picture = useMemo(
    () => (
      <>
        <WimmelBackdrop />
        <g>{items.map((item, i) => <WimmelItem key={i} item={item} />)}</g>
        <WimmelSnow />
      </>
    ),
    [items],
  )

  const frame = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const size = useRef({ w: 1, h: 1 })
  const view = useRef<View>({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 0 })
  const [zoomLevel, setZoomLevel] = useState(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; pinch: number | null }>({ moved: false, startX: 0, startY: 0, pinch: null })
  const tween = useRef<number | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)
  const [puff, setPuff] = useState<Puff | null>(null)
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null)
  const [hintReady, setHintReady] = useState(false)
  const done = isComplete(state)

  const apply = (next: View) => {
    const { w, h } = size.current
    view.current = clampView(next, w, h)
    const { cx, cy, zoom } = view.current
    svg.current?.setAttribute('viewBox', `${cx - w / zoom / 2} ${cy - h / zoom / 2} ${w / zoom} ${h / zoom}`)
    const level = Math.round(((zoom - minZoom(w, h)) / (MAX_ZOOM - minZoom(w, h))) * 100)
    setZoomLevel((previous) => (previous === level ? previous : level))
  }

  useEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const first = view.current.zoom === 0
      size.current = { w: element.clientWidth || 1, h: element.clientHeight || 1 }
      apply(first ? { cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 0 } : view.current)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Mausrad zoomt um den Mauszeiger – dafür muss das Scrollen der Seite unterbunden werden.
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      stopTween()
      zoomAround(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0016))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  // Tipp-Knopf erst nach einer Weile ohne Fund.
  useEffect(() => {
    setHintReady(false)
    if (done) return
    const timeout = window.setTimeout(() => setHintReady(true), HINT_AFTER_MS)
    return () => window.clearTimeout(timeout)
  }, [state.found.length, done])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (!puff) return
    const timeout = window.setTimeout(() => setPuff(null), 650)
    return () => window.clearTimeout(timeout)
  }, [puff])
  useEffect(() => {
    if (!hint) return
    const timeout = window.setTimeout(() => setHint(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [hint])
  useEffect(() => () => stopTween(), [])

  function stopTween() {
    if (tween.current !== null) cancelAnimationFrame(tween.current)
    tween.current = null
  }

  /** Bildschirmpunkt → Bildpunkt. */
  function toImage(clientX: number, clientY: number) {
    const rect = frame.current!.getBoundingClientRect()
    const { w, h } = size.current
    const { cx, cy, zoom } = view.current
    return { x: cx + (clientX - rect.left - w / 2) / zoom, y: cy + (clientY - rect.top - h / 2) / zoom }
  }

  function zoomAround(clientX: number, clientY: number, factor: number) {
    const before = toImage(clientX, clientY)
    const { w, h } = size.current
    const zoom = Math.min(Math.max(view.current.zoom * factor, minZoom(w, h)), MAX_ZOOM)
    const rect = frame.current!.getBoundingClientRect()
    // Der Punkt unter dem Zeiger bleibt, wo er ist.
    apply({ zoom, cx: before.x - (clientX - rect.left - w / 2) / zoom, cy: before.y - (clientY - rect.top - h / 2) / zoom })
  }

  function flyTo(target: View, seconds = 0.8) {
    stopTween()
    const from = { ...view.current }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / 1000 / seconds, 1)
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      const zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * k)
      apply({ zoom, cx: from.cx + (target.cx - from.cx) * k, cy: from.cy + (target.cy - from.cy) * k })
      tween.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tween.current = requestAnimationFrame(step)
  }

  function zoomButton(factor: number) {
    const { w, h } = size.current
    flyTo(clampView({ ...view.current, zoom: view.current.zoom * factor }, w, h), 0.3)
  }

  function tap(clientX: number, clientY: number) {
    if (done) return
    const point = toImage(clientX, clientY)
    const result = tapAt(state, point.x, point.y, TAP_TOLERANCE / view.current.zoom)
    if (result.hit === 'reindeer') {
      const next = markFound(state, result.id)
      setState(next)
      setHint(null)
      const left = FOUND_GOAL - next.found.length
      setToast({
        text: left === 0 ? 'Das letzte Rentier! Der Schlitten ist bereit.' : `Gefunden! ${left === 1 ? 'Nur noch eins.' : `Noch ${left}.`}`,
        tone: 'found',
        key: Date.now(),
      })
      if (left === 0) {
        const { w, h } = size.current
        flyTo({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: minZoom(w, h) }, 1.2)
      }
    } else if (result.hit === 'again') {
      setToast({ text: 'Das hast du schon gefunden.', tone: 'again', key: Date.now() })
    } else if (result.hit === 'rudolph') {
      setToast({ text: 'Das ist Rudolph selbst – er wartet am Schlitten auf seine Freunde.', tone: 'rudolph', key: Date.now() })
    } else {
      setPuff({ x: point.x, y: point.y, key: Date.now() })
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    stopTween()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) gesture.current = { moved: false, startX: event.clientX, startY: event.clientY, pinch: null }
    else gesture.current.moved = true
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const current = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, current)
    const g = gesture.current
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (g.pinch !== null && distance > 0) zoomAround((a.x + b.x) / 2, (a.y + b.y) / 2, distance / g.pinch)
      // Mit beiden Fingern gleichzeitig schieben: um die halbe Bewegung des einen verschieben.
      const { zoom } = view.current
      apply({ ...view.current, cx: view.current.cx - (current.x - previous.x) / 2 / zoom, cy: view.current.cy - (current.y - previous.y) / 2 / zoom })
      g.pinch = distance
      return
    }
    if (!g.moved && Math.hypot(current.x - g.startX, current.y - g.startY) > TAP_SLOP) g.moved = true
    if (g.moved) {
      const { zoom } = view.current
      apply({ ...view.current, cx: view.current.cx - (current.x - previous.x) / zoom, cy: view.current.cy - (current.y - previous.y) / zoom })
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current.pinch = null
    if (pointers.current.size === 0 && !gesture.current.moved && event.type === 'pointerup') tap(event.clientX, event.clientY)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { zoom } = view.current
    const step = 120 / zoom
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      apply({ ...view.current, cx: view.current.cx + moves[event.key][0], cy: view.current.cy + moves[event.key][1] })
    } else if (event.key === '+' || event.key === '=') zoomButton(1.4)
    else if (event.key === '-') zoomButton(1 / 1.4)
  }

  function showHint() {
    const hidden = nextHidden(state)
    if (!hidden) return
    // Nicht genau drauf zeigen – nur die Gegend.
    const spot = { x: hidden.cx + 70, y: hidden.cy - 50 }
    setHint(spot)
    setHintReady(false)
    const { w, h } = size.current
    flyTo(clampView({ cx: spot.x, cy: spot.y, zoom: Math.max(minZoom(w, h) * 1.8, Math.min(w, h) / 900) }, w, h), 1)
  }

  function resetView() {
    const { w, h } = size.current
    flyTo({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: minZoom(w, h) }, 0.6)
  }

  return (
    <div className="wimmel" data-done={done}>
      <div className="wimmel__top">
        <p className="wimmel__status" role="status">{statusText(state)}</p>
        <ol className="wimmel__slots" aria-label={`${state.found.length} von ${FOUND_GOAL} Rentieren gefunden`}>
          {HIDEOUTS.map((h, i) => (
            <li key={h.id} data-found={i < state.found.length} aria-hidden="true">🦌</li>
          ))}
        </ol>
      </div>

      <div
        ref={frame}
        className="wimmel__frame"
        tabIndex={0}
        role="application"
        aria-label="Wimmelbild: mit dem Finger verschieben, mit zwei Fingern oder dem Mausrad zoomen, Rentiere antippen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <svg ref={svg} className="wimmel__svg" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <WimmelDefs />
          {picture}
          {HIDEOUTS.filter((h) => state.found.includes(h.id)).map((h) => (
            <g key={h.id} className="wimmel__found">
              <circle cx={h.cx} cy={h.cy} r={h.radius + 14} />
              <circle cx={h.cx} cy={h.cy} r={h.radius + 14} className="wimmel__found-pulse" />
            </g>
          ))}
          {hint && <circle key={`${hint.x}`} className="wimmel__hint" cx={hint.x} cy={hint.y} r="240" />}
          {puff && (
            <g key={puff.key} className="wimmel__puff" transform={`translate(${puff.x} ${puff.y}) scale(${1 / Math.max(view.current.zoom, 0.01)})`}>
              <circle r="14" />
            </g>
          )}
        </svg>

        <div className="wimmel__zoom" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Hineinzoomen" onClick={() => zoomButton(1.5)} disabled={zoomLevel >= 100}>+</button>
          <button type="button" aria-label="Herauszoomen" onClick={() => zoomButton(1 / 1.5)} disabled={zoomLevel <= 0}>−</button>
          <button type="button" aria-label="Ganzes Bild zeigen" onClick={resetView} disabled={zoomLevel <= 0}>⤢</button>
        </div>
        {toast && (
          <p key={toast.key} className="wimmel__toast" data-tone={toast.tone}>{toast.text}</p>
        )}
        {zoomLevel <= 0 && state.found.length === 0 && !toast && (
          <p className="wimmel__coach" aria-hidden="true">Zoom hinein und such genau hin!</p>
        )}
      </div>

      {done ? (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      ) : (
        <div className="wimmel__meta">
          {hintReady ? (
            <button type="button" className="wimmel__hint-button" onClick={showHint}>
              <span aria-hidden="true">💡</span> Tipp
            </button>
          ) : (
            <span className="wimmel__meta-note">Achte aufs Geweih – Pferde, Hunde und Bären haben keins.</span>
          )}
        </div>
      )}
    </div>
  )
}
