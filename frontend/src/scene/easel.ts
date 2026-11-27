import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col, SNOW, WOOD, WOOD_DARK } from './palette.ts'

/** Bildfläche auf der Staffelei (Meter), im Seitenverhältnis des Ausmalbilds 4:3. */
const PICTURE = { width: 0.8, height: 0.6, y: 1.12 }

/** Holzgestell der Staffelei. Ursprung am Boden, Vorderseite zeigt nach +z. */
export function buildEaselFrame(): THREE.BufferGeometry {
  const b = new Builder()
  const wood = col(WOOD)
  const dark = col(WOOD_DARK)
  const snow = col(SNOW)
  // Zwei Vorderbeine, oben zusammenlaufend, und ein Stützbein nach hinten
  b.box(-0.3, 0.86, 0.02, 0.05, 1.78, 0.05, wood, { z: -0.16 })
  b.box(0.3, 0.86, 0.02, 0.05, 1.78, 0.05, wood, { z: 0.16 })
  b.box(0, 0.8, -0.3, 0.05, 1.7, 0.05, dark, { x: 0.36 })
  // Ablage mit etwas Schnee, Querstrebe und Klemme oben
  b.box(0, PICTURE.y - PICTURE.height / 2 - 0.04, 0.06, 0.92, 0.05, 0.12, wood)
  b.box(0, PICTURE.y - PICTURE.height / 2 - 0.005, 0.07, 0.86, 0.025, 0.09, snow)
  b.box(0, 0.42, 0.01, 0.6, 0.04, 0.04, dark)
  b.box(0, PICTURE.y + PICTURE.height / 2 + 0.03, 0.06, 0.18, 0.07, 0.06, wood)
  // Leinwand: heller Keilrahmen hinter dem Bild
  b.box(0, PICTURE.y, 0.04, PICTURE.width + 0.06, PICTURE.height + 0.06, 0.035, col('#f4ecdc'))
  return b.batch.build('lit')
}

/** Das Bild selbst: eine Fläche, deren Textur später das ausgemalte Rentier zeigt. */
export function createPicture(): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
  const geometry = new THREE.PlaneGeometry(PICTURE.width, PICTURE.height)
  // Etwas gedämpft, damit das Bild in der Nacht nicht wie ein Bildschirm leuchtet.
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.86, 0.9), fog: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, PICTURE.y, 0.062)
  return { mesh, material }
}

/** SVG-Text → Textur. Über eine Leinwand, damit auch Safari das SVG zuverlässig hochlädt. */
export function loadSvgTexture(svg: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      resolve(texture)
    }
    image.onerror = () => reject(new Error('Bild für die Staffelei konnte nicht geladen werden'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
