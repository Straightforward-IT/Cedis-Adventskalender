import { fetchSnow, fetchStatus, unlockHouse } from '../api/client.ts'
import type { UnlockResult } from '../api/types.ts'
import {
  DEFAULT_CALENDAR_YEAR,
  TOTAL_DAYS,
  berlinToday,
  formatDay,
  unlockedDaysOn,
} from '../lib/calendar.ts'
import { GATE_DAY, isGate, placeName, placeTitle } from '../lib/places.ts'
import { isDevPreview } from '../lib/devPreview.ts'
import { loadProgress, loadSelfies, saveProgress, storeSelfie } from '../lib/storage.ts'
import type { Progress } from '../lib/storage.ts'
import { extractToken, normalizeKey, parseToken } from '../lib/token.ts'
import type { DoorToken } from '../lib/token.ts'
import { minigameFor } from '../minigames/registry.ts'
import type { StreetScene } from '../scene/StreetScene.ts'
import { useStore } from './store.ts'

/*
 * Die Abläufe der App: laden, Haus auswählen, Schlüssel prüfen, Selfie,
 * eintreten und wieder gehen. Die Oberfläche ruft nur diese Funktionen auf.
 */

const { getState, setState } = useStore

/** Dauer der Lichtblende zurück auf die Straße (passt zur Überblendung `.light` in interior.css). */
const LEAVE_FADE_MS = 450
const ENTER_TIMEOUT_MS = 5000
const SNOW_REFRESH_MS = 30 * 60_000

let scene: StreetScene | null = null

/** Die 3D-Szene meldet sich hier an, sobald sie steht (und mit null wieder ab). */
export function attachScene(next: StreetScene | null): void {
  scene = next
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function updateProgress(change: (progress: Progress) => Progress): void {
  const progress = change(getState().progress)
  setState({ progress })
  if (!isDevPreview()) saveProgress(progress)
}

// --------------------------------------------------------------- Start

/** Der Schlüssel aus dem QR-Code-Link soll nicht in Adresszeile und Verlauf stehen bleiben. */
function takeTokenFromAddress(): DoorToken | null {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get('k')
  if (raw === null) return null
  url.searchParams.delete('k')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  return parseToken(raw)
}

let statusTimer: ReturnType<typeof setTimeout> | undefined
let statusRequest: Promise<void> | null = null
/** Hat der Besucher die Straße schon selbst bewegt? Dann fährt die Kamera nicht mehr von allein. */
let interacted = false

async function loadStatus(): Promise<void> {
  // Ein schlafender Server braucht manchmal mehrere Anläufe.
  for (const pause of [0, 2500, 6000]) {
    if (pause > 0) await wait(pause)
    try {
      const status = await fetchStatus()
      const before = getState()
      setState({
        today: status.today,
        calendarYear: status.calendarYear,
        unlockedDays: status.unlockedDays,
        synced: true,
      })
      // Wich die Geräteuhr vom Server ab, steht die Kamera noch vor dem falschen Haus.
      const moved = status.unlockedDays !== before.unlockedDays
      if (moved && !interacted && before.phase === 'street' && before.focusedDay === null) {
        scene?.goToHouse(Math.min(Math.max(status.unlockedDays, 1), TOTAL_DAYS))
      }
      clearTimeout(statusTimer)
      if (status.nextUnlockAt) {
        // Um Mitternacht öffnet das nächste Haus – dann nachfragen, auch wenn die App offen bleibt.
        const untilUnlock = Date.parse(status.nextUnlockAt) - Date.parse(status.serverTime)
        const delay = Math.min(Math.max(untilUnlock + 1500, 5000), 6 * 3_600_000)
        statusTimer = setTimeout(() => void refreshStatus(), delay)
      }
      return
    } catch {
      // nächster Versuch
    }
  }
}

function refreshStatus(): Promise<void> {
  statusRequest ??= loadStatus().finally(() => {
    statusRequest = null
  })
  return statusRequest
}

async function refreshSnow(): Promise<void> {
  try {
    setState({ snow: await fetchSnow() })
  } catch {
    // Das Schnee-o-Meter zeigt dann einfach keinen Wert.
  }
}

let started = false

export function bootstrap(): void {
  if (isDevPreview()) return
  if (started) return
  started = true

  const today = berlinToday(new Date())
  setState({
    progress: loadProgress(),
    today,
    unlockedDays: unlockedDaysOn(today, DEFAULT_CALENDAR_YEAR),
    pendingToken: takeTokenFromAddress(),
  })
  void loadSelfies().then((stored) => setState((state) => ({ selfies: { ...stored, ...state.selfies } })))
  void refreshStatus()
  void refreshSnow()

  setInterval(() => void refreshSnow(), SNOW_REFRESH_MS)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshStatus()
  })
}

// ------------------------------------------------------------- Straße

export function dismissHint(): void {
  interacted = true
  if (!getState().progress.hintSeen) updateProgress((progress) => ({ ...progress, hintSeen: true }))
}

export function showToast(text: string): void {
  setState({ toast: { id: Date.now(), text } })
}

/** Ein Haus antippen: Die Kamera fliegt zur Tür, die Karte des Hauses erscheint. */
export function selectHouse(day: number): void {
  const state = getState()
  if (state.phase !== 'street' || state.modal !== null) return
  dismissHint()
  if (state.focusedDay === day) return
  setState({ focusedDay: day, notice: null })
  scene?.focusHouse(day)
}

export function closeHouse(): void {
  if (getState().phase !== 'street') return
  setState({ focusedDay: null, notice: null, modal: null })
  scene?.focusHouse(null)
}

/** Die Kamera fährt vor ein Haus. Ohne 3D-Szene öffnet sich stattdessen gleich dessen Karte. */
export function visitHouse(day: number): void {
  dismissHint()
  if (scene) scene.goToHouse(day)
  else selectHouse(day)
}

/** Durch das offene Tor bis vor den Weihnachtsbaum gehen. */
export function visitTree(): void {
  closeHouse()
  scene?.goToTree()
}

/**
 * Der Knopf zum Umschauen. Bei den Häusern wechselt er zwischen dem Blick auf
 * die Fassaden und dem die Straße entlang zum Baum. Am Tor schaut die Kamera
 * ohnehin zum Baum – dort dreht er sie zurück zur Straße und wieder nach vorn.
 */
export function toggleLook(): void {
  dismissHint()
  const { look, place } = getState()
  const atEnd = place !== null && place >= GATE_DAY
  // „Zum Baum schauen“: Nach Santa Bibber fliegt dann der Weihnachtsmann darüber hinweg.
  const towardTree = atEnd ? look < 0 : look === 0
  if (atEnd) scene?.look(look < 0 ? 0 : -1)
  else scene?.look(look === 0 ? 1 : 0)
  if (towardTree) scene?.flySanta()
}

// ----------------------------------------------------------- Schlüssel

export function openScanner(day: number): void {
  setState({ modal: { kind: 'scan', day }, notice: null })
}

export function openSelfie(day: number): void {
  setState({ modal: { kind: 'selfie', day, enterAfter: false } })
}

export function closeModal(): void {
  setState({ modal: null })
}

function explain(result: Exclude<UnlockResult, { ok: true }>, day: number): string {
  switch (result.reason) {
    case 'locked':
      return `Nicht so schnell! ${placeTitle(day)} öffnet erst am ${formatDay(day)}.`
    case 'invalid_key':
      return `Dieser Schlüssel passt nicht ${isGate(day) ? 'zum Tor' : `zu Haus ${day}`}. Hast du die richtige Box erwischt?`
    case 'rate_limited':
      return 'Das waren zu viele Versuche. Warte bitte einen Moment.'
    case 'offline':
      return 'Die Weihnachtsstraße ist gerade nicht erreichbar. Versuch es gleich noch einmal.'
  }
}

/** Probiert den Schlüssel aus, zeigt das Öffnen und bietet danach Selfie und Eintreten an. */
export async function submitToken(token: DoorToken): Promise<void> {
  const { day, key } = token
  if (getState().phase !== 'street' || getState().verifyingDay !== null) return
  setState({ modal: null, pendingToken: null })
  selectHouse(day)

  const known = getState().progress.keys[day] === key
  if (!known) {
    setState({ verifyingDay: day, notice: null })
    const result = await unlockHouse(day, key)
    if (!result.ok) {
      setState({
        verifyingDay: null,
        notice: { day, tone: result.reason === 'locked' ? 'info' : 'error', text: explain(result, day) },
        // Ohne Verbindung bleibt der Schlüssel in der Hand – für den nächsten Versuch.
        pendingToken: result.reason === 'offline' ? token : null,
      })
      return
    }
    updateProgress((progress) => ({ ...progress, keys: { ...progress.keys, [day]: key } }))
    // Der Server hat das Haus geöffnet – dann ist dieser Tag auf jeden Fall erreicht.
    setState((state) => ({ unlockedDays: Math.max(state.unlockedDays, day) }))
    showToast('Der Schlüssel passt!')
    try {
      // Die Öffnung bleibt sichtbar, bevor Selfie oder Innenraum die Straße verdecken.
      if (scene) await Promise.race([scene.playUnlock(day), wait(ENTER_TIMEOUT_MS)])
    } finally {
      setState({ verifyingDay: null })
    }
  }

  if (getState().phase !== 'street') return
  selectHouse(day)
  if (known || getState().selfies[day]) await enterHouse(day)
  else setState({ modal: { kind: 'selfie', day, enterAfter: true } })
}

/** Text aus dem QR-Scanner. Liefert false, wenn darin kein Türschlüssel steckt. */
export function submitScan(text: string, expectedDay: number): boolean {
  const token = extractToken(text)
  if (!token) return false
  if (token.day !== expectedDay) {
    showToast(`Das ist der Schlüssel für ${placeName(token.day)} – ich bringe dich hin.`)
  }
  void submitToken(token)
  return true
}

/** Abgetippter Schlüssel (steht unter dem QR-Code), falls die Kamera nicht will. */
export function submitTypedKey(day: number, input: string): void {
  void submitToken({ day, key: normalizeKey(input) })
}

// -------------------------------------------------------------- Selfie

/** Schließt den Selfie-Schritt ab – mit Foto oder (null) ohne. */
export function finishSelfie(dataUrl: string | null): void {
  const modal = getState().modal
  if (modal?.kind !== 'selfie') return
  if (dataUrl) {
    setState((state) => ({ selfies: { ...state.selfies, [modal.day]: dataUrl } }))
    if (!isDevPreview()) void storeSelfie(modal.day, dataUrl)
  }
  setState({ modal: null })
  if (modal.enterAfter) void enterHouse(modal.day)
}

// ------------------------------------------------------------ Im Haus

/** Die Tür geht auf, die Kamera fährt ins Licht, dann erscheint das Innere des Hauses. */
export async function enterHouse(day: number): Promise<void> {
  const state = getState()
  if (state.phase !== 'street' || state.verifyingDay !== null || !state.progress.keys[day] || day > state.unlockedDays) return
  if (minigameFor(day).layout === 'outdoor') {
    scene?.setPaused(true)
    setState({ phase: 'inside', insideDay: day, focusedDay: day, modal: null, notice: null })
    return
  }
  setState({ phase: 'opening', focusedDay: day, modal: null, notice: null })
  // Die Kamerafahrt dauert gut anderthalb Sekunden. Sollte sie hängen bleiben
  // (etwa weil der Browser das Zeichnen pausiert), geht es trotzdem weiter.
  await Promise.race([scene ? scene.playEnter(day) : wait(900), wait(ENTER_TIMEOUT_MS)])
  setState({ phase: 'inside', insideDay: day })
  scene?.setPaused(true)
}

export async function leaveHouse(): Promise<void> {
  const { phase, insideDay } = getState()
  if (phase !== 'inside' || insideDay === null) return
  setState({ phase: 'leaving' })
  await wait(LEAVE_FADE_MS)
  scene?.finishLeave(insideDay)
  scene?.setPaused(false)
  setState({ phase: 'street', insideDay: null, focusedDay: null })
}

export function completeGame(day: number): void {
  if (getState().progress.completed[day]) return
  updateProgress((progress) => ({
    ...progress,
    completed: { ...progress.completed, [day]: new Date().toISOString() },
  }))
}

/** Aus der Nahaufnahme eines Easter Eggs zurück auf die Straße. */
export function stopInspecting(): void {
  scene?.stopInspecting()
}

/** Ein Eichhörnchen auf der Straße wurde mit einem Schneeball getroffen. */
export function hitSquirrel(): void {
  updateProgress((progress) => ({ ...progress, squirrels: progress.squirrels + 1 }))
}

export function saveGameState(day: number, gameState: unknown): void {
  updateProgress((progress) => ({ ...progress, games: { ...progress.games, [day]: gameState } }))
}
