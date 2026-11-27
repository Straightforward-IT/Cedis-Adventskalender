import { createRandom, hashSeed } from '../../../lib/rng.ts'

export const SHAPES = [
  { value: 'round', label: 'Rund' },
  { value: 'square', label: 'Eckig' },
  { value: 'heart', label: 'Herz' },
] as const

export const FLAVOURS = [
  { value: 'chocolate', label: 'Schokolade', color: '#74432f', light: '#ac7654' },
  { value: 'strawberry', label: 'Erdbeere', color: '#e590a1', light: '#ffbac6' },
  { value: 'vanilla', label: 'Vanille', color: '#f1d58d', light: '#fff1bc' },
] as const

export const TOPPINGS = [
  { value: 'berries', label: 'Beeren' },
  { value: 'heart', label: 'Herz' },
  { value: 'star', label: 'Stern' },
  { value: 'tree', label: 'Tanne' },
] as const

export const FIELDS = ['shape', 'filling', 'icing', 'topping'] as const
export const FIELD_LABELS = { shape: 'Form', filling: 'Creme', icing: 'Glasur', topping: 'Deko' }
export const ORDER_COUNT = 5

export interface Recipe {
  shape: typeof SHAPES[number]['value']
  filling: typeof FLAVOURS[number]['value']
  icing: typeof FLAVOURS[number]['value']
  topping: typeof TOPPINGS[number]['value']
}

export type RecipeField = keyof Recipe
export type Cake = { [K in RecipeField]: Recipe[K] | null }

export interface BakeryState {
  version: 1
  orderIndex: number
  station: number
  cake: Cake
  served: boolean
}

export type BakeryAction =
  | { type: 'select'; field: RecipeField; value: string }
  | { type: 'move'; station: number }
  | { type: 'reset-cake' }
  | { type: 'serve' }
  | { type: 'next-order' }

export function optionsFor(field: RecipeField) {
  return field === 'shape' ? SHAPES : field === 'topping' ? TOPPINGS : FLAVOURS
}

export function ingredientLabel(field: RecipeField, value: string | null): string {
  return optionsFor(field).find((option) => option.value === value)?.label ?? 'Noch offen'
}

export function describeCake(cake: Cake): string {
  if (!cake.shape) return 'Leeres Kuchenblech'
  return FIELDS.map((field) => `${FIELD_LABELS[field]}: ${ingredientLabel(field, cake[field])}`).join(', ')
}

/** Jede Sorte kommt vor; ein erneuter Besuch behält dieselben Bestellungen. */
export function createOrders(day: number): Recipe[] {
  const random = createRandom(hashSeed('winter-bakery-v1', day))
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = random.int(0, i)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
  const shapes = shuffle(SHAPES)
  const fillings = shuffle(FLAVOURS)
  const icings = shuffle(FLAVOURS)
  const toppings = shuffle(TOPPINGS)
  return Array.from({ length: ORDER_COUNT }, (_, i) => ({
    shape: shapes[i % shapes.length].value,
    filling: fillings[(i * 2) % fillings.length].value,
    icing: icings[(i + 1) % icings.length].value,
    topping: toppings[i % toppings.length].value,
  }))
}

export function freshGame(orderIndex = 0): BakeryState {
  return {
    version: 1,
    orderIndex,
    station: 0,
    cake: { shape: null, filling: null, icing: null, topping: null },
    served: false,
  }
}

export function reachableStation(cake: Cake): number {
  const firstEmpty = FIELDS.findIndex((field) => cake[field] === null)
  return firstEmpty === -1 ? FIELDS.length : firstEmpty
}

export function mismatches(cake: Cake, order: Recipe): RecipeField[] {
  return FIELDS.filter((field) => cake[field] !== order[field])
}

/** Spielstände sind Browserdaten und können auch aus einer älteren Version stammen. */
export function restoreGame(value: unknown, orders: readonly Recipe[]): BakeryState {
  const fallback = freshGame()
  if (!value || typeof value !== 'object') return fallback
  const saved = value as Record<string, unknown>
  if (saved.version !== 1 || !Number.isInteger(saved.orderIndex) || !Number.isInteger(saved.station)
    || typeof saved.served !== 'boolean' || !saved.cake || typeof saved.cake !== 'object') return fallback
  const orderIndex = saved.orderIndex as number
  const station = saved.station as number
  if (orderIndex < 0 || orderIndex >= orders.length || station < 0 || station > FIELDS.length) return fallback
  const candidate = saved.cake as Record<string, unknown>
  const cake = { ...fallback.cake }
  let hasGap = false
  for (const field of FIELDS) {
    const ingredient = candidate[field]
    if (ingredient === null) hasGap = true
    else if (hasGap || !optionsFor(field).some((option) => option.value === ingredient)) return fallback
    Object.assign(cake, { [field]: ingredient })
  }
  if (station > reachableStation(cake)) return fallback
  if (saved.served && (station !== FIELDS.length || mismatches(cake, orders[orderIndex]).length > 0)) return fallback
  return { version: 1, orderIndex, station, cake, served: saved.served }
}

export function startGame(value: unknown, orders: readonly Recipe[], completedBefore: boolean): BakeryState {
  const restored = restoreGame(value, orders)
  return completedBefore && restored.served && restored.orderIndex === orders.length - 1 ? freshGame() : restored
}

/** Nur eine passende Abgabe zählt. Korrekturen behalten die fertigen Bestellungen. */
export function updateGame(state: BakeryState, action: BakeryAction, orders: readonly Recipe[]): BakeryState {
  if (action.type === 'next-order') {
    return state.served && state.orderIndex < orders.length - 1 ? freshGame(state.orderIndex + 1) : state
  }
  if (state.served) return state
  if (action.type === 'reset-cake') return freshGame(state.orderIndex)
  if (action.type === 'move') {
    if (!Number.isInteger(action.station) || action.station < 0 || action.station > reachableStation(state.cake)) return state
    return { ...state, station: action.station }
  }
  if (action.type === 'select') {
    if (FIELDS[state.station] !== action.field || !optionsFor(action.field).some((option) => option.value === action.value)) return state
    return { ...state, cake: { ...state.cake, [action.field]: action.value } }
  }
  if (action.type === 'serve' && state.station === FIELDS.length && mismatches(state.cake, orders[state.orderIndex]).length === 0) {
    return { ...state, served: true }
  }
  return state
}
