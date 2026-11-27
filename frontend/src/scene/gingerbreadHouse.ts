import * as THREE from 'three'
import { Builder } from './batch.ts'
import { col } from './palette.ts'

/**
 * Das selbst gebaute Lebkuchenhaus aus Haus 7 als kleines 3D-Modell. Gebaut wird in
 * den Einheiten des Spielfelds (400 × 360, y nach unten), damit jede Süßigkeit genau
 * dort sitzt, wo sie im Spiel hingesetzt wurde. Ursprung: Mitte der Bodenplatte am Boden.
 */

export type GingerCandyType = 'gumdropRed' | 'gumdropGreen' | 'smartie' | 'cane' | 'star' | 'heart'

export interface GingerbreadDesign {
  icing: boolean
  candies: { type: GingerCandyType; x: number; y: number; variant: number; rotate?: number }[]
}

/** Meter pro Spielfeld-Einheit: Die Bodenplatte wird gut einen Meter breit. */
export const GINGER_SCALE = 1.1 / 248

const SMARTIES = ['#d33b33', '#3f6fb5', '#f5d04a', '#4f9a5a', '#f08bb0', '#f2a33a']
const FRONT = { wall: 76, roof: 88, chimney: -4, base: 101 }
/**
 * Herzform wie im Spiel (SVG-Pfad „M0 9C-14 0 -9 -11 0 -5…“), hier mit y nach oben.
 * Builder.polygon kann nur konvexe Flächen – deshalb zwei Hälften, links und rechts der Mitte.
 */
function heartHalves(scale: number): [number, number][][] {
  const left: [number, number][] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const u = 1 - t
    // Kubische Bézierkurve von der Spitze (0, 9) über (-14, 0), (-9, -11) zur Kerbe (0, -5)
    const x = 3 * u * u * t * -14 + 3 * u * t * t * -9
    const y = u ** 3 * 9 + 3 * u * t * t * -11 + t ** 3 * -5
    left.push([x * scale, -y * scale])
  }
  // Gegen den Uhrzeigersinn: links von der Kerbe hinunter zur Spitze, rechts gespiegelt hinauf.
  const leftHalf = [...left].reverse()
  const rightHalf = left.map(([x, y]) => [-x, y] as [number, number])
  return [leftHalf, rightHalf]
}
const HEART = heartHalves(1)
const HEART_OUTLINE = heartHalves(1.28)

/** Süßigkeiten sind im Spiel etwas größer gezeichnet – hier genauso. */
const CANDY_SCALE = 1.35

/** Spielfeld (x, y) → Modell (X, Y): Mitte der Platte, y nach oben. */
const X = (x: number) => x - 200
const Y = (y: number) => 280 - y

function inPolygon(x: number, y: number, points: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Die beiden Dachplatten im Spielfeld (mit etwas Rand, damit Süßigkeiten an der Kante mitzählen). */
const ROOF_SLABS = [
  [[74, 186], [200, 84], [206, 116], [94, 206]],
  [[326, 186], [200, 84], [194, 116], [306, 206]],
] as const

/** Auf welcher Fläche sitzt eine Süßigkeit – und wie weit vorn ist die? */
function frontAt(x: number, y: number): number {
  if (y >= 262) return FRONT.base
  if (ROOF_SLABS.some((slab) => inPolygon(x, y, slab))) return FRONT.roof
  if (x >= 242 && x <= 274 && y >= 98 && y <= 150) return FRONT.chimney
  if (y < 172 || x < 108 || x > 292) return FRONT.roof
  return FRONT.wall
}

export function buildGingerbreadHouse(design: GingerbreadDesign): THREE.BufferGeometry {
  const b = new Builder()
  const dough = col('#c27a3e')
  const icing = col('#fffaf2')
  const windowLight = col('#ffd37a')

  const dot = (x: number, y: number, z: number, r = 2.4) => b.sphere(x, y, z, r, r, r * 0.6, icing)

  // Platte mit Zuckerguss-Punkten, Hauskörper, Giebeldreiecke – alles aus demselben Teig wie im Spiel
  b.box(0, Y(271), 0, 248, 18, 200, dough)
  for (let i = 0; i < 16; i++) dot(X(86 + i * 15.2), Y(271), FRONT.base)
  b.box(0, Y(217), 0, 180, 90, 150, dough)
  for (const z of [75, -75]) {
    b.polygon([[X(110), Y(172)], [X(290), Y(172)], [X(200), Y(102)]], z, dough, { flip: z < 0 })
  }

  // Dachplatten entlang der Schräge, etwas tiefer als das Haus, mit Punktreihe wie im Spiel
  const slope = Math.atan2(96, 120)
  const length = Math.hypot(120, 96) + 10
  const normal = { x: Math.sin(slope), y: Math.cos(slope) }
  for (const side of [-1, 1]) {
    const cx = side * 53
    const cy = 133
    b.box(cx, cy, 0, length, 22, 176, dough, { z: -side * slope })
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.6) / 7.4
      dot(side * 112 * t, 178 - 88 * t, FRONT.roof)
    }
    // Dicker Zuckerguss liegt oben auf der Dachkante (entlang der Normalen nach außen versetzt)
    if (design.icing) b.box(cx + side * normal.x * 13, cy + normal.y * 13, 0, length + 6, 9, 182, icing, { z: -side * slope })
  }

  // Schornstein hinter dem rechten Dach, mit Ziegelfugen aus Zuckerguss
  b.box(X(258), Y(125), -20, 28, 50, 28, dough)
  for (const y of [116, 132]) b.box(X(258), Y(y), -5.5, 28, 2, 1.5, icing)
  if (design.icing) b.box(X(258), Y(100), -20, 34, 7, 34, icing)

  // Tür: dunkler Bogen mit Zuckergussrand, Herz und Knauf
  const door = col('#8a4f22')
  b.box(0, Y(245) - 3, FRONT.wall, 28, 30, 3, door)
  b.cylinder(0, Y(228), FRONT.wall, 14, 14, 3, 18, door, { x: Math.PI / 2 })
  for (const side of [-1, 1]) b.box(side * 14, Y(245), FRONT.wall + 1, 2.4, 34, 2, icing)
  b.sphere(0, Y(239), FRONT.wall + 2, 4, 3.6, 1.5, col('#d33b33'))
  b.sphere(8, Y(248), FRONT.wall + 2, 2.6, 2.6, 1.5, col('#f5d04a'))

  // Fenster: hell, mit Zuckergussrahmen und -kreuz, darunter Schnörkel
  for (const x of [142, 258]) {
    b.box(X(x), Y(204), FRONT.wall, 36, 32, 2, windowLight)
    b.box(X(x), Y(204), FRONT.wall + 1.5, 2.4, 32, 2, icing)
    b.box(X(x), Y(204), FRONT.wall + 1.5, 36, 2.4, 2, icing)
    for (const dy of [-16, 16]) b.box(X(x), Y(204) + dy, FRONT.wall + 1.5, 38, 2.4, 2, icing)
    for (const dx of [-18, 18]) b.box(X(x) + dx, Y(204), FRONT.wall + 1.5, 2.4, 34, 2, icing)
    for (let i = 0; i < 5; i++) dot(X(x) - 14 + i * 7, Y(244) + (i % 2 ? 1.5 : -1.5), FRONT.wall + 1, 1.6)
  }

  if (design.icing) {
    // Tropfen unter der Dachkante und Schnee auf der Platte
    for (let t = 0.06; t < 1; t += 0.11) {
      for (const side of [-1, 1]) {
        const x = side * 120 * (1 - t)
        const y = 94 + 96 * t
        const drop = 8 + (Math.round(t * 10) % 3) * 4
        b.sphere(x, y - drop / 2, FRONT.roof + 1, 4, drop / 2 + 2, 2.5, icing)
      }
    }
    b.box(0, Y(262) + 2, 0, 250, 4, 202, icing)
  }

  // Süßigkeiten – vorn auf der Fläche, auf der sie im Spiel saßen, gleich groß und gleich gedreht
  const red = col('#d33b33')
  const brown = col('#a9622e')
  for (const candy of design.candies) {
    const z = frontAt(candy.x, candy.y) + 4
    // Im Spiel dreht SVG im Uhrzeigersinn (y nach unten) – hier ist y oben, also umgekehrt.
    const place = new THREE.Matrix4()
      .makeTranslation(X(candy.x), Y(candy.y), z)
      .multiply(new THREE.Matrix4().makeRotationZ((-(candy.rotate ?? 0) * Math.PI) / 180))
      .multiply(new THREE.Matrix4().makeScale(CANDY_SCALE, CANDY_SCALE, CANDY_SCALE))
    b.within(place, () => {
      switch (candy.type) {
        case 'gumdropRed':
        case 'gumdropGreen':
          b.sphere(0, 1, 0, 9, 9, 6, col(candy.type === 'gumdropRed' ? '#d9363e' : '#3e9a55'))
          for (const [x, y] of [[-4, 2], [3, 5], [4, -2], [-1, -3]]) b.sphere(x, y, 5, 1, 1, 0.6, icing)
          break
        case 'smartie':
          b.sphere(0, 0, 0, 7.5, 6.5, 3.5, col(SMARTIES[candy.variant % SMARTIES.length]))
          break
        case 'cane': {
          // Haken oben links, Schaft nach unten – rot-weiß gestreift
          for (let i = 0; i < 5; i++) b.sphere(3, -12 + i * 4, 0, 2.6, 2.6, 2.6, i % 2 ? icing : red)
          for (let i = 0; i <= 4; i++) {
            const a = (i / 4) * Math.PI
            b.sphere(-2 + Math.cos(a) * 5, 5 + Math.sin(a) * 5, 0, 2.6, 2.6, 2.6, i % 2 ? red : icing)
          }
          break
        }
        case 'star':
          b.star(0, 0, 0, 10, 4.5, 5, col('#f5d04a'))
          break
        case 'heart':
          // Flaches Lebkuchenherz wie im Spiel, mit weißem Zuckergussrand dahinter
          for (const half of HEART_OUTLINE) b.polygon(half, -0.5, icing)
          for (const half of HEART) b.polygon(half, 1, brown)
          break
      }
    })
  }

  return b.batch.build('lit')
}
