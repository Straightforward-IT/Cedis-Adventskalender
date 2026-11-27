import * as THREE from 'three'
import { TOTAL_DAYS } from '../lib/calendar.ts'

const DISPLAY_FONT = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif'

/** Eine auf ein Canvas gemalte Textur, die sich neu zeichnen lässt (z. B. wenn die Schrift geladen ist). */
export interface PaintedTexture {
  texture: THREE.CanvasTexture
  repaint(): void
}

function paintedTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): PaintedTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const repaint = () => {
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, width, height)
      draw(context)
    }
    texture.needsUpdate = true
  }
  repaint()
  return { texture, repaint }
}

const ATLAS_SIZE = 1024
const ATLAS_GRID = 5
const CELL = ATLAS_SIZE / ATLAS_GRID

function drawNumberPlates(context: CanvasRenderingContext2D): void {
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const cx = ((day - 1) % ATLAS_GRID) * CELL + CELL / 2
    const cy = Math.floor((day - 1) / ATLAS_GRID) * CELL + CELL / 2
    const radius = CELL / 2 - 4

    context.fillStyle = '#fff4dd'
    context.beginPath()
    context.arc(cx, cy, radius, 0, Math.PI * 2)
    context.fill()

    context.strokeStyle = '#b4403a'
    context.lineWidth = 11
    context.beginPath()
    context.arc(cx, cy, radius - 13, 0, Math.PI * 2)
    context.stroke()

    context.fillStyle = '#4b2a26'
    context.font = `700 ${day < 10 ? 122 : 106}px ${DISPLAY_FONT}`
    context.fillText(String(day), cx, cy + 7)
  }
}

export interface NumberAtlas extends PaintedTexture {
  /** Ausschnitt der Textur für eine Hausnummer: [u0, v0, u1, v1]. */
  cell(day: number): [number, number, number, number]
}

/** Alle 24 Hausnummern-Schilder in einer Textur. */
export function createNumberAtlas(): NumberAtlas {
  const painted = paintedTexture(ATLAS_SIZE, ATLAS_SIZE, drawNumberPlates)
  painted.texture.anisotropy = 4
  return {
    ...painted,
    cell(day) {
      const column = (day - 1) % ATLAS_GRID
      const row = Math.floor((day - 1) / ATLAS_GRID)
      return [
        column / ATLAS_GRID,
        1 - (row + 1) / ATLAS_GRID,
        (column + 1) / ATLAS_GRID,
        1 - row / ATLAS_GRID,
      ]
    },
  }
}

/** Straßenschild am Anfang der Straße. */
export function createSignTexture(text: string): PaintedTexture {
  const painted = paintedTexture(1024, 256, (context) => {
    context.fillStyle = '#2f6650'
    context.beginPath()
    context.roundRect(8, 8, 1008, 240, 44)
    context.fill()
    context.strokeStyle = '#fff4dd'
    context.lineWidth = 10
    context.beginPath()
    context.roundRect(26, 26, 972, 204, 30)
    context.stroke()
    context.fillStyle = '#fff4dd'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `600 112px ${DISPLAY_FONT}`
    context.fillText(text, 512, 136, 900)
  })
  painted.texture.anisotropy = 4
  return painted
}

/**
 * Mond in seiner Phase (0 = Neumond, 0,5 = Vollmond). Zunehmend leuchtet – wie bei uns
 * auf der Nordhalbkugel – die rechte Seite, abnehmend die linke. Der dunkle Teil schimmert
 * ganz schwach (Erdschein), damit man die Scheibe noch ahnt.
 */
export function createMoonTexture(phase = 0.5, snowman = false): THREE.CanvasTexture {
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2
  // Gezeichnet wird immer in 256er-Koordinaten. Steht der Mondstaub-Mann drauf, kann man
  // nah heranzoomen – dann wird dieselbe Zeichnung achtmal so fein gemalt, damit sie scharf bleibt.
  const size = snowman ? 2048 : 256
  return paintedTexture(size, size, (context) => {
    context.scale(size / 256, size / 256)
    const cx = 128
    const cy = 128
    const r = 46

    // Der Lichthof wächst mit dem beleuchteten Anteil.
    const glow = 0.15 + 0.85 * lit
    const halo = context.createRadialGradient(cx, cy, 40, cx, cy, 128)
    halo.addColorStop(0, `rgba(255, 244, 214, ${0.55 * glow})`)
    halo.addColorStop(0.4, `rgba(255, 236, 200, ${0.16 * glow})`)
    halo.addColorStop(1, 'rgba(255, 236, 200, 0)')
    context.fillStyle = halo
    context.fillRect(0, 0, 256, 256)

    // Erdschein auf der ganzen Scheibe
    context.fillStyle = 'rgba(190, 200, 240, 0.16)'
    context.beginPath()
    context.arc(cx, cy, r, 0, Math.PI * 2)
    context.fill()

    // Beleuchteter Teil: Rand auf der hellen Seite, zurück über die Schattengrenze (halbe Ellipse).
    const waxing = phase < 0.5
    const crescent = lit < 0.5
    const terminator = r * Math.abs(Math.cos(2 * Math.PI * phase))
    const top = -Math.PI / 2
    const bottom = Math.PI / 2
    context.beginPath()
    context.arc(cx, cy, r, top, bottom, !waxing)
    // Sichel: Grenze wölbt sich zur hellen Seite; dreiviertel voll: zur dunklen.
    const viaRight = waxing === crescent
    context.ellipse(cx, cy, Math.max(terminator, 0.01), r, 0, bottom, viaRight ? top : Math.PI * 1.5, viaRight)
    context.closePath()
    context.save()
    context.clip()

    context.fillStyle = '#fff8e4'
    context.fillRect(cx - r, cy - r, 2 * r, 2 * r)
    context.fillStyle = 'rgba(226, 208, 190, 0.5)'
    for (const [x, y, size] of [
      [112, 114, 9],
      [142, 138, 12],
      [136, 106, 6],
      [112, 146, 5],
    ]) {
      context.beginPath()
      context.arc(x, y, size, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
    if (snowman) {
      // Er steht nahe am oberen linken Rand und zeigt – wie auf einer echten Kugel – vom
      // Mondmittelpunkt weg nach außen; so wirkt er, als stünde er auf der Oberfläche.
      const angle = -0.55
      context.save()
      context.translate(cx + Math.sin(angle) * r * 0.62, cy - Math.cos(angle) * r * 0.62)
      context.rotate(angle)
      paintMoonSnowman(context, 0, 0)
      context.restore()
    }
  }).texture
}

/**
 * Der Mondstaub-Mann aus Haus 5: steht auf der Mondscheibe, mit Astronautenhelm.
 * `(x, y)` ist der Punkt, auf dem er steht.
 */
function paintMoonSnowman(context: CanvasRenderingContext2D, x: number, y: number): void {
  const balls = [
    [y - 6, 7.5],
    [y - 16.5, 5.5],
    [y - 24.5, 4],
  ] as const
  context.save()
  // Etwas größer gezeichnet, damit man ihn am Himmel auch erkennt.
  context.translate(x, y)
  context.scale(1.5, 1.5)
  context.translate(-x, -y)
  context.lineCap = 'round'
  // Stockarme
  context.strokeStyle = '#6b4129'
  context.lineWidth = 1.4
  context.beginPath()
  context.moveTo(x - 5, balls[1][0]); context.lineTo(x - 11, balls[1][0] - 5)
  context.moveTo(x + 5, balls[1][0]); context.lineTo(x + 11, balls[1][0] - 5)
  context.stroke()
  for (const [by, br] of balls) {
    context.fillStyle = '#f1f2f6'
    context.strokeStyle = 'rgba(80, 86, 110, 0.55)'
    context.lineWidth = 1
    context.beginPath()
    context.arc(x, by, br, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  // Münzaugen und -knöpfe
  context.fillStyle = '#e8b04a'
  for (const [dx, dy] of [[-1.5, -25.5], [1.5, -25.5], [0, -17.5], [0, -15]]) {
    context.beginPath()
    context.arc(x + dx, y + dy, 0.9, 0, Math.PI * 2)
    context.fill()
  }
  // Helm: Glaskugel mit Kragen und Antenne
  const [hy, hr] = balls[2]
  context.fillStyle = 'rgba(190, 225, 255, 0.35)'
  context.strokeStyle = 'rgba(235, 245, 255, 0.95)'
  context.lineWidth = 1.2
  context.beginPath()
  context.arc(x, hy, hr * 1.45, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.fillStyle = '#ffffff'
  context.fillRect(x - hr * 1.2, hy + hr * 1.05, hr * 2.4, 1.6)
  context.strokeStyle = '#ffffff'
  context.lineWidth = 0.8
  context.beginPath()
  context.moveTo(x + 2.5, hy - hr * 1.4); context.lineTo(x + 3.5, hy - hr * 1.4 - 3.5)
  context.stroke()
  context.fillStyle = '#ff4a3d'
  context.beginPath()
  context.arc(x + 3.5, hy - hr * 1.4 - 4, 1, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

/** Funkelnder Stern mit vier Strahlen. */
export function createSparkleTexture(): THREE.CanvasTexture {
  return paintedTexture(256, 256, (context) => {
    const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128)
    glow.addColorStop(0, 'rgba(255, 252, 235, 1)')
    glow.addColorStop(0.12, 'rgba(255, 238, 180, 0.75)')
    glow.addColorStop(0.45, 'rgba(255, 214, 130, 0.16)')
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, 256, 256)

    context.translate(128, 128)
    context.fillStyle = 'rgba(255, 250, 228, 0.92)'
    for (let ray = 0; ray < 4; ray++) {
      context.rotate(Math.PI / 2)
      context.beginPath()
      context.moveTo(0, -8)
      context.quadraticCurveTo(40, -3, 124, 0)
      context.quadraticCurveTo(40, 3, 0, 8)
      context.fill()
    }
  }).texture
}

/** Das gleißende Licht hinter einer sich öffnenden Haustür. */
export function createDoorLightTexture(): THREE.CanvasTexture {
  return paintedTexture(128, 256, (context) => {
    const gradient = context.createRadialGradient(64, 150, 6, 64, 140, 150)
    gradient.addColorStop(0, '#fffdf2')
    gradient.addColorStop(0.45, '#fff0bf')
    gradient.addColorStop(1, '#ffc56b')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 256)
  }).texture
}

/** Lädt ein Selfie (Data-URL) als Textur. */
export function loadPhotoTexture(dataUrl: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const texture = new THREE.Texture(image)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      resolve(texture)
    }
    image.onerror = () => reject(new Error('Selfie konnte nicht geladen werden'))
    image.src = dataUrl
  })
}
