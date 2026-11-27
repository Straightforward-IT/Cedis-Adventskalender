import { Color } from 'three'

const cache = new Map<string, Color>()

/** Farbe aus Hex-Wert. Die Objekte werden geteilt und dürfen nicht verändert werden. */
export function col(hex: string): Color {
  let color = cache.get(hex)
  if (!color) {
    color = new Color(hex)
    cache.set(hex, color)
  }
  return color
}

/** Hellere (amount > 0) oder dunklere (amount < 0) Variante einer Farbe. */
export function shade(hex: string, amount: number): Color {
  const key = `${hex}|${amount}`
  let color = cache.get(key)
  if (!color) {
    color = new Color(hex).offsetHSL(0, 0, amount)
    cache.set(key, color)
  }
  return color
}

export const SNOW = '#f3f6ff'
export const SNOW_SHADOW = '#dbe3f6'
export const ICE = '#e4f0ff'
export const STONE = '#a59e9c'
export const IRON = '#2c2f42'
export const WOOD = '#7a5236'
export const WOOD_DARK = '#54382a'
export const PINE = ['#2f6650', '#3a755a', '#28594a'] as const
export const BERRY = '#c4463c'
export const GOLD = '#f2c14e'
export const DARK_GLASS = '#1d2444'

/** Fensterlicht: unten etwas heller als oben, wie von einer Lampe im Zimmer. */
export const WINDOW_LIGHTS = [
  ['#ffe6a8', '#ffc25f'],
  ['#ffe9b8', '#ffcd78'],
  ['#ffdf9a', '#ffb65a'],
  ['#fff0c8', '#ffd58a'],
] as const

export const BULB_COLORS = {
  warm: ['#ffe2a0'],
  multi: ['#ff6156', '#5fdc8f', '#63b8ff', '#ffcb52', '#ff93d2'],
  redgreen: ['#ff6156', '#5fdc8f'],
  ice: ['#c4e8ff', '#eef9ff'],
  gold: ['#ffcb52', '#ffe6a6'],
} as const

/** Himmel in der blauen Stunde. Der Nebel hat die Farbe des Horizonts – so verschmilzt die Ferne mit dem Himmel. */
export const SKY = {
  horizon: '#b9a3cb',
  middle: '#5d5a9c',
  top: '#22264f',
} as const
