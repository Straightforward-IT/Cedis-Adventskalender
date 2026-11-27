const SELFIE_SIZE = 512

type Drawable = HTMLVideoElement | HTMLImageElement

function squareDataUrl(source: Drawable, width: number, height: number, mirror: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = SELFIE_SIZE
  canvas.height = SELFIE_SIZE
  const context = canvas.getContext('2d')
  if (!context || width === 0 || height === 0) throw new Error('Bild konnte nicht verarbeitet werden')

  const side = Math.min(width, height)
  if (mirror) {
    context.translate(SELFIE_SIZE, 0)
    context.scale(-1, 1)
  }
  context.drawImage(
    source,
    (width - side) / 2,
    (height - side) / 2,
    side,
    side,
    0,
    0,
    SELFIE_SIZE,
    SELFIE_SIZE,
  )
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Quadratischer Ausschnitt aus dem laufenden Kamerabild, gespiegelt wie in der Vorschau. */
export function captureSelfie(video: HTMLVideoElement): string {
  return squareDataUrl(video, video.videoWidth, video.videoHeight, true)
}

/** Quadratischer Ausschnitt aus einer Fotodatei – Ausweg, wenn die Kamera im Browser nicht geht. */
export async function selfieFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return squareDataUrl(image, image.naturalWidth, image.naturalHeight, false)
  } finally {
    URL.revokeObjectURL(url)
  }
}
