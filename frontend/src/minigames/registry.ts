import { SKI_HOUSE_DAY } from '../lib/places.ts'
import type { MinigameDefinition } from './types.ts'

/**
 * Welches Minispiel in welchem Haus wohnt. Tag 24 ist das Tor: Sein Spiel ist
 * das letzte Rätsel auf dem Weg zum Weihnachtsbaum.
 *
 * Ein neues Spiel einziehen lassen:
 *   1. Komponente anlegen, z. B. `games/Memory.tsx`, die `MinigameProps`
 *      entgegennimmt und als `default` exportiert wird.
 *   2. Hier eintragen:
 *        3: { title: 'Plätzchen-Memory', load: () => import('./games/Memory.tsx') },
 *
 * Tage ohne Eintrag zeigen den Platzhalter.
 */
const games: Partial<Record<number, MinigameDefinition>> = {
  1: {
    title: 'Die Weihnachtsbäckerei',
    layout: 'wide',
    load: () => import('./games/bakery/BakeryGame.tsx'),
  },
  2: {
    title: 'Spuren im Schnee',
    load: () => import('./games/reindeer/ReindeerGame.tsx'),
  },
  3: {
    title: 'Lichterketten-Schlamassel',
    load: () => import('./games/lights/LightsGame.tsx'),
  },
  4: {
    title: 'Malstunde',
    layout: 'wide',
    load: () => import('./games/coloring/ColoringGame.tsx'),
  },
  5: {
    title: 'Mondstaub-Mann',
    layout: 'wide',
    load: () => import('./games/moonman/MoonmanGame.tsx'),
  },
  6: {
    title: 'Schneeballschlacht',
    layout: 'wide',
    load: () => import('./games/snowball/SnowballGame.tsx'),
  },
  7: {
    title: 'Lebkuchenhaus',
    layout: 'wide',
    load: () => import('./games/gingerbread/GingerbreadGame.tsx'),
  },
  9: {
    title: 'Eingeschneit!',
    load: () => import('./games/snowwindow/SnowWindowGame.tsx'),
  },
  10: {
    title: 'Holz hacken',
    layout: 'wide',
    load: () => import('./games/firewood/FirewoodGame.tsx'),
  },
  11: {
    title: 'Santa Bibber',
    layout: 'wide',
    load: () => import('./games/santa/SantaGame.tsx'),
  },
  12: {
    title: 'Durch den Schornstein',
    layout: 'wide',
    load: () => import('./games/chimney/ChimneyGame.tsx'),
  },
  13: {
    title: 'Glühwein-Fieber',
    layout: 'wide',
    load: () => import('./games/gluehwein/GluehweinGame.tsx'),
  },
  14: {
    title: 'Weihnachtskugelball',
    layout: 'wide',
    load: () => import('./games/baubleball/BaubleballGame.tsx'),
  },
  15: {
    title: 'Plätzchen-Hüpfer',
    load: () => import('./games/cookiejump/CookieJumpGame.tsx'),
  },
  16: {
    title: 'Rentiere gesucht!',
    layout: 'wide',
    load: () => import('./games/wimmel/WimmelGame.tsx'),
  },
  23: {
    title: 'Geschenke-Tetris',
    load: () => import('./games/tetris/TetrisGame.tsx'),
  },
  [SKI_HOUSE_DAY]: {
    title: 'Pisten-Surfer',
    layout: 'outdoor',
    load: () => import('./games/ski/SkiGame.tsx'),
  },
}

const placeholder: MinigameDefinition = {
  title: 'Willkommen!',
  load: () => import('./Placeholder.tsx'),
}

export function minigameFor(day: number): MinigameDefinition {
  return games[day] ?? placeholder
}

export function hasMinigame(day: number): boolean {
  return games[day] !== undefined
}
