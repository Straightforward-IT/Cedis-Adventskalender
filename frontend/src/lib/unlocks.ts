/**
 * Was ein gelöstes Haus auf der Straße freischaltet – die Easter Eggs, die danach zu sehen sind.
 * Die Karte des Hauses zeigt es nach dem Lösen an. Muss zu `ui/StreetCanvas.tsx` passen,
 * wo die Szene die Easter Eggs je nach Fortschritt ein- und ausblendet.
 */
export interface Unlock {
  icon: string
  text: string
}

const UNLOCKS: Partial<Record<number, Unlock>> = {
  1: { icon: '🎂', text: 'Hinter den Fenstern im ersten Stock läuft jetzt das Kuchen-Förderband.' },
  2: { icon: '🦌', text: 'Das Rentier aus deinem Punktebild ist in den Giebel gezogen.' },
  3: { icon: '💡', text: 'Überall an Häusern und Bäumen leuchten jetzt Lichterketten – die entwirrte hängt an Haus 3.' },
  4: { icon: '🎨', text: 'Dein fertiges Bild steht auf der Staffelei vor dem Haus.' },
  5: { icon: '🌙', text: 'Der Mondstaub-Mann steht jetzt oben auf dem Mond.' },
  6: { icon: '🐿️', text: 'Auf der Straße lugen Eichhörnchen hervor – tipp sie an, um sie abzuwerfen.' },
  7: { icon: '🏠', text: 'Dein Lebkuchenhaus steht jetzt im Fenster.' },
  8: { icon: '⛷️', text: 'Hinter dem Haus fährt der Skiwichtel durch die Halfpipe.' },
  9: { icon: '🧝', text: 'Die Fenster sind frei – und hinter der Hausecke lugt jetzt ein Wichtel hervor.' },
  10: { icon: '🔥', text: 'Oben rechts brennt der Kamin, und der Schornstein spuckt Flammen.' },
  11: { icon: '🛷', text: 'Bei jedem Blick zum Baum fliegt der Weihnachtsmann vorbei.' },
  12: { icon: '🐈', text: 'Die Katze sitzt jetzt draußen auf dem Balkon.' },
  13: { icon: '🍷', text: 'Vor dem Haus steht jetzt der Glühweinstand – ein Wichtel schenkt aus.' },
  14: { icon: '🏀', text: 'Tipp den Korb an der Garage an: Eine Kugel fliegt durch, die Scherben bleiben liegen.' },
  15: { icon: '🍪', text: 'Hinter den oberen Fenstern hüpft Santa von Keks zu Keks.' },
  16: { icon: '🦌', text: 'Die fünf gefundenen Rentiere grasen jetzt mit Rudolph auf der Wiese gegenüber – dreh dich zum Baum um.' },
}

export function unlockFor(day: number): Unlock | null {
  return UNLOCKS[day] ?? null
}
