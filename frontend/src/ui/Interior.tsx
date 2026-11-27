import { Suspense, lazy, useState } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { TOTAL_DAYS, formatDay } from '../lib/calendar.ts'
import { isGate, placeTitle } from '../lib/places.ts'
import { minigameFor } from '../minigames/registry.ts'
import type { MinigameProps } from '../minigames/types.ts'
import { completeGame, leaveHouse, saveGameState } from '../state/flow.ts'
import { useStore } from '../state/store.ts'
import { LoadBoundary } from './LoadBoundary.tsx'
import { RewardView } from './RewardView.tsx'

type Game = LazyExoticComponent<ComponentType<MinigameProps>>

/** Ein Platz pro Tag. Geladen wird ein Spiel erst, wenn sein Haus betreten wird. */
const games: Game[] = Array.from({ length: TOTAL_DAYS }, (_, index) =>
  lazy(minigameFor(index + 1).load),
)

/** Das Innere eines Hauses – oder die Stube hinter dem Tor: die Bühne für Minispiel und Belohnung. */
export function Interior({ day, initialStage = 'game' }: { day: number; initialStage?: 'game' | 'reward' }) {
  const Game = games[day - 1]
  const definition = minigameFor(day)
  // Beim Eintreten festgehalten – das Spiel selbst verwaltet seinen Stand danach allein.
  const [visit] = useState(() => {
    const { progress } = useStore.getState()
    return { savedState: progress.games[day], completedBefore: Boolean(progress.completed[day]) }
  })
  const [stage, setStage] = useState<'game' | 'reward'>(initialStage)
  const [replaying, setReplaying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const outdoor = stage === 'game' && definition.layout === 'outdoor'
  // Ist das letzte Rätsel gelöst, führt der Weg nicht zurück, sondern durchs Tor zum Baum.
  const toTree = useStore((state) => isGate(day) && Boolean(state.progress.completed[day]))

  return (
    <section className={`interior${outdoor ? ' interior--outdoor' : ''}`} aria-label={outdoor ? `Hinter Haus ${day}` : isGate(day) ? 'Am Tor' : `Im Haus ${day}`}>
      <header className="interior__header">
        {!outdoor && <span className="interior__number" aria-hidden="true">{day}</span>}
        <div>
          <h2>{definition.title}</h2>
          <p>{outdoor ? placeTitle(day) : `${placeTitle(day)} · ${formatDay(day)}`}</p>
        </div>
      </header>

      <div className={`interior__stage${stage === 'game' && definition.layout === 'wide' ? ' interior__stage--wide' : ''}`}>
        {stage === 'reward' ? (
          <RewardView day={day} onReplay={() => {
            setReplaying(true)
            setStage('game')
          }} />
        ) : (
          <LoadBoundary
            key={attempt}
            onRetry={() => {
              // Ein fehlgeschlagener Ladeversuch bleibt sonst für immer fehlgeschlagen.
              games[day - 1] = lazy(definition.load)
              setAttempt(attempt + 1)
            }}
            fallback={(retry) => (
              <div className="placeholder">
                <h3>Das Spiel lässt sich gerade nicht laden</h3>
                <p>Prüfe deine Verbindung und versuch es noch einmal.</p>
                <button type="button" className="button" onClick={retry}>
                  Nochmal versuchen
                </button>
              </div>
            )}
          >
            <Suspense fallback={<span className="spinner" aria-label="Lädt" />}>
              <Game
                day={day}
                savedState={replaying ? undefined : visit.savedState}
                saveState={(gameState) => saveGameState(day, gameState)}
                completedBefore={visit.completedBefore || replaying}
                onComplete={() => {
                  completeGame(day)
                  setStage('reward')
                }}
              />
            </Suspense>
          </LoadBoundary>
        )}
      </div>

      <footer className="interior__footer">
        <button
          type="button"
          className={toTree ? 'button' : 'button button--quiet'}
          onClick={() => void leaveHouse()}
        >
          {toTree ? 'Weiter zum Weihnachtsbaum' : 'Zurück zur Straße'}
        </button>
      </footer>
    </section>
  )
}
