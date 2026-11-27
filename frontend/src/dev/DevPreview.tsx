import { useState } from 'react'
import App from '../App.tsx'
import { DEFAULT_CALENDAR_YEAR, TOTAL_DAYS } from '../lib/calendar.ts'
import { PREVIEW_KEY, useGameSkip } from '../lib/devPreview.ts'
import { eveningMoonPhase, illumination, phaseName } from '../lib/moon.ts'
import { placeTitle } from '../lib/places.ts'
import { hasMinigame, minigameFor } from '../minigames/registry.ts'
import { leaveHouse } from '../state/flow.ts'
import { useStore } from '../state/store.ts'
import { HOUSE_STATUSES, SCREENS, parsePreviewRoute, previewHref } from './routes.ts'
import type { PreviewScreen } from './routes.ts'
import './preview.css'

const route = parsePreviewRoute(new URL(window.location.href))
const days = Array.from({ length: TOTAL_DAYS }, (_, index) => index + 1)
const screenEntries = Object.entries(SCREENS) as [PreviewScreen, string][]

function Overview() {
  return (
    <div className="dev-preview__index">
      <div className="dev-preview__intro">
        <span className="dev-preview__eyebrow">Die Weihnachtsstraße · Entwicklung</span>
        <h1>Alles an einem Ort ausprobieren.</h1>
        <p>Öffne einen Screen direkt oder springe in eines der 24 Spiele. Der gewählte Tag ist „heute“ – alle Häuser davor gelten als gelöst, samt ihren Spuren auf der Straße (ohne Selfies).</p>
      </div>
      <section aria-labelledby="preview-screens">
        <h2 id="preview-screens">Screens & Abläufe</h2>
        <div className="dev-preview__grid">
          {screenEntries.map(([screen, label]) => (
            <a className="dev-preview__card" key={screen} href={previewHref(screen)}>
              <strong>{label}</strong>
              <span>{previewHref(screen)}</span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="preview-house-states">
        <h2 id="preview-house-states">Hauszustände</h2>
        <div className="dev-preview__grid">
          {Object.entries(HOUSE_STATUSES).map(([status, label]) => (
            <a className="dev-preview__card" key={status} href={`${previewHref('house')}?status=${status}`}>
              <strong>{label}</strong>
              <span>Auch für das Tor an Tag 24 wählbar</span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="preview-games">
        <h2 id="preview-games">Alle 24 Spielplätze</h2>
        <p className="dev-preview__description">Neue Spiele aus der Registry erscheinen hier automatisch. Freie Plätze zeigen den gemeinsamen Platzhalter.</p>
        <div className="dev-preview__grid">
          {days.map((day) => (
            <article className="dev-preview__card" key={day}>
              <span className="dev-preview__eyebrow">{placeTitle(day)} · {hasMinigame(day) ? 'Minispiel' : 'Platzhalter'}</span>
              <h3>{minigameFor(day).title}</h3>
              <div className="dev-preview__card-links">
                <a href={previewHref('game', day)}>Spiel öffnen →</a>
                <a href={previewHref('reward', day)}>Belohnung</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * Sobald man (auch über die Straße) in einem Minispiel steht, zeigt die Leiste Spiel-Werkzeuge:
 * welches Spiel läuft, überspringen (gilt als gelöst) und zurück zur Straße.
 */
function GameControls({ day, onReset }: { day: number; onReset(): void }) {
  const skip = useGameSkip()
  return (
    <nav className="dev-preview__controls dev-preview__controls--game" aria-label="Minispiel-Werkzeuge">
      <p className="dev-preview__game">
        <span>Minispiel · {placeTitle(day)}</span>
        <strong>{minigameFor(day).title}</strong>
      </p>
      <button type="button" className="dev-preview__skip" disabled={!skip} onClick={() => skip?.()}>
        {skip ? 'Spiel überspringen ✓' : 'Gelöst ✓'}
      </button>
      <button type="button" onClick={() => void leaveHouse()}>Zurück zur Straße</button>
      <button type="button" onClick={onReset}>Zurücksetzen ↻</button>
    </nav>
  )
}

function ScreenPreview() {
  const insideDay = useStore((state) => (state.phase === 'inside' ? state.insideDay : null))
  const [attempt, setAttempt] = useState(0)
  const [savedState, setSavedState] = useState('')
  const [error, setError] = useState('')
  if (route.kind !== 'screen') return null
  const { screen, day, status, completedBefore, moonDay } = route
  const moonPhase = eveningMoonPhase(`${DEFAULT_CALENDAR_YEAR}-12-${String(moonDay).padStart(2, '0')}`)
  const decemberDays = Array.from({ length: 31 }, (_, index) => index + 1)
  const withDay = screen !== 'tree'

  const navigate = (nextScreen: PreviewScreen, nextDay = day, params: Record<string, string> = {}) => {
    const url = new URL(previewHref(nextScreen, nextDay), window.location.origin)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    window.location.assign(url.pathname + url.search)
  }

  /** Neuer simulierter Tag: übrige Einstellungen bleiben, der Mond folgt dem Tag. */
  const changeDay = (nextDay: number) => {
    const params = Object.fromEntries(new URLSearchParams(window.location.search))
    delete params.day
    delete params.moon
    navigate(screen, nextDay, params)
  }

  const loadSavedState = () => {
    try {
      const value: unknown = savedState.trim() ? JSON.parse(savedState) : undefined
      useStore.setState((state) => ({ progress: { ...state.progress, games: { ...state.progress.games, [day]: value } } }))
      setError('')
      setAttempt((value) => value + 1)
    } catch {
      setError('Bitte gültiges JSON eingeben.')
    }
  }

  // Über die Straße ins Haus gegangen: statt der Screen-Auswahl die Spiel-Werkzeuge zeigen.
  const inGameFromStreet = insideDay !== null && screen !== 'game' && screen !== 'reward'

  return (
    <>
      {inGameFromStreet ? <GameControls day={insideDay} onReset={() => window.location.reload()} /> : (
      <nav className="dev-preview__controls" aria-label="Vorschau auswählen">
        <label>
          Screen
          <select value={screen} onChange={(event) => navigate(event.target.value as PreviewScreen)}>
            {screenEntries.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        {withDay && (
          <label title="Alle Häuser davor gelten als gelöst">
            {screen === 'street' ? 'Simulierter Tag' : 'Tag'}
            <select value={day} onChange={(event) => changeDay(Number(event.target.value))}>
              {days.map((value) => <option value={value} key={value}>{screen === 'street' ? `${value}. Dezember` : placeTitle(value)}</option>)}
            </select>
          </label>
        )}
        {screen === 'house' && (
          <label>
            Zustand
            <select value={status} onChange={(event) => navigate(screen, day, { status: event.target.value })}>
              {Object.entries(HOUSE_STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        )}
        {screen === 'game' && (
          <label>
            Besuch
            <select value={String(completedBefore)} onChange={(event) => navigate(screen, day, { completed: event.target.value })}>
              <option value="false">Erstes Mal</option>
              <option value="true">Schon gelöst</option>
            </select>
          </label>
        )}
        {(screen === 'street' || screen === 'tree') && (
          <label>
            Mond am
            <select value={moonDay} onChange={(event) => navigate(screen, day, { moon: event.target.value })}>
              {decemberDays.map((value) => <option value={value} key={value}>{value}. Dezember</option>)}
            </select>
          </label>
        )}
        <p className="dev-preview__moon" title={`Abend des ${moonDay}. Dezember ${DEFAULT_CALENDAR_YEAR}`}>
          {phaseName(moonPhase)} · {Math.round(illumination(moonPhase) * 100)} %
        </p>
        {screen === 'game' && <SkipButton />}
        <button type="button" onClick={() => window.location.reload()}>Zurücksetzen ↻</button>
      </nav>
      )}
      {screen === 'scanner' && (
        <p className="dev-preview__hint">Testschlüssel: <code>{PREVIEW_KEY}</code> · QR-Inhalt: <code>{day}.{PREVIEW_KEY}</code> · Andere Schlüssel zeigen den Fehlerfall.</p>
      )}
      {screen === 'game' && (
        <details className="dev-preview__fixture">
          <summary>Gespeicherten Spielstand testen</summary>
          <div>
            <label htmlFor="preview-state">Spielstand als JSON (leer = neuer Spielstand)</label>
            <textarea id="preview-state" rows={2} value={savedState} onChange={(event) => setSavedState(event.target.value)} placeholder={'{"moves": 3}'} />
            <button type="button" onClick={loadSavedState}>Spielstand laden</button>
            {error && <p role="alert">{error}</p>}
          </div>
        </details>
      )}
      <div className="dev-preview__viewport">
        <App key={attempt} initialInteriorStage={screen === 'reward' ? 'reward' : 'game'} />
      </div>
    </>
  )
}

/** „Überspringen“ für den Screen „Minispiel“ – schließt das Spiel als gelöst ab. */
function SkipButton() {
  const skip = useGameSkip()
  return (
    <button type="button" className="dev-preview__skip" disabled={!skip} onClick={() => skip?.()}>
      {skip ? 'Spiel überspringen ✓' : 'Gelöst ✓'}
    </button>
  )
}

const MINIMIZED_KEY = 'dev-preview:minimized'

/** Eingeklappt bleibt eingeklappt – auch beim Wechsel zwischen den Screens (nur in diesem Browser). */
function readMinimized(): boolean {
  try {
    return localStorage.getItem(MINIMIZED_KEY) === 'true'
  } catch {
    return false
  }
}

export default function DevPreview() {
  const [minimized, setMinimized] = useState(readMinimized)
  const toggle = () => {
    const next = !minimized
    setMinimized(next)
    try {
      localStorage.setItem(MINIMIZED_KEY, String(next))
    } catch {
      // Ohne Speicher gilt es eben nur bis zum Neuladen.
    }
  }

  return (
    <div className="dev-preview" data-minimized={minimized}>
      <header className="dev-preview__header">
        <a className="dev-preview__brand" href="/dev">DEV <span>Preview</span></a>
        <p>Beispieldaten · Fortschritt & Selfies nur für diesen Aufruf</p>
        <a href="/">Zur App ↗</a>
        <button type="button" className="dev-preview__minimize" onClick={toggle} aria-label="Dev-Werkzeuge einklappen" title="Einklappen">
          ▴
        </button>
      </header>
      {minimized && (
        <button type="button" className="dev-preview__restore" onClick={toggle} aria-label="Dev-Werkzeuge ausklappen" title="Dev-Werkzeuge ausklappen">
          DEV ▾
        </button>
      )}
      {route.kind === 'index' ? <Overview /> : route.kind === 'not-found' ? (
        <main className="dev-preview__index">
          <h1>Diese Vorschau gibt es nicht.</h1>
          <p>Wähle einen Screen und einen Tag zwischen 1 und 24.</p>
          <a href="/dev">Zur Vorschau-Übersicht</a>
        </main>
      ) : <ScreenPreview />}
    </div>
  )
}
