import { DEFAULT_CALENDAR_YEAR, TOTAL_DAYS } from '../lib/calendar.ts'
import { PREVIEW_KEY } from '../lib/devPreview.ts'
import { TREE_PLACE } from '../lib/places.ts'
import { emptyProgress } from '../lib/storage.ts'
import { useStore } from '../state/store.ts'
import type { AppState } from '../state/store.ts'
import { parsePreviewRoute } from './routes.ts'
import type { PreviewRoute } from './routes.ts'

const decemberDate = (day: number) => `${DEFAULT_CALENDAR_YEAR}-12-${String(day).padStart(2, '0')}`

/** Ein fertig ausgemaltes Rentier für die Staffelei vor Haus 4. */
const SAMPLE_COLORING = {
  colors: {
    sky: 13, stars: 8, ground: 0, antlers: 2, tail: 1, legs: 3, hooves: 13, body: 3, spots: 1,
    blanket: 4, blanketBorder: 8, ears: 3, earsInner: 5, head: 3, muzzle: 1, nose: 4,
    hat: 4, hatStripes: 0, brim: 0, pompom: 0, ornament: 12, ornamentBand: 8, ornamentCap: 15,
  },
}

/** Spielstände, die nach dem Lösen auf der Straße sichtbar werden. */
const SOLVED_GAMES: Partial<Record<number, unknown>> = { 4: SAMPLE_COLORING }

/** Die Tage 1 bis `lastDay` gelten als erledigt: Schlüssel, Abschluss und ggf. der gelöste Spielstand. Selfies gibt es keine. */
function completeThrough(state: AppState, lastDay: number, timestamp: string): void {
  for (let n = 1; n <= lastDay; n++) {
    state.progress.keys[n] = PREVIEW_KEY
    state.progress.completed[n] = timestamp
    if (SOLVED_GAMES[n] !== undefined) state.progress.games[n] = structuredClone(SOLVED_GAMES[n])
  }
}

export function initializePreview(): void {
  useStore.setState(createPreviewState(parsePreviewRoute(new URL(window.location.href))), true)
}

/** Frische Beispieldaten im Arbeitsspeicher; liest weder Fortschritt noch Selfies des Besuchers. */
export function createPreviewState(route: PreviewRoute): AppState {
  const timestamp = `${DEFAULT_CALENDAR_YEAR}-12-24T12:00:00.000Z`
  const state: AppState = {
    ...useStore.getInitialState(),
    progress: { ...emptyProgress(), hintSeen: true },
    selfies: {},
    today: `${DEFAULT_CALENDAR_YEAR}-12-24`,
    unlockedDays: TOTAL_DAYS,
    synced: true,
    place: 1,
    snow: {
      location: 'Hamburg',
      date: `${DEFAULT_CALENDAR_YEAR}-12-24`,
      probability: 65,
      snowfallCm: 2.4,
      temperatureMin: -3,
      temperatureMax: 1,
      method: 'ensemble',
      updatedAt: timestamp,
    },
  }
  for (let day = 1; day <= TOTAL_DAYS; day++) state.progress.keys[day] = PREVIEW_KEY
  if (route.kind !== 'screen') return state

  const { screen, day } = route
  // Heute ist der gewählte Tag: Was davor lag, ist geschafft – samt den
  // Spielständen, die die Straße schmücken. Spätere Häuser schlafen noch.
  const simulatedDay = screen === 'tree' ? TOTAL_DAYS : day
  state.today = decemberDate(simulatedDay)
  state.unlockedDays = simulatedDay
  for (let n = simulatedDay + 1; n <= TOTAL_DAYS; n++) delete state.progress.keys[n]
  completeThrough(state, simulatedDay - 1, timestamp)
  state.place = day
  state.moonDate = decemberDate(route.moonDay)
  if (screen === 'tree') {
    state.place = TREE_PLACE
    completeThrough(state, TOTAL_DAYS, timestamp)
  }
  if (screen === 'house' || screen === 'scanner' || screen === 'selfie') state.focusedDay = day
  if (screen === 'house') {
    if (route.status === 'locked') {
      state.unlockedDays = day - 1
      state.today = day === 1 ? `${DEFAULT_CALENDAR_YEAR}-11-30` : decemberDate(day - 1)
    }
    if (route.status === 'locked' || route.status === 'available') delete state.progress.keys[day]
    if (route.status === 'completed') state.progress.completed[day] = timestamp
  }
  if (screen === 'scanner') {
    delete state.progress.keys[day]
    state.modal = { kind: 'scan', day }
  }
  if (screen === 'selfie') state.modal = { kind: 'selfie', day, enterAfter: true }
  if (screen === 'game' || screen === 'reward') {
    state.phase = 'inside'
    state.insideDay = day
    if (route.completedBefore || screen === 'reward') state.progress.completed[day] = timestamp
  }
  return state
}
