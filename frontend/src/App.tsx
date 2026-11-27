import { Suspense, lazy } from 'react'
import { closeModal } from './state/flow.ts'
import { useStore } from './state/store.ts'
import { HousePanel } from './ui/HousePanel.tsx'
import { Hud } from './ui/Hud.tsx'
import { Interior } from './ui/Interior.tsx'
import { LoadBoundary } from './ui/LoadBoundary.tsx'
import { SelfieCapture } from './ui/SelfieCapture.tsx'
import { StreetCanvas } from './ui/StreetCanvas.tsx'
import { Toast } from './ui/Toast.tsx'

// Der Scanner bringt eine eigene Bibliothek mit und wird erst geladen, wenn er gebraucht wird.
const QrScanner = lazy(() => import('./ui/QrScanner.tsx'))

export default function App({ initialInteriorStage = 'game' }: { initialInteriorStage?: 'game' | 'reward' } = {}) {
  const phase = useStore((state) => state.phase)
  const insideDay = useStore((state) => state.insideDay)
  const modal = useStore((state) => state.modal)

  return (
    <main className="app">
      <StreetCanvas />
      <Hud />
      <HousePanel />

      {modal?.kind === 'scan' && (
        <LoadBoundary
          fallback={() => (
            <div className="camera" role="alertdialog" aria-label="Scanner nicht verfügbar">
              <header className="camera__header">
                <h2>Der Scanner lässt sich nicht laden</h2>
                <p>Prüfe deine Verbindung und versuch es gleich noch einmal.</p>
              </header>
              <footer className="camera__footer">
                <button type="button" className="button" onClick={closeModal}>
                  Zurück
                </button>
              </footer>
            </div>
          )}
        >
          <Suspense fallback={null}>
            <QrScanner day={modal.day} />
          </Suspense>
        </LoadBoundary>
      )}
      {modal?.kind === 'selfie' && <SelfieCapture day={modal.day} enterAfter={modal.enterAfter} />}

      {insideDay !== null && <Interior key={insideDay} day={insideDay} initialStage={initialInteriorStage} />}
      {/* Das gleißende Licht aus der Haustür – blendet zwischen Straße und Innenraum über. */}
      <div className="light" data-phase={phase} aria-hidden="true" />
      <Toast />
    </main>
  )
}
