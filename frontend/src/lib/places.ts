import { TOTAL_DAYS } from './calendar.ts'

/** Der 24. ist kein Haus, sondern das Tor vor dem Weihnachtsbaum. */
export const GATE_DAY = TOTAL_DAYS

/** Die Tage 1 bis 23 sind Häuser. */
export const HOUSE_COUNT = TOTAL_DAYS - 1

export const SKI_HOUSE_DAY = 8

export function isGate(day: number): boolean {
  return day === GATE_DAY
}

/** Im Satz: „Haus 5“ bzw. „das Tor“. */
export function placeName(day: number): string {
  return isGate(day) ? 'das Tor' : `Haus ${day}`
}

/** Als Überschrift oder am Satzanfang: „Haus 5“ bzw. „Das Tor“. */
export function placeTitle(day: number): string {
  return isGate(day) ? 'Das Tor' : `Haus ${day}`
}

/**
 * Standort hinter dem offenen Tor, vor dem Weihnachtsbaum. Die Szene meldet
 * ihn wie einen weiteren Ort nach den 24 Tagen.
 */
export const TREE_PLACE = TOTAL_DAYS + 1
