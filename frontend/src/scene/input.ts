export interface GestureHandlers {
  /** Ein Finger (oder die Maus) berührt die Straße. */
  onGrab(): void
  /** Waagerechtes Ziehen in Bildpunkten. */
  onPan(dx: number): void
  /** Losgelassen – mit der Geschwindigkeit des Wischens in Bildpunkten pro Sekunde. */
  onPanEnd(velocity: number): void
  /** Mit zwei Fingern (oder rechter Maustaste bzw. Umschalttaste) ziehen: Blick drehen. */
  onTurn(dx: number): void
  onTurnEnd(): void
  onTap(clientX: number, clientY: number): void
  onHover(clientX: number, clientY: number): void
}

const TAP_DISTANCE = 9
const TAP_DURATION = 600
const VELOCITY_WINDOW = 110

interface Sample {
  time: number
  x: number
}

/** Übersetzt Zeiger-, Rad- und Touch-Ereignisse in Gesten. Liefert eine Funktion zum Abmelden. */
export function attachGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
  const pointers = new Map<number, { x: number; y: number }>()
  let mode: 'idle' | 'pan' | 'turn' = 'idle'
  let start = { x: 0, y: 0, time: 0 }
  let moved = false
  let lastTurnX = 0
  let samples: Sample[] = []

  const middleX = () => {
    let sum = 0
    for (const pointer of pointers.values()) sum += pointer.x
    return sum / pointers.size
  }

  const onPointerDown = (event: PointerEvent) => {
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // Zeiger ist schon wieder weg – dann eben ohne Einfangen.
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 1) {
      const turning = event.pointerType === 'mouse' && (event.button === 2 || event.shiftKey)
      mode = turning ? 'turn' : 'pan'
      start = { x: event.clientX, y: event.clientY, time: event.timeStamp }
      moved = turning
      lastTurnX = event.clientX
      samples = [{ time: event.timeStamp, x: event.clientX }]
      handlers.onGrab()
    } else if (pointers.size === 2) {
      if (mode === 'pan' && moved) handlers.onPanEnd(0)
      mode = 'turn'
      moved = true
      lastTurnX = middleX()
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) {
      if (event.pointerType === 'mouse') handlers.onHover(event.clientX, event.clientY)
      return
    }
    const dx = event.clientX - pointer.x
    pointer.x = event.clientX
    pointer.y = event.clientY

    if (mode === 'pan') {
      if (!moved) {
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_DISTANCE) return
        moved = true
      }
      handlers.onPan(dx)
      samples.push({ time: event.timeStamp, x: event.clientX })
      while (samples.length > 2 && event.timeStamp - samples[0].time > VELOCITY_WINDOW) samples.shift()
    } else if (mode === 'turn') {
      const x = middleX()
      handlers.onTurn(x - lastTurnX)
      lastTurnX = x
    }
  }

  const release = (event: PointerEvent, cancelled: boolean) => {
    if (!pointers.delete(event.pointerId)) return
    if (mode === 'pan' && pointers.size === 0) {
      if (!moved) {
        if (!cancelled && event.timeStamp - start.time < TAP_DURATION) {
          handlers.onTap(event.clientX, event.clientY)
        }
      } else {
        const first = samples[0]
        const last = samples[samples.length - 1]
        const elapsed = last.time - first.time
        const fresh = event.timeStamp - last.time < VELOCITY_WINDOW
        handlers.onPanEnd(fresh && elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0)
      }
      mode = 'idle'
    } else if (mode === 'turn') {
      // Der verbleibende Finger zieht nicht weiter – sonst spränge die Straße.
      handlers.onTurnEnd()
      mode = 'idle'
    }
  }

  const onPointerUp = (event: PointerEvent) => release(event, false)
  const onPointerCancel = (event: PointerEvent) => release(event, true)

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    handlers.onGrab()
    handlers.onPan(-delta)
    handlers.onPanEnd(0)
  }

  const onContextMenu = (event: Event) => event.preventDefault()

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerCancel)
  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('contextmenu', onContextMenu)

  return () => {
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', onPointerUp)
    element.removeEventListener('pointercancel', onPointerCancel)
    element.removeEventListener('wheel', onWheel)
    element.removeEventListener('contextmenu', onContextMenu)
  }
}
