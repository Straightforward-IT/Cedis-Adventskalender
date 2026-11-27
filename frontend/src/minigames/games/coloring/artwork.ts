/**
 * Das Ausmalbild für Haus 4: ein vergnügtes Rentier mit Zipfelmütze, an dessen Geweih
 * eine Christbaumkugel baumelt. Jede Fläche hat eine feste Form; welche Farbe sie
 * bekommt, entscheidet allein, wer malt.
 */

export const VIEW = { width: 400, height: 300 }

/** Die feste Farbpalette – Reihenfolge bleibt stabil, gespeichert wird der Index. */
export const PALETTE = [
  { hex: '#ffffff', name: 'Weiß' },
  { hex: '#f6e7c8', name: 'Creme' },
  { hex: '#d9a86c', name: 'Hellbraun' },
  { hex: '#8a5a36', name: 'Braun' },
  { hex: '#d33b33', name: 'Rot' },
  { hex: '#f08bb0', name: 'Rosa' },
  { hex: '#f9c9d9', name: 'Zartrosa' },
  { hex: '#f2a33a', name: 'Orange' },
  { hex: '#f5d04a', name: 'Gelb' },
  { hex: '#4f9a5a', name: 'Grün' },
  { hex: '#9fd8c4', name: 'Mint' },
  { hex: '#a9d4f0', name: 'Hellblau' },
  { hex: '#3f6fb5', name: 'Blau' },
  { hex: '#22264f', name: 'Nachtblau' },
  { hex: '#8a6fbf', name: 'Lila' },
  { hex: '#8d8f99', name: 'Grau' },
] as const

export interface RegionPart {
  d: string
  /** Optionale SVG-Transformation, etwa zum Spiegeln der rechten Hälfte. */
  transform?: string
}

export interface Region {
  id: string
  label: string
  parts: RegionPart[]
  /** Nur innerhalb dieser anderen Fläche sichtbar (Streifen auf Mütze und Kugel). */
  clipTo?: string
}

const MIRROR = 'matrix(-1 0 0 1 300 0)'

function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.45 : r
    return `${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`
  })
  return `M${points.join(' L')}Z`
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`
const leg = (x: number) => `M${x} 214h22v40q0 4-4 4h-14q-4 0-4-4Z`
const hoof = (x: number) => `M${x - 2} 250h26v7q0 6-6 6h-14q-6 0-6-6Z`

const ANTLER =
  'M118 122C108 112 100 106 92 98C80 100 66 98 60 88C56 80 62 72 70 77C64 64 70 54 79 57C87 60 86 72 86 80C86 66 90 50 99 53C108 56 106 72 101 84C106 75 114 66 121 70C128 76 119 90 110 98C116 104 122 110 128 116Z'
const EAR = 'M106 146C94 131 74 128 62 139C72 153 92 159 108 156Z'
const EAR_INNER = 'M100 147C90 138 78 136 71 140C79 149 91 152 101 151Z'

/** Von hinten nach vorn – spätere Flächen liegen über früheren. */
export const REGIONS: readonly Region[] = [
  { id: 'sky', label: 'Himmel', parts: [{ d: 'M0 0H400V300H0Z' }] },
  { id: 'stars', label: 'Sterne', parts: [{ d: star(40, 40, 11) }, { d: star(338, 34, 13) }, { d: star(372, 104, 8) }, { d: star(268, 48, 7) }] },
  { id: 'ground', label: 'Schnee', parts: [{ d: 'M0 260C40 252 80 268 120 259S200 250 240 260S330 270 400 256V300H0Z' }] },
  { id: 'antlers', label: 'Geweih', parts: [{ d: ANTLER }, { d: ANTLER, transform: MIRROR }] },
  { id: 'tail', label: 'Schwänzchen', parts: [{ d: 'M338 182C350 170 350 156 360 148C363 160 369 159 372 150C377 166 367 186 346 194Z' }] },
  { id: 'legs', label: 'Beine', parts: [196, 226, 282, 312].map((x) => ({ d: leg(x) })) },
  { id: 'hooves', label: 'Hufe', parts: [196, 226, 282, 312].map((x) => ({ d: hoof(x) })) },
  { id: 'body', label: 'Körper', parts: [{ d: 'M178 196C174 160 220 146 262 150C310 154 344 164 346 196C348 226 310 236 262 236C214 236 182 230 178 196Z' }] },
  { id: 'spots', label: 'Tupfen', parts: [{ d: circle(216, 214, 8) }, { d: circle(330, 196, 9) }, { d: circle(320, 222, 6) }, { d: circle(268, 225, 7) }] },
  { id: 'blanket', label: 'Decke', parts: [{ d: 'M222 154C240 145 290 145 310 157C316 175 312 193 301 204C280 210 246 210 228 204C218 192 216 170 222 154Z' }] },
  { id: 'blanketBorder', label: 'Deckensaum', parts: [{ d: 'M228 204C246 210 280 210 301 204L305 215C283 223 244 223 224 215Z' }] },
  { id: 'ears', label: 'Ohren', parts: [{ d: EAR }, { d: EAR, transform: MIRROR }] },
  { id: 'earsInner', label: 'Ohren innen', parts: [{ d: EAR_INNER }, { d: EAR_INNER, transform: MIRROR }] },
  { id: 'head', label: 'Kopf', parts: [{ d: ellipse(150, 152, 50, 44) }] },
  { id: 'muzzle', label: 'Schnauze', parts: [{ d: ellipse(150, 178, 32, 19) }] },
  { id: 'nose', label: 'Nase', parts: [{ d: circle(150, 160, 16) }] },
  { id: 'hat', label: 'Mütze', parts: [{ d: 'M104 118C104 82 130 62 162 62C196 62 222 82 236 112C240 122 238 132 232 138C226 124 218 110 206 104C204 110 202 114 200 118Z' }] },
  { id: 'hatStripes', label: 'Mützenstreifen', clipTo: 'hat', parts: [{ d: 'M96 96C140 84 190 82 244 98L244 110C190 94 140 96 96 108Z' }, { d: 'M106 76C150 62 192 64 236 82L240 92C192 76 150 74 108 87Z' }] },
  { id: 'brim', label: 'Mützenrand', parts: [{ d: 'M96 112C120 103 180 103 204 112C211 116 211 128 204 133C180 124 120 124 96 133C89 128 89 116 96 112Z' }] },
  { id: 'pompom', label: 'Bommel', parts: [{ d: circle(236, 147, 11) }] },
  { id: 'ornament', label: 'Kugel', parts: [{ d: circle(58, 214, 24) }] },
  { id: 'ornamentBand', label: 'Kugelband', clipTo: 'ornament', parts: [{ d: 'M30 207H86V221H30Z' }] },
  { id: 'ornamentCap', label: 'Kugelkappe', parts: [{ d: 'M50 186h16v8h-16Z' }] },
]

/** Linien und Schmuck, die nicht ausgemalt werden. */
export const DETAILS = {
  /** Feine Linien ohne Füllung. */
  lines: [
    'M58 186C58 160 62 120 66 84', // Faden der Kugel
    'M118 146q8-8 16 0', // Augen, fröhlich zugekniffen
    'M166 146q8-8 16 0',
    'M136 186q14 10 28 0', // Lächeln
    'M232 182l9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 8-6', // Zickzack auf der Decke
    'M40 214h36', // Kugelmuster
    'M206 222q4-8 10-4', // Fellwirbel
    'M330 196m-4 0a4 4 0 1 1 4 4',
    'M124 190l-6 4M176 190l6 4', // Barthaare
  ],
  /** Kleine Ringe auf dem Geweih und der Decke. */
  rings: [
    [84, 86, 4], [98, 70, 3.5], [74, 86, 3], [216, 86, 4], [202, 70, 3.5], [226, 86, 3],
    [238, 170, 3], [254, 164, 3], [270, 162, 3], [286, 164, 3], [302, 170, 3],
  ] as const,
  /** Glanzlicht auf Nase und Kugel – immer weiß. */
  shine: [ellipse(144, 154, 5, 3.5), ellipse(48, 204, 5, 3.5)],
}

export type Coloring = Record<string, number>

export function isComplete(colors: Coloring): boolean {
  return REGIONS.every((region) => colors[region.id] !== undefined)
}

export function coloredCount(colors: Coloring): number {
  return REGIONS.filter((region) => colors[region.id] !== undefined).length
}

/** Gespeicherten Stand prüfen: nur bekannte Flächen, nur Farben aus der Palette. */
export function restoreColoring(value: unknown): Coloring {
  const colors = (value as { colors?: unknown } | null)?.colors
  if (!colors || typeof colors !== 'object') return {}
  const result: Coloring = {}
  for (const region of REGIONS) {
    const index = (colors as Record<string, unknown>)[region.id]
    if (Number.isInteger(index) && (index as number) >= 0 && (index as number) < PALETTE.length) {
      result[region.id] = index as number
    }
  }
  return result
}

const OUTLINE = 'stroke="#3a2a22" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"'

/** Das fertige Bild als eigenständiges SVG – für die Staffelei vor dem Haus. */
export function artworkSvg(colors: Coloring): string {
  const clips = REGIONS.filter((r) => REGIONS.some((other) => other.clipTo === r.id))
    .map((r) => `<clipPath id="clip-${r.id}">${r.parts.map((p) => `<path d="${p.d}"${p.transform ? ` transform="${p.transform}"` : ''}/>`).join('')}</clipPath>`)
    .join('')
  const regions = REGIONS.map((region) => {
    const fill = PALETTE[colors[region.id] ?? 0].hex
    const clip = region.clipTo ? ` clip-path="url(#clip-${region.clipTo})"` : ''
    const paths = region.parts
      .map((p) => `<path d="${p.d}"${p.transform ? ` transform="${p.transform}"` : ''}/>`)
      .join('')
    return `<g fill="${fill}" ${OUTLINE}${clip}>${paths}</g>`
  }).join('')
  const lines = DETAILS.lines.map((d) => `<path d="${d}"/>`).join('')
  const rings = DETAILS.rings.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')
  const shine = DETAILS.shine.map((d) => `<path d="${d}"/>`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW.width * 2}" height="${VIEW.height * 2}" viewBox="0 0 ${VIEW.width} ${VIEW.height}">` +
    `<defs>${clips}</defs>${regions}` +
    `<g fill="none" ${OUTLINE}>${lines}${rings}</g>` +
    `<g fill="#ffffff" opacity="0.85">${shine}</g></svg>`
  )
}
