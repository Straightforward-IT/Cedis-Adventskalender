/**
 * Durch den Schornstein: Man landet im gemütlichen Wohnzimmer von Haus 12. Kekse
 * einpacken, die Katze mit Leckerli bestechen (sie sitzt vor der Balkontür), eine
 * Flasche Wein aus der Vitrine holen – und dann leise über den Balkon verschwinden.
 */

export type Item = 'cookies' | 'treats' | 'wine'
export type Target = 'plate' | 'drawer' | 'treats' | 'cabinet' | 'wine' | 'cat' | 'balcony'
export type Effect = 'take' | 'open' | 'close' | 'meow' | 'eat' | 'blocked' | 'escape'

export interface RoomState {
  items: Item[]
  drawerOpen: boolean
  cabinetOpen: boolean
  catFed: boolean
  escaped: boolean
}

export const freshRoom = (): RoomState => ({ items: [], drawerOpen: false, cabinetOpen: false, catFed: false, escaped: false })

export const ITEM_LABEL: Record<Item, string> = { cookies: 'Kekse', treats: 'Leckerli', wine: 'Wein' }

/** Was schon erledigt ist – für die Aufgabenliste. */
export function tasks(state: RoomState) {
  return [
    { id: 'cookies', label: 'Kekse', done: state.items.includes('cookies') },
    { id: 'cat', label: 'Katze füttern', done: state.catFed },
    { id: 'wine', label: 'Wein', done: state.items.includes('wine') },
    { id: 'balcony', label: 'Über den Balkon', done: state.escaped },
  ] as const
}

const has = (state: RoomState, item: Item) => state.items.includes(item)
const add = (state: RoomState, item: Item): RoomState => ({ ...state, items: [...state.items, item] })
/** Leckerli einmal verfüttert – weg sind sie. */
const used = (state: RoomState, item: Item): RoomState => ({ ...state, items: state.items.filter((i) => i !== item) })

/** Antippen eines Gegenstands: neuer Zustand, ein Satz dazu und was dabei passiert. */
export function interact(state: RoomState, target: Target): { state: RoomState; message: string; effect: Effect } {
  if (state.escaped) return { state, message: 'Du bist schon über alle Dächer. 🌙', effect: 'blocked' }
  switch (target) {
    case 'plate':
      return has(state, 'cookies')
        ? { state, message: 'Auf dem Teller sind nur noch Krümel.', effect: 'blocked' }
        : { state: add(state, 'cookies'), message: 'Ein paar Kekse eingepackt! 🍪 Die Milch bleibt stehen.', effect: 'take' }
    case 'drawer':
      if (state.drawerOpen) return { state: { ...state, drawerOpen: false }, message: 'Schublade zu.', effect: 'close' }
      return {
        state: { ...state, drawerOpen: true },
        message: has(state, 'treats') || state.catFed ? 'Die Schublade ist leer.' : 'In der Schublade raschelt eine Tüte Katzen-Leckerli …',
        effect: 'open',
      }
    case 'treats':
      if (!state.drawerOpen || has(state, 'treats') || state.catFed) return { state, message: 'Da ist nichts mehr.', effect: 'blocked' }
      return { state: add(state, 'treats'), message: 'Leckerli eingesteckt. Wer die wohl mag? 🐟', effect: 'take' }
    case 'cabinet':
      if (state.cabinetOpen) return { state: { ...state, cabinetOpen: false }, message: 'Vitrine zu.', effect: 'close' }
      return {
        state: { ...state, cabinetOpen: true },
        message: has(state, 'wine') ? 'Die Vitrine ist leer.' : 'Hinter der Glastür steht eine Flasche Rotwein. 🍷',
        effect: 'open',
      }
    case 'wine':
      if (!state.cabinetOpen || has(state, 'wine')) return { state, message: 'Da ist nichts mehr.', effect: 'blocked' }
      return { state: add(state, 'wine'), message: 'Die Flasche ist eingepackt – ganz vorsichtig!', effect: 'take' }
    case 'cat':
      if (state.catFed) return { state, message: 'Die Katze schnurrt zufrieden auf dem Teppich. 💤', effect: 'blocked' }
      if (has(state, 'treats')) {
        return { state: { ...used(state, 'treats'), catFed: true }, message: 'Mjam! Die Katze frisst die Leckerli – und macht die Balkontür frei.', effect: 'eat' }
      }
      return { state, message: 'Miau! Die Katze sitzt vor der Balkontür und schaut dich hungrig an.', effect: 'meow' }
    case 'balcony': {
      if (!state.catFed) return { state, message: 'Die Katze lässt dich nicht vorbei. Miau!', effect: 'meow' }
      const missing = (['cookies', 'wine'] as const).filter((item) => !has(state, item)).map((item) => ITEM_LABEL[item])
      if (missing.length) return { state, message: `Nicht ohne ${missing.join(' und ')}!`, effect: 'blocked' }
      return { state: { ...state, escaped: true }, message: 'Leise auf den Balkon hinaus … und weg! 🌙', effect: 'escape' }
    }
  }
}

/** Gemerkten Stand prüfen – nur bekannte Dinge, und nur was zusammenpasst. */
export function restoreRoom(value: unknown): RoomState {
  const v = value as Partial<RoomState> | null
  if (!v || typeof v !== 'object') return freshRoom()
  const known: Item[] = ['cookies', 'treats', 'wine']
  const items = known.filter((item) => Array.isArray(v.items) && v.items.includes(item))
  const catFed = v.catFed === true
  const state: RoomState = {
    items: catFed ? items.filter((i) => i !== 'treats') : items,
    drawerOpen: v.drawerOpen === true,
    cabinetOpen: v.cabinetOpen === true,
    catFed,
    escaped: false,
  }
  state.escaped = v.escaped === true && catFed && items.includes('cookies') && items.includes('wine')
  return state
}
