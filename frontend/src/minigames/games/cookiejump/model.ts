import { createRandom, hashSeed } from '../../../lib/rng.ts'
import type { Random } from '../../../lib/rng.ts'

/**
 * Plätzchen-Hüpfer (Haus 15): Santa springt von Plätzchen zu Plätzchen immer höher in den
 * Nachthimmel und sammelt acht Geschenke ein. Manche Plätzchen liegen still, andere gleiten hin
 * und her. Springen geht von allein – man lenkt nur nach links und rechts. Wer am Rand hinausläuft,
 * kommt auf der anderen Seite wieder herein.
 *
 * Verlieren gibt es nicht: Fällt Santa aus dem Bild, fängt ihn ein Schneewölkchen auf und setzt
 * ihn aufs unterste sichtbare Plätzchen. Gesammelte Geschenke bleiben gesammelt.
 *
 * Welt in Spieleinheiten: x von 0 bis `WIDTH` (links → rechts), y nach oben. Zeit in Sekunden.
 */

export const WIDTH = 10
export const GOAL = 8
export const GRAVITY = 32
/** Absprunggeschwindigkeit – reicht für gut 3,9 Einheiten Höhe. */
export const JUMP = 15.8
export const MAX_JUMP_HEIGHT = (JUMP * JUMP) / (2 * GRAVITY)
/** So schnell läuft Santa seitlich (Einheiten pro Sekunde) und so schnell kommt er auf Touren. */
export const RUN = 9
const STEER = 38
/** Santa als Rechteck um seine Fußmitte. */
export const SANTA = { width: 0.9, height: 1.25 }
export const COOKIE = { width: 1.7, height: 0.32 }
export const PRESENT = { size: 0.6 }
/** So viel sieht man über und unter Santa – die Kamera folgt nur nach oben. */
export const VIEW_HEIGHT = 15
const CAMERA_LEAD = 5.5

export type CookieKind = 'butter' | 'ginger' | 'star' | 'choc'

export interface Cookie {
  id: number
  x: number
  y: number
  kind: CookieKind
  /** Gleitende Plätzchen: Mittelpunkt, Ausschlag und Tempo. */
  move: { center: number; range: number; speed: number; phase: number } | null
}

export interface Present {
  id: number
  x: number
  y: number
  color: number
  taken: boolean
}

export interface Santa {
  x: number
  y: number
  vx: number
  vy: number
  /** Blickrichtung: −1 links, 1 rechts. */
  facing: number
  /** Zeit seit dem letzten Absprung – für das Zusammenstauchen beim Aufkommen. */
  bounce: number
}

export interface World {
  time: number
  santa: Santa
  cookies: Cookie[]
  presents: Present[]
  collected: number
  /** Untere Kante des sichtbaren Ausschnitts. */
  camera: number
  /** Bis hierhin sind Plätzchen erzeugt. */
  built: number
  nextId: number
  /** Wie viele Plätzchen seit dem letzten Geschenk erzeugt wurden. */
  sincePresent: number
  /** Gerade aufgefangen? Dann schwebt Santa kurz (Sekunden). */
  rescue: number
  rescues: number
  rnd: Random
}

export interface Events {
  landed: Cookie | null
  presents: Present[]
  rescued: boolean
}

export function createWorld(collected = 0, seed = hashSeed(15, 'plaetzchen', collected)): World {
  const world: World = {
    time: 0,
    santa: { x: WIDTH / 2, y: 0.32, vx: 0, vy: JUMP, facing: 1, bounce: 0 },
    cookies: [],
    presents: [],
    collected: Math.min(GOAL, Math.max(0, collected)),
    camera: -2,
    built: 0,
    nextId: 1,
    sincePresent: 0,
    rescue: 0,
    rescues: 0,
    rnd: createRandom(seed),
  }
  // Ein breites Plätzchen-Blech als Boden zum Loslegen
  world.cookies.push({ id: world.nextId++, x: WIDTH / 2, y: 0, kind: 'butter', move: null })
  world.cookies.push({ id: world.nextId++, x: 2, y: 0, kind: 'ginger', move: null })
  world.cookies.push({ id: world.nextId++, x: 8, y: 0, kind: 'star', move: null })
  generate(world, VIEW_HEIGHT * 2)
  return world
}

/** Die Höhe macht es nach und nach schwieriger: größere Abstände, mehr gleitende Plätzchen. */
function difficulty(y: number): number {
  return Math.min(1, y / 120)
}

function generate(world: World, upTo: number): void {
  const { rnd } = world
  while (world.built < upTo) {
    const d = difficulty(world.built)
    const gap = rnd.range(1.3 + d * 0.9, 2.1 + d * 1.2)
    world.built += Math.min(gap, MAX_JUMP_HEIGHT * 0.85)
    const moving = rnd.chance(0.18 + d * 0.32)
    const x = rnd.range(COOKIE.width / 2, WIDTH - COOKIE.width / 2)
    const kind = rnd.pick(['butter', 'ginger', 'star', 'choc'] as const)
    const cookie: Cookie = {
      id: world.nextId++,
      x,
      y: world.built,
      kind,
      move: moving
        ? { center: x, range: rnd.range(1.2, 2.8), speed: rnd.range(0.7, 1.4 + d), phase: rnd.range(0, Math.PI * 2) }
        : null,
    }
    if (cookie.move) {
      // Nicht über den Rand hinausgleiten
      const half = COOKIE.width / 2
      cookie.move.range = Math.min(cookie.move.range, cookie.move.center - half, WIDTH - half - cookie.move.center)
      if (cookie.move.range < 0.4) cookie.move = null
    }
    world.cookies.push(cookie)

    // Ab und zu liegt ein Geschenk auf einem Plätzchen – bis acht gesammelt sind, kommen immer neue.
    world.sincePresent++
    if (world.sincePresent >= 4 && rnd.chance(0.6) && !cookie.move) {
      world.sincePresent = 0
      world.presents.push({ id: world.nextId++, x: cookie.x, y: cookie.y + COOKIE.height + 0.05, color: rnd.int(0, 5), taken: false })
    }
  }
}

export function cookieX(cookie: Cookie, time: number): number {
  if (!cookie.move) return cookie.x
  return cookie.move.center + Math.sin(time * cookie.move.speed + cookie.move.phase) * cookie.move.range
}

export const isDone = (world: World) => world.collected >= GOAL

/** Ein Zeitschritt. `steer`: −1 (ganz links) … 0 (geradeaus) … 1 (ganz rechts). */
export function step(world: World, dt: number, steer: number): Events {
  const events: Events = { landed: null, presents: [], rescued: false }
  world.time += dt
  const santa = world.santa
  santa.bounce += dt

  // Aufgefangen: kurz schweben, dann geht es weiter
  if (world.rescue > 0) {
    world.rescue = Math.max(0, world.rescue - dt)
    if (world.rescue === 0) santa.vy = JUMP
    return events
  }

  // Lenken mit etwas Trägheit
  const target = steer * RUN
  const change = STEER * dt
  santa.vx += Math.max(-change, Math.min(change, target - santa.vx))
  if (steer !== 0) santa.facing = Math.sign(steer)
  santa.x += santa.vx * dt
  // Am Rand hinaus, auf der anderen Seite herein
  if (santa.x < 0) santa.x += WIDTH
  if (santa.x >= WIDTH) santa.x -= WIDTH

  const before = santa.y
  santa.vy -= GRAVITY * dt
  santa.y += santa.vy * dt

  // Landen: nur im Fallen, wenn die Füße die Oberkante eines Plätzchens kreuzen
  if (santa.vy < 0) {
    for (const cookie of world.cookies) {
      const top = cookie.y + COOKIE.height
      if (before < top || santa.y > top) continue
      const cx = cookieX(cookie, world.time)
      if (Math.abs(wrapDelta(santa.x - cx)) > COOKIE.width / 2 + SANTA.width * 0.3) continue
      santa.y = top
      santa.vy = JUMP
      santa.bounce = 0
      events.landed = cookie
      break
    }
  }

  // Geschenke einsammeln
  for (const present of world.presents) {
    if (present.taken || world.collected >= GOAL) continue
    const dx = Math.abs(wrapDelta(santa.x - present.x))
    const dy = present.y + PRESENT.size / 2 - (santa.y + SANTA.height / 2)
    if (dx < (SANTA.width + PRESENT.size) / 2 && Math.abs(dy) < (SANTA.height + PRESENT.size) / 2) {
      present.taken = true
      world.collected++
      events.presents.push(present)
    }
  }

  // Kamera folgt nur nach oben
  world.camera = Math.max(world.camera, santa.y - CAMERA_LEAD)

  // Aus dem Bild gefallen? Ein Wölkchen fängt Santa auf.
  if (santa.y < world.camera - 1.5) {
    const visible = world.cookies
      .filter((c) => c.y >= world.camera + 0.5 && !c.move)
      .sort((a, b) => a.y - b.y)[0]
    const landing = visible ?? world.cookies.filter((c) => c.y >= world.camera).sort((a, b) => a.y - b.y)[0]
    if (landing) {
      santa.x = cookieX(landing, world.time)
      santa.y = landing.y + COOKIE.height
    } else {
      santa.y = world.camera + 1
    }
    santa.vx = 0
    santa.vy = 0
    world.rescue = 0.9
    world.rescues++
    events.rescued = true
  }

  // Oben nachbauen, unten aufräumen
  generate(world, world.camera + VIEW_HEIGHT * 2)
  world.cookies = world.cookies.filter((c) => c.y > world.camera - 3)
  world.presents = world.presents.filter((p) => !p.taken && p.y > world.camera - 3)
  return events
}

/** Kürzester Abstand auf der umlaufenden Breite (−WIDTH/2 … WIDTH/2). */
export function wrapDelta(dx: number): number {
  return ((((dx + WIDTH / 2) % WIDTH) + WIDTH) % WIDTH) - WIDTH / 2
}

export function restore(saved: unknown): number {
  if (!saved || typeof saved !== 'object') return 0
  const value = (saved as { presents?: unknown }).presents
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(GOAL, Math.max(0, value)) : 0
}
