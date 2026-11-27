import { isValidDay, TOTAL_DAYS } from '../lib/calendar.ts'
import type { HouseStatus } from '../state/store.ts'

export const SCREENS = {
  street: 'Straße',
  house: 'Haus / Tor',
  scanner: 'QR-Scanner',
  selfie: 'Selfie',
  game: 'Minispiel',
  reward: 'Belohnung',
  tree: 'Weihnachtsbaum',
} as const

export const HOUSE_STATUSES: Record<HouseStatus, string> = {
  locked: 'Noch verschlossen',
  available: 'Wartet auf Schlüssel',
  unlocked: 'Aufgeschlossen',
  completed: 'Bereits besucht',
}

export type PreviewScreen = keyof typeof SCREENS
export type PreviewRoute =
  | { kind: 'index' | 'not-found' }
  | {
      kind: 'screen'
      screen: PreviewScreen
      /**
       * Der simulierte Tag: Heute ist der `day`. Dezember, die Häuser 1 bis `day − 1`
       * sind bereits gelöst (auf der Straße per `?day=`, Standard 24).
       */
      day: number
      status: HouseStatus
      completedBefore: boolean
      /** Tag im Dezember, dessen Mondphase am Himmel steht (Standard: der gewählte Tag bzw. der 24.). */
      moonDay: number
    }

/** Die Straße wählt ihren simulierten Tag per `?day=`, alle anderen Screens im Pfad. */
export function previewHref(screen: PreviewScreen, day?: number): string {
  if (screen === 'tree') return '/dev/tree'
  if (screen === 'street') return day === undefined ? '/dev/street' : `/dev/street?day=${day}`
  return `/dev/${screen}/${day ?? 1}`
}

function moonDayFrom(value: string | null, fallback: number): number {
  const day = Number(value)
  return value !== null && Number.isInteger(day) && day >= 1 && day <= 31 ? day : fallback
}

export function parsePreviewRoute(url: URL): PreviewRoute {
  const path = url.pathname.replace(/\/$/, '')
  if (path === '/dev') return { kind: 'index' }
  const match = /^\/dev\/([a-z]+)(?:\/([1-9]\d*))?$/.exec(path)
  if (!match || !Object.hasOwn(SCREENS, match[1])) return { kind: 'not-found' }
  const screen = match[1] as PreviewScreen
  const needsDay = screen !== 'street' && screen !== 'tree'
  if (needsDay !== Boolean(match[2])) return { kind: 'not-found' }
  const streetDay = url.searchParams.get('day')
  const day = needsDay ? Number(match[2]) : screen === 'street' && streetDay !== null ? Number(streetDay) : TOTAL_DAYS
  if (!isValidDay(day)) return { kind: 'not-found' }
  const status = url.searchParams.get('status') ?? 'unlocked'
  if (!Object.hasOwn(HOUSE_STATUSES, status)) return { kind: 'not-found' }
  return {
    kind: 'screen',
    screen,
    day,
    status: status as HouseStatus,
    completedBefore: url.searchParams.get('completed') === 'true',
    moonDay: moonDayFrom(url.searchParams.get('moon'), day),
  }
}
