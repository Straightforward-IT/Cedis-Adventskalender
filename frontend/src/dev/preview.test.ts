import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchReward, unlockHouse } from '../api/client.ts'
import { isDevPreview, PREVIEW_KEY } from '../lib/devPreview.ts'
import * as storage from '../lib/storage.ts'
import { bootstrap, completeGame, finishSelfie, saveGameState, submitScan, submitToken } from '../state/flow.ts'
import { houseStatus, useStore } from '../state/store.ts'
import { parsePreviewRoute } from './routes.ts'
import { createPreviewState } from './state.ts'

vi.mock('../lib/storage.ts', async (original) => ({
  ...await original<typeof storage>(),
  loadProgress: vi.fn(),
  loadSelfies: vi.fn(),
  saveProgress: vi.fn(),
  storeSelfie: vi.fn(),
}))

const routeFor = (path: string) => parsePreviewRoute(new URL(path, 'http://localhost:5173'))
const stateFor = (path: string) => createPreviewState(routeFor(path))

describe('Dev-Routen', () => {
  it('aktiviert nur /dev und dessen Unterpfade bei eingeschalteter Vorschau', () => {
    expect(isDevPreview('/dev', true)).toBe(true)
    expect(isDevPreview('/dev/game/1', true)).toBe(true)
    expect(isDevPreview('/development', true)).toBe(false)
    expect(isDevPreview('/', true)).toBe(false)
    expect(isDevPreview('/dev/game/1', false)).toBe(false)
  })

  it('liest Übersicht, Tagesgrenzen, Zustände und Wiederholung', () => {
    expect(routeFor('/dev/')).toEqual({ kind: 'index' })
    expect(routeFor('/dev/game/24?completed=true')).toMatchObject({ kind: 'screen', day: 24, completedBefore: true })
    expect(routeFor('/dev/house/1?status=locked')).toMatchObject({ kind: 'screen', day: 1, status: 'locked' })
    expect(routeFor('/dev/tree')).toMatchObject({ kind: 'screen', screen: 'tree' })
    expect(routeFor('/dev/reward/12/')).toMatchObject({ kind: 'screen', day: 12 })
  })

  it.each(['/dev/game/0', '/dev/game/25', '/dev/game/1.5', '/dev/game/-1', '/dev/game/NaN', '/dev/game', '/dev/tree/1', '/dev/unknown', '/dev/house/1?status=broken', '/dev/toString/1'])(
    'weist ungültige Route %s zurück', (path) => {
      expect(routeFor(path)).toEqual({ kind: 'not-found' })
    },
  )

  it.each(['locked', 'available', 'unlocked', 'completed'] as const)('zeigt den Hauszustand %s auch am Tor', (status) => {
    const state = stateFor(`/dev/house/24?status=${status}`)
    expect(houseStatus(state, 24)).toBe(status)
    expect(state.focusedDay).toBe(24)
  })

  it('bereitet Scanner, Selfie, Innenraum und Weihnachtsbaum vor', () => {
    expect(stateFor('/dev/scanner/5')).toMatchObject({ focusedDay: 5, modal: { kind: 'scan', day: 5 } })
    expect(stateFor('/dev/scanner/5').progress.keys[5]).toBeUndefined()
    expect(stateFor('/dev/selfie/5')).toMatchObject({ modal: { kind: 'selfie', day: 5, enterAfter: true } })
    expect(stateFor('/dev/game/5')).toMatchObject({ insideDay: 5, phase: 'inside' })
    expect(stateFor('/dev/game/5?completed=true').progress.completed[5]).toBeTruthy()
    expect(stateFor('/dev/reward/5').progress.completed[5]).toBeTruthy()
    expect(stateFor('/dev/tree').place).toBe(25)
    expect(houseStatus(stateFor('/dev/tree'), 24)).toBe('completed')
  })

  it('simuliert den gewählten Tag: alles davor gelöst, danach verschlossen', () => {
    const state = stateFor('/dev/game/6')
    expect(state).toMatchObject({ today: '2026-12-06', unlockedDays: 6 })
    for (let day = 1; day <= 5; day++) {
      expect(houseStatus(state, day)).toBe('completed')
    }
    expect(houseStatus(state, 6)).toBe('unlocked')
    expect(houseStatus(state, 7)).toBe('locked')
    expect(state.progress.games[4]).toMatchObject({ colors: { sky: 13 } })
    expect(state.selfies).toEqual({})
  })

  it('zeigt die Straße am simulierten Tag, ohne Angabe am 24.', () => {
    expect(routeFor('/dev/street?day=6')).toMatchObject({ screen: 'street', day: 6, moonDay: 6 })
    expect(routeFor('/dev/street')).toMatchObject({ screen: 'street', day: 24, moonDay: 24 })
    expect(routeFor('/dev/street?day=25')).toEqual({ kind: 'not-found' })
    const street = stateFor('/dev/street?day=6')
    expect(houseStatus(street, 5)).toBe('completed')
    expect(houseStatus(street, 6)).toBe('unlocked')
    expect(street.place).toBe(6)
  })

  it('erzeugt für jeden Aufruf frische Spielstände und Selfies', () => {
    const first = stateFor('/dev/game/1')
    first.progress.games[1] = { moves: 3 }
    first.selfies[1] = 'data:example'
    const second = stateFor('/dev/game/1')
    expect(second.progress.games).toEqual({})
    expect(second.selfies).toEqual({})
    expect(stateFor('/dev/street?day=6').progress.games[4]).not.toBe(stateFor('/dev/street?day=6').progress.games[4])
  })
})

describe('Vorschau-Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('location', { pathname: '/dev/game/1' })
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Die Vorschau darf keinen Server aufrufen') }))
    useStore.setState(stateFor('/dev/game/1'), true)
  })

  afterEach(() => {
    useStore.setState(useStore.getInitialState(), true)
    vi.unstubAllGlobals()
  })

  it('startet ohne Browserdaten oder Serverabfragen', () => {
    bootstrap()
    expect(storage.loadProgress).not.toHaveBeenCalled()
    expect(storage.loadSelfies).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('speichert Spielstände und Abschlüsse ausschließlich im Testzustand', () => {
    saveGameState(1, { moves: 7 })
    completeGame(1)
    expect(useStore.getState().progress.games[1]).toEqual({ moves: 7 })
    expect(useStore.getState().progress.completed[1]).toBeTruthy()
    expect(storage.saveProgress).not.toHaveBeenCalled()
  })

  it('behält Selfies im Testzustand und schreibt nicht in IndexedDB', () => {
    useStore.setState({ modal: { kind: 'selfie', day: 1, enterAfter: false } })
    finishSelfie('data:image/png;base64,preview')
    expect(useStore.getState().selfies[1]).toBe('data:image/png;base64,preview')
    expect(storage.storeSelfie).not.toHaveBeenCalled()
    expect(useStore.getState().modal).toBeNull()
  })

  it('testet gültige und ungültige Schlüssel sowie Belohnungen ohne Backend', async () => {
    expect(await unlockHouse(1, PREVIEW_KEY)).toEqual({ ok: true })
    expect(await unlockHouse(1, 'WRONG')).toEqual({ ok: false, reason: 'invalid_key' })
    expect(await fetchReward(1, PREVIEW_KEY)).toMatchObject({ day: 1, title: 'Türchen 1' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('führt vom Scanner mit Testschlüssel zum Selfie und zeigt falsche Schlüssel an', async () => {
    useStore.setState(stateFor('/dev/scanner/5'), true)
    await submitToken({ day: 5, key: 'WRONG' })
    expect(useStore.getState().notice).toMatchObject({ day: 5, tone: 'error' })
    expect(submitScan(`5.${PREVIEW_KEY}`, 5)).toBe(true)
    // Der Scanner startet die asynchrone Freischaltung; die Antwort ist ein lokales Promise.
    await Promise.resolve()
    expect(useStore.getState().modal).toEqual({ kind: 'selfie', day: 5, enterAfter: true })
    expect(useStore.getState().progress.keys[5]).toBe(PREVIEW_KEY)
    expect(storage.saveProgress).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('behält das Speichern außerhalb von /dev bei', () => {
    vi.stubGlobal('location', { pathname: '/' })
    saveGameState(1, { moves: 4 })
    expect(storage.saveProgress).toHaveBeenCalledWith(useStore.getState().progress)
    useStore.setState({ modal: { kind: 'selfie', day: 1, enterAfter: false } })
    finishSelfie('data:image/png;base64,normal')
    expect(storage.storeSelfie).toHaveBeenCalledWith(1, 'data:image/png;base64,normal')
  })
})
