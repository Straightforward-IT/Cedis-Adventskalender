import { TOTAL_DAYS, formatDay, sleepsUntil } from '../lib/calendar.ts'
import { GATE_DAY, TREE_PLACE, isGate, placeName, placeTitle } from '../lib/places.ts'
import { stopInspecting, toggleLook, visitHouse } from '../state/flow.ts'
import { houseStatus, useStore } from '../state/store.ts'
import type { HouseStatus } from '../state/store.ts'
import { SnowOMeter } from './SnowOMeter.tsx'
import { SquirrelHead } from './SquirrelHead.tsx'
import { IconArrows, IconHouses, IconStar, IconTree } from './icons.tsx'

const DAYS = Array.from({ length: TOTAL_DAYS }, (_, index) => index + 1)

const STATUS_LABELS: Record<HouseStatus, string> = {
  locked: 'noch verschlossen',
  available: 'wartet auf seinen Schlüssel',
  unlocked: 'aufgeschlossen',
  completed: 'besucht',
}

function statusLabel(day: number, status: HouseStatus): string {
  return isGate(day) && status === 'completed' ? 'steht offen' : STATUS_LABELS[status]
}

/** Ist heute einer der 24 Tage des Kalenders? Dann liefert das den Tag, sonst null. */
function adventDay(today: string, calendarYear: number): number | null {
  const [year, month, day] = today.split('-').map(Number)
  return year === calendarYear && month === 12 && day <= TOTAL_DAYS ? day : null
}

function subtitle(today: string, calendarYear: number, unlockedDays: number): string {
  if (!today) return ''
  if (unlockedDays === 0) {
    const sleeps = sleepsUntil(1, today, calendarYear)
    return sleeps === 1 ? 'Morgen öffnet das erste Haus' : `Noch ${sleeps}-mal schlafen`
  }
  const day = adventDay(today, calendarYear)
  return day === null ? 'Frohe Weihnachten!' : `Heute ist der ${formatDay(day)}`
}

/** 24 Punkte – 23 Häuser und als Stern das Tor. Zeigt den Fortschritt und wo man gerade steht. */
function ProgressStrip() {
  const unlockedDays = useStore((state) => state.unlockedDays)
  const progress = useStore((state) => state.progress)
  const place = useStore((state) => state.place)

  return (
    <nav className="strip" aria-label="Häuser und Tor der Weihnachtsstraße">
      {DAYS.map((day) => {
        const status = houseStatus({ unlockedDays, progress }, day)
        const near = day === place
        return (
          <button
            key={day}
            type="button"
            className="strip__dot"
            data-status={status}
            data-near={near}
            data-gate={isGate(day) ? '' : undefined}
            aria-label={`${placeTitle(day)}, ${statusLabel(day, status)}`}
            aria-current={near ? 'location' : undefined}
            onClick={() => visitHouse(day)}
          >
            {near && <span className="strip__number">{day}</span>}
          </button>
        )
      })}
    </nav>
  )
}

/** Nach der Schneeballschlacht: wie viele Eichhörnchen auf der Straße schon getroffen wurden. */
function SquirrelCount() {
  const count = useStore((state) => state.progress.squirrels)
  const unlocked = useStore((state) => Boolean(state.progress.completed[6]))
  if (!unlocked && count === 0) return null
  return (
    <div className="chip squirrels" role="status" aria-label={`${count} Eichhörnchen auf der Straße getroffen`}>
      <SquirrelHead className="squirrels__head" />
      <span key={count} className="squirrels__count">×{count}</span>
    </div>
  )
}

/** Alles, was über der Straße liegt: Titel, Schnee-o-Meter, Fortschritt und Blickwechsel. */
export function Hud() {
  const visible = useStore(
    (state) => state.phase === 'street' && state.focusedDay === null && state.modal === null && state.inspecting === null,
  )
  const inspecting = useStore((state) => state.inspecting)
  const today = useStore((state) => state.today)
  const calendarYear = useStore((state) => state.calendarYear)
  const unlockedDays = useStore((state) => state.unlockedDays)
  const hintSeen = useStore((state) => state.progress.hintSeen)
  const place = useStore((state) => state.place)
  const look = useStore((state) => state.look)
  const sceneFailed = useStore((state) => state.sceneFailed)
  const todaysHouse = adventDay(today, calendarYear) === null ? null : unlockedDays

  // Am Tor schaut die Kamera ohnehin zum Baum – dort dreht der Knopf den Blick zurück zur Straße.
  const atEnd = place !== null && place >= GATE_DAY
  const turned = atEnd ? look < 0 : look !== 0
  const towardsTree = atEnd ? turned : !turned

  return (
    <>
    {inspecting && (
      <div className="inspect" role="status">
        <span className="inspect__label">{inspecting}</span>
        <button type="button" className="chip" onClick={stopInspecting}>
          ← Zurück zur Straße
        </button>
      </div>
    )}
    <div className="hud" data-visible={visible} inert={!visible}>
      <header className="hud__top">
        <div className="hud__title">
          <h1>Weihnachtsstraße</h1>
          <p>
            {place === TREE_PLACE
              ? 'Frohe Weihnachten!'
              : subtitle(today, calendarYear, unlockedDays)}
          </p>
        </div>
        <div className="hud__chips">
          <SquirrelCount />
          <SnowOMeter />
        </div>
      </header>

      {sceneFailed ? (
        <p className="hud__notice">
          Die Straße lässt sich gerade nicht in 3D zeigen. Über die Punkte unten erreichst du
          trotzdem jedes Haus und das Tor.
        </p>
      ) : (
        !hintSeen && (
          <p className="hud__hint">
            <IconArrows />
            Wische, um die Straße entlangzugehen
          </p>
        )
      )}

      <footer className="hud__bottom">
        <div className="hud__row">
          {todaysHouse ? (
            <button type="button" className="chip" onClick={() => visitHouse(todaysHouse)}>
              <IconStar />
              Heute: {placeName(todaysHouse)}
            </button>
          ) : (
            <span />
          )}
          {!sceneFailed && (
            <button type="button" className="chip" aria-pressed={turned} onClick={toggleLook}>
              {towardsTree ? <IconTree /> : <IconHouses />}
              {towardsTree ? 'Zum Baum schauen' : atEnd ? 'Zurückschauen' : 'Zu den Häusern'}
            </button>
          )}
        </div>
        <ProgressStrip />
      </footer>
    </div>
    </>
  )
}
