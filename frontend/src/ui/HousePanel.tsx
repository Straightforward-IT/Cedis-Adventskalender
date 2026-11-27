import { formatDay, sleepsUntil } from '../lib/calendar.ts'
import { isGate, placeTitle } from '../lib/places.ts'
import { unlockFor } from '../lib/unlocks.ts'
import { hasMinigame, minigameFor } from '../minigames/registry.ts'
import {
  closeHouse,
  enterHouse,
  openScanner,
  openSelfie,
  submitToken,
  visitTree,
} from '../state/flow.ts'
import { houseStatus, useStore } from '../state/store.ts'
import { IconCamera, IconClose, IconDoor, IconGate, IconKey, IconQr, IconTree } from './icons.tsx'

/** Was die Karte sagt – einmal für ein Haus, einmal für das Tor am 24. */
const HOUSE_TEXT = {
  locked: 'Dieses Haus schläft noch.',
  hasKey: 'Du hast den Schlüssel für dieses Haus dabei.',
  useKey: 'Tür aufschließen',
  needsKey: 'er ist der Schlüssel zu diesem Haus.',
  unlocked: 'Die Tür ist aufgeschlossen. Komm herein!',
  completed: 'Hier warst du schon – komm ruhig noch einmal herein.',
  enter: 'Eintreten',
}

const GATE_TEXT: typeof HOUSE_TEXT = {
  locked: 'Das Tor zum Weihnachtsbaum ist noch verschlossen.',
  hasKey: 'Du hast den Schlüssel für das Tor dabei.',
  useKey: 'Tor aufschließen',
  needsKey: 'er ist der Schlüssel zum Tor.',
  unlocked: 'Aufgeschlossen! Dahinter wartet das letzte Rätsel.',
  completed: 'Der Weg zum Weihnachtsbaum ist frei.',
  enter: 'Zum letzten Rätsel',
}

/** Karte des Hauses (oder des Tors), vor dem die Kamera steht: Was ist hier los, was kann ich tun? */
export function HousePanel() {
  const day = useStore((state) =>
    state.phase === 'street' && state.modal === null ? state.focusedDay : null,
  )
  const today = useStore((state) => state.today)
  const calendarYear = useStore((state) => state.calendarYear)
  const unlockedDays = useStore((state) => state.unlockedDays)
  const progress = useStore((state) => state.progress)
  const selfies = useStore((state) => state.selfies)
  const pendingToken = useStore((state) => state.pendingToken)
  const verifyingDay = useStore((state) => state.verifyingDay)
  const notice = useStore((state) => state.notice)

  if (day === null) return null

  const gate = isGate(day)
  const outdoor = minigameFor(day).layout === 'outdoor'
  const text = gate ? GATE_TEXT : HOUSE_TEXT
  const status = houseStatus({ unlockedDays, progress }, day)
  const token = pendingToken?.day === day ? pendingToken : null
  const message = notice?.day === day ? notice : null
  const selfieButton = (
    <button type="button" className="button button--quiet" onClick={() => openSelfie(day)}>
      <IconCamera />
      {selfies[day] ? 'Neues Selfie' : 'Selfie aufnehmen'}
    </button>
  )

  let content
  if (verifyingDay === day) {
    content = (
      <p className="panel__text panel__text--busy" role="status">
        <span className="spinner" aria-hidden="true" />
        {progress.keys[day] ? 'Die Tür öffnet sich …' : 'Der Schlüssel wird ausprobiert …'}
      </p>
    )
  } else if (status === 'locked') {
    const sleeps = sleepsUntil(day, today, calendarYear)
    content = (
      <>
        <p className="panel__text">
          {text.locked} Es öffnet am {formatDay(day)}.
        </p>
        <p className="panel__countdown">
          {sleeps <= 1 ? 'Nur noch einmal schlafen!' : `Noch ${sleeps}-mal schlafen`}
        </p>
      </>
    )
  } else if (status === 'available') {
    content = token ? (
      <>
        <p className="panel__text">{text.hasKey}</p>
        <button type="button" className="button" onClick={() => void submitToken(token)}>
          <IconKey />
          {text.useKey}
        </button>
      </>
    ) : (
      <>
        <p className="panel__text">
          Scanne den QR-Code auf Box {day} – {text.needsKey}
        </p>
        <button type="button" className="button" onClick={() => openScanner(day)}>
          <IconQr />
          QR-Code scannen
        </button>
      </>
    )
  } else if (gate && status === 'completed') {
    // Das letzte Rätsel ist gelöst: Das Tor steht offen, dahinter wartet der Baum.
    content = (
      <>
        <p className="panel__text">{text.completed}</p>
        <button type="button" className="button" onClick={visitTree}>
          <IconTree />
          Zum Weihnachtsbaum
        </button>
        <button type="button" className="button button--quiet" onClick={() => void enterHouse(day)}>
          <IconGate />
          Rätsel noch einmal spielen
        </button>
      </>
    )
  } else {
    const welcome = outdoor ? 'Das Spiel wartet hinter dem Haus.' : text.unlocked
    const revisit = outdoor ? 'Du kannst das Spiel noch einmal spielen.' : text.completed
    const completed = status === 'completed'
    // Nach dem Lösen: zeigen, was auf der Straße dazugekommen ist – ein Selfie gibt es dann nicht mehr.
    const unlock = completed ? unlockFor(day) : null
    content = (
      <>
        {unlock && (
          <div className="panel__unlock">
            <span className="panel__unlock-icon" aria-hidden="true">{unlock.icon}</span>
            <p>
              <strong>Freigeschaltet:</strong> {unlock.text}
            </p>
          </div>
        )}
        <p className="panel__text">{completed ? revisit : welcome}</p>
        <button type="button" className="button" onClick={() => void enterHouse(day)}>
          {gate ? <IconGate /> : <IconDoor />}
          {outdoor ? 'Zum Spiel' : text.enter}
        </button>
        {!completed && selfieButton}
      </>
    )
  }

  return (
    <section className="panel" aria-label={placeTitle(day)}>
      <button type="button" className="panel__close" aria-label="Zurück zur Straße" onClick={closeHouse}>
        <IconClose />
      </button>
      <span className="panel__badge" aria-hidden="true">
        {day}
      </span>
      <h2>{placeTitle(day)}</h2>
      {/* Statt des Datums der Name des Spiels – solange es noch keins gibt, das Datum. */}
      <p className="panel__date">{hasMinigame(day) ? minigameFor(day).title : formatDay(day)}</p>
      {message && (
        <p className="panel__notice" data-tone={message.tone} role="alert">
          {message.text}
        </p>
      )}
      <div className="panel__actions">{content}</div>
    </section>
  )
}
