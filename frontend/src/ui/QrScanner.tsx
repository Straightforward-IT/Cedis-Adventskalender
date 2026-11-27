import QrScannerLib from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { placeName } from '../lib/places.ts'
import { closeModal, submitScan, submitTypedKey } from '../state/flow.ts'
import { IconClose } from './icons.tsx'

const NOT_A_KEY = 'Das ist kein Türchen-Code. Such den QR-Code auf der Box.'

/**
 * Der QR-Code als Schlüssel: Kamera auf die Box halten. Falls die Kamera nicht
 * will, lässt sich der Code fotografieren oder abtippen (er steht unter dem QR-Code).
 */
export default function QrScanner({ day }: { day: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'scanning' | 'unavailable'>('starting')
  const [hint, setHint] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let done = false
    const scanner = new QrScannerLib(
      video,
      (result) => {
        if (done) return
        if (submitScan(result.data, day)) {
          done = true
          scanner.stop()
        } else {
          setHint(NOT_A_KEY)
        }
      },
      { preferredCamera: 'environment', maxScansPerSecond: 8, returnDetailedScanResult: true },
    )
    scanner
      .start()
      .then(() => {
        if (!done) setCamera('scanning')
      })
      .catch(() => {
        if (!done) setCamera('unavailable')
      })
    return () => {
      done = true
      scanner.stop()
      scanner.destroy()
    }
  }, [day])

  const scanPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const result = await QrScannerLib.scanImage(file, { returnDetailedScanResult: true })
      if (!submitScan(result.data, day)) setHint(NOT_A_KEY)
    } catch {
      setHint('Auf dem Foto war kein QR-Code zu erkennen. Versuch es noch einmal aus der Nähe.')
    }
  }

  const submitCode = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) submitTypedKey(day, code)
  }

  const title = `Schlüssel für ${placeName(day)}`

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label={title}>
      <video ref={videoRef} className="camera__video" playsInline muted />
      <div className="camera__shade" aria-hidden="true" />

      <header className="camera__header">
        <h2>{title}</h2>
        <p>
          {camera === 'unavailable'
            ? 'Die Kamera lässt sich nicht öffnen. Fotografiere den QR-Code oder tippe den Code ein, der darunter steht.'
            : `Halte den QR-Code von Box ${day} in den Rahmen.`}
        </p>
        <button type="button" className="camera__close" aria-label="Abbrechen" onClick={closeModal}>
          <IconClose />
        </button>
      </header>

      <div className="camera__frame" data-state={camera} aria-hidden="true" />

      <footer className="camera__footer">
        {hint && (
          <p className="camera__hint" role="status">
            {hint}
          </p>
        )}
        {typing ? (
          <form className="camera__form" onSubmit={submitCode}>
            <label htmlFor="door-code">Code unter dem QR-Code</label>
            <input
              id="door-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCDE-FGHJK"
              maxLength={16}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <button type="submit" className="button" disabled={!code.trim()}>
              Aufschließen
            </button>
          </form>
        ) : (
          <div className="camera__choices">
            {camera === 'unavailable' && (
              <label className="button">
                QR-Code fotografieren
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="visually-hidden"
                  onChange={(event) => void scanPhoto(event)}
                />
              </label>
            )}
            <button type="button" className="button button--ghost" onClick={() => setTyping(true)}>
              Code eintippen
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
