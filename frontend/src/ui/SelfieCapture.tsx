import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { captureSelfie, selfieFromFile } from '../lib/image.ts'
import { isGate } from '../lib/places.ts'
import { finishSelfie } from '../state/flow.ts'
import { useStore } from '../state/store.ts'
import { IconClose } from './icons.tsx'

/** Kranz, der das Selfie einrahmt – so wie später am Haus oder am Tor. */
function WreathFrame() {
  const leaves = Array.from({ length: 28 }, (_, index) => (index / 28) * Math.PI * 2)
  return (
    <svg className="selfie__wreath" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="88" fill="none" stroke="#2f6650" strokeWidth="19" />
      {leaves.map((angle, index) => (
        <circle
          key={angle}
          cx={100 + Math.cos(angle) * (index % 2 === 0 ? 93 : 83)}
          cy={100 + Math.sin(angle) * (index % 2 === 0 ? 93 : 83)}
          r="8.5"
          fill={index % 2 === 0 ? '#3a755a' : '#28594a'}
        />
      ))}
      {leaves
        .filter((_, index) => index % 4 === 1)
        .map((angle) => (
          <circle
            key={angle}
            cx={100 + Math.cos(angle) * 88}
            cy={100 + Math.sin(angle) * 88}
            r="3.4"
            fill="#ffe2a0"
          />
        ))}
      <path d="M100 176 78 164v26l22-14 22 14v-26l-22 12Z" fill="#c4463c" />
      <circle cx="100" cy="177" r="6.5" fill="#a13a30" />
    </svg>
  )
}

/** Vor dem Eintreten: ein Selfie, das anschließend im Kranz am Haus (oder am Tor) hängt. */
export function SelfieCapture({ day, enterAfter }: { day: number; enterAfter: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'live' | 'unavailable'>('starting')
  const [photo, setPhoto] = useState<string | null>(null)
  const existing = useStore((state) => state.selfies[day])

  useEffect(() => {
    const video = videoRef.current
    let cancelled = false
    let stream: MediaStream | null = null
    const stopCamera = () => {
      for (const track of stream?.getTracks() ?? []) track.stop()
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Keine Kamera verfügbar')
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      if (cancelled || !video) {
        // Der Dialog wurde geschlossen, während die Kamera noch startete.
        stopCamera()
        return
      }
      video.srcObject = stream
      await video.play()
      if (!cancelled) setCamera('live')
    }
    start().catch(() => {
      if (!cancelled) setCamera('unavailable')
    })

    return () => {
      cancelled = true
      stopCamera()
      if (video) video.srcObject = null
    }
  }, [])

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    try {
      setPhoto(captureSelfie(video))
    } catch {
      setCamera('unavailable')
    }
  }

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPhoto(await selfieFromFile(file))
    } catch {
      // Datei war kein lesbares Bild – dann bleibt es bei der Auswahl.
    }
  }

  const skipLabel = enterAfter ? 'Ohne Selfie weiter' : 'Abbrechen'

  return (
    <div className="camera camera--selfie" role="dialog" aria-modal="true" aria-label="Selfie aufnehmen">
      <header className="camera__header">
        <h2>{photo ? 'Gut getroffen?' : 'Bitte lächeln!'}</h2>
        <p>
          Dein Selfie bekommt einen Ehrenplatz im Kranz {isGate(day) ? 'am Tor' : `von Haus ${day}`}.
        </p>
        <button type="button" className="camera__close" aria-label={skipLabel} onClick={() => finishSelfie(null)}>
          <IconClose />
        </button>
      </header>

      <div className="selfie">
        <div className="selfie__portrait">
          <video ref={videoRef} className="selfie__video" playsInline muted />
          {photo ? (
            <img className="selfie__photo" src={photo} alt="Dein Selfie" />
          ) : (
            camera !== 'live' && (
              <div className="selfie__placeholder">
                {camera === 'starting' ? (
                  <span className="spinner" aria-label="Kamera startet" />
                ) : existing ? (
                  <img src={existing} alt="Dein bisheriges Selfie" />
                ) : (
                  <p>Die Kamera lässt sich nicht öffnen.</p>
                )}
              </div>
            )
          )}
        </div>
        <WreathFrame />
      </div>

      <footer className="camera__footer">
        {photo ? (
          <div className="camera__choices">
            <button type="button" className="button" onClick={() => finishSelfie(photo)}>
              Passt!
            </button>
            <button type="button" className="button button--ghost" onClick={() => setPhoto(null)}>
              Nochmal
            </button>
          </div>
        ) : camera === 'unavailable' ? (
          <div className="camera__choices">
            <label className="button">
              Foto aufnehmen
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="visually-hidden"
                onChange={(event) => void pickPhoto(event)}
              />
            </label>
          </div>
        ) : (
          <button
            type="button"
            className="shutter"
            aria-label="Foto aufnehmen"
            disabled={camera !== 'live'}
            onClick={takePhoto}
          />
        )}
        <button type="button" className="link link--light" onClick={() => finishSelfie(null)}>
          {skipLabel}
        </button>
      </footer>
    </div>
  )
}
