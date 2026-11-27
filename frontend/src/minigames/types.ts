import type { ComponentType } from 'react'

/**
 * Was jedes Minispiel bekommt. Ein Spiel ist eine React-Komponente, die in den
 * Innenraum eines Hauses gezeichnet wird – mehr muss sie nicht können.
 */
export interface MinigameProps {
  /** Der Tag (1–24), dessen Spiel läuft: eines der Häuser 1–23 oder – am 24. – das Tor. */
  day: number
  /** Aufrufen, sobald das Spiel gelöst ist. Verlieren und Zeitdruck gibt es nicht. */
  onComplete(): void
  /** Der zuletzt mit `saveState` gemerkte Zwischenstand – beim ersten Besuch undefined. */
  savedState: unknown
  /** Zwischenstand merken, damit man später an derselben Stelle weiterspielen kann. Muss JSON-tauglich sein. */
  saveState(state: unknown): void
  /** true, wenn das Haus schon einmal gelöst wurde und jetzt nur wiederholt wird. */
  completedBefore: boolean
}

export interface MinigameDefinition {
  /** Überschrift im Haus. */
  title: string
  /** Breitere Bühne oder eine Vollbildszene, die direkt von der Straße startet. */
  layout?: 'wide' | 'outdoor'
  /** Lädt das Spiel erst, wenn das Haus betreten wird – so bleibt die Straße schlank. */
  load(): Promise<{ default: ComponentType<MinigameProps> }>
}
