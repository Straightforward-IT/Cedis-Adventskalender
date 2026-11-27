/**
 * Puste-Messer: macht aus der Lautstärke am Mikrofon eine Pustestärke von 0 bis 1.
 * Das Grundrauschen im Raum wird laufend mitgelernt und abgezogen, damit ein
 * brummender Kühlschrank nicht mitpustet. Es wird nichts aufgenommen oder gesendet.
 */

export interface BlowMeter {
  /** Geschätztes Grundrauschen (RMS). */
  floor: number
  /** Geglättete Pustestärke 0–1. */
  level: number
}

export function createMeter(): BlowMeter {
  return { floor: 0.01, level: 0 }
}

export function rms(samples: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return samples.length ? Math.sqrt(sum / samples.length) : 0
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Neuen Messwert einrechnen; liefert die aktuelle Pustestärke. */
export function updateMeter(meter: BlowMeter, level: number, dt: number): number {
  // Grundrauschen: fällt schnell, steigt nur langsam – langes Pusten wird so nicht zum „Rauschen“.
  const follow = level < meter.floor ? Math.min(1, dt * 4) : Math.min(1, dt * 0.05)
  meter.floor = clamp(meter.floor + (level - meter.floor) * follow, 0.001, 0.06)

  const target = clamp((level - meter.floor * 1.8 - 0.012) / 0.14, 0, 1)
  const speed = target > meter.level ? 14 : 5
  meter.level += (target - meter.level) * Math.min(1, dt * speed)
  return meter.level
}

export interface Microphone {
  analyser: AnalyserNode
  close(): void
}

/** Muss aus einem Klick heraus aufgerufen werden – sonst bleibt der AudioContext stumm. */
export async function openMicrophone(): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kein Mikrofon verfügbar')
  // Ohne Rauschunterdrückung: Pusten ist für sie genau das Rauschen, das weg soll.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  })
  const context = new AudioContext()
  await context.resume()
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  context.createMediaStreamSource(stream).connect(analyser)
  return {
    analyser,
    close() {
      for (const track of stream.getTracks()) track.stop()
      void context.close()
    },
  }
}
