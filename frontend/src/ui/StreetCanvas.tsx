import { useEffect, useRef, useState } from 'react'
import { TOTAL_DAYS } from '../lib/calendar.ts'
import { adventCandles } from '../lib/advent.ts'
import { eveningMoonPhase } from '../lib/moon.ts'
import { GATE_DAY, SKI_HOUSE_DAY, TREE_PLACE } from '../lib/places.ts'
import { artworkSvg, isComplete, restoreColoring } from '../minigames/games/coloring/artwork.ts'
import { isBuilt, restoreState as restoreGingerbread } from '../minigames/games/gingerbread/model.ts'
import { LAMP_COLORS } from '../minigames/games/lights/model.ts'
import type { StreetScene } from '../scene/StreetScene.ts'
import { attachScene, closeHouse, dismissHint, hitSquirrel, selectHouse } from '../state/flow.ts'
import { highlightedDay, houseStatus, useStore } from '../state/store.ts'
import type { AppState } from '../state/store.ts'

// Die 3D-Szene (samt three.js) ist der dickste Brocken der App. Sie wird parallel
// nachgeladen, damit Titel und Bedienelemente sofort erscheinen.
/** Das Haus, aus dessen Fenster der Wichtel ertappt wurde (Spiel „Eingeschneit!“). */
const ELF_DAY = 3
/** Spuren im Schnee: Das Rentier aus dem Punktebild zieht in den Giebel. */
const REINDEER_DAY = 2
/** Weihnachtsbäckerei: Hinter den Fenstern läuft danach das Kuchenband. */
const BAKERY_DAY = 1
/** Malstunde: Das fertige Bild kommt auf die Staffelei. */
const EASEL_DAY = 4
/** Mondstaub-Mann: Danach steht er auf dem Mond am Himmel. */
const MOON_DAY = 5
/** Schneeballschlacht: Danach lassen sich auf der Straße Eichhörnchen abwerfen. */
const SQUIRREL_DAY = 6
/** Lebkuchenhaus: Das fertige Haus steht danach im Fenster. */
const GINGER_DAY = 7
/** Lichterketten-Schlamassel: Die entwirrte Kette hängt danach an der Dachkante von Haus 9. */
const LIGHTS_DAY = 9
/** Holz hacken: Danach brennt in Haus 10 der Kamin, und der Schornstein spuckt Flammen. */
const FIREWOOD_DAY = 10
/** Santa Bibber: Danach fliegt der Weihnachtsmann bei jedem Blick zum Baum vorbei. */
const SANTA_DAY = 11

const sceneModule = import('../scene/StreetScene.ts')

/** Hält die Szene mit dem Zustand der App im Gleichschritt. Liefert die Funktion zum Abmelden. */
function syncScene(scene: StreetScene): () => void {
  const apply = (state: AppState, previous: AppState | null) => {
    if (state.unlockedDays !== previous?.unlockedDays || state.progress !== previous?.progress) {
      const marked = highlightedDay(state)
      scene.setHouseStates(
        Array.from({ length: TOTAL_DAYS }, (_, index) => ({
          awake: houseStatus(state, index + 1) !== 'locked',
          opened: ['unlocked', 'completed'].includes(houseStatus(state, index + 1)),
          marked: index + 1 === marked,
        })),
      )
      // Ist das letzte Rätsel gelöst, steht das Tor offen – der Weg zum Baum ist frei.
      scene.setGateOpen(houseStatus(state, GATE_DAY) === 'completed')
      // Easter Egg: Der ertappte Wichtel aus Haus 3 lugt danach hinter dessen Ecke hervor.
      scene.setPeekingElf(houseStatus(state, ELF_DAY) === 'completed' ? ELF_DAY : null)
      // Rentier aus Haus 2 im Giebel, Kuchen-Förderband hinter den Fenstern von Haus 1.
      scene.setGableReindeer(houseStatus(state, REINDEER_DAY) === 'completed' ? REINDEER_DAY : null)
      scene.setCakeConveyor(houseStatus(state, BAKERY_DAY) === 'completed' ? BAKERY_DAY : null)
      // Das selbst ausgemalte Rentier steht auf einer Staffelei vor Haus 4.
      const painted = restoreColoring(state.progress.games[EASEL_DAY])
      scene.setEasel(
        houseStatus(state, EASEL_DAY) === 'completed' && isComplete(painted) ? EASEL_DAY : null,
        isComplete(painted) ? artworkSvg(painted) : null,
      )
      // Der Mondstaub-Mann aus Haus 5 steht danach oben auf dem Mond.
      scene.setMoonSnowman(houseStatus(state, MOON_DAY) === 'completed')
      // Nach der Schneeballschlacht tauchen immer wieder Eichhörnchen auf der Straße auf.
      scene.setSquirrels(houseStatus(state, SQUIRREL_DAY) === 'completed')
      // Das selbst verzierte Lebkuchenhaus steht im mittleren Fenster von Haus 7.
      const ginger = restoreGingerbread(state.progress.games[GINGER_DAY])
      scene.setGingerbreadHouse(
        houseStatus(state, GINGER_DAY) === 'completed' && isBuilt(ginger.placed) ? GINGER_DAY : null,
        { icing: ginger.icing, candies: ginger.candies },
      )
      scene.setSkiHalfpipe(houseStatus(state, SKI_HOUSE_DAY) === 'completed')
      scene.setLightChain(houseStatus(state, LIGHTS_DAY) === 'completed' ? LIGHTS_DAY : null, LAMP_COLORS)
      scene.setFireplace(houseStatus(state, FIREWOOD_DAY) === 'completed' ? FIREWOOD_DAY : null)
      scene.setSantaFlyby(houseStatus(state, SANTA_DAY) === 'completed')
    }
    if (state.selfies !== previous?.selfies) {
      for (let day = 1; day <= TOTAL_DAYS; day++) scene.setSelfie(day, state.selfies[day] ?? null)
    }
    // Der Mond zeigt die echte Phase am Abend des heutigen Tages.
    if (state.today !== previous?.today || state.moonDate !== previous?.moonDate) {
      scene.setMoonPhase(eveningMoonPhase(state.moonDate ?? state.today))
      // Adventskerzen nach Datum – in der Dev-Vorschau nach dem gewählten Tag.
      scene.setAdventCandles(adventCandles(state.moonDate ?? state.today))
    }
    if (state.snow !== previous?.snow) scene.setSnowAmount((state.snow?.probability ?? 0) / 100)
  }
  apply(useStore.getState(), null)
  return useStore.subscribe(apply)
}

/** Die Leinwand mit der 3D-Straße. */
export function StreetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const failed = useStore((state) => state.sceneFailed)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let shutDown: (() => void) | undefined

    sceneModule
      .then(({ StreetScene }) => {
        if (cancelled) return
        const scene = new StreetScene({
          canvas,
          onHouseTap: selectHouse,
          onBackgroundTap: closeHouse,
          onPlaceChange: (place) => useStore.setState({ place }),
          onLookChange: (look) => useStore.setState({ look }),
          onInteract: dismissHint,
          onSquirrelHit: hitSquirrel,
          onInspectChange: (inspecting) => useStore.setState({ inspecting }),
        })

        // Start vor dem Haus von heute – oder vor dem, dessen QR-Code gerade gescannt wurde.
        const { pendingToken, unlockedDays, focusedDay, insideDay, place } = useStore.getState()
        const startDay = pendingToken?.day ?? focusedDay ?? insideDay
          ?? (place === TREE_PLACE ? GATE_DAY : place)
          ?? Math.min(Math.max(unlockedDays, 1), TOTAL_DAYS)
        scene.goToHouse(startDay, true)
        const unsubscribe = syncScene(scene)
        attachScene(scene)
        if (pendingToken) selectHouse(pendingToken.day)
        else if (focusedDay !== null) scene.focusHouse(focusedDay)
        if (place === TREE_PLACE) scene.goToTree()
        if (insideDay !== null) scene.setPaused(true)
        // Nur in der Entwicklung: Zugriff auf Szene und Zustand aus der Browser-Konsole.
        if (import.meta.env.DEV) Object.assign(window, { __street: scene, __store: useStore })

        shutDown = () => {
          unsubscribe()
          attachScene(null)
          scene.dispose()
        }
        setReady(true)
      })
      .catch((error: unknown) => {
        // Kein WebGL oder die Szene ließ sich nicht laden – die App bleibt über die Leiste bedienbar.
        console.error('Die 3D-Straße konnte nicht gestartet werden:', error)
        if (!cancelled) useStore.setState({ sceneFailed: true })
      })

    return () => {
      cancelled = true
      shutDown?.()
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="street"
        data-ready={ready}
        role="img"
        aria-label="Verschneite Weihnachtsstraße mit geschmückten Häusern und dem Tor zum Weihnachtsbaum"
      />
      {!ready && !failed && (
        <p className="street__loading" role="status">
          Die Straße wird geschmückt …
        </p>
      )}
    </>
  )
}
