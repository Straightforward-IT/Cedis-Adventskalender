export interface Reward {
  day: number
  title: string
  message: string
}

/**
 * Belohnung nach dem Minispiel. Ohne eigenen Text wird einfach dazu
 * aufgefordert, die echte Box zu öffnen. Eigene Texte kommen über die
 * Umgebungsvariable REWARDS_JSON – so stehen keine Spoiler im Repository.
 */
export function rewardFor(day: number, messages: Record<number, string>): Reward {
  return {
    day,
    title: `Türchen ${day}`,
    message: messages[day] ?? `Geschafft! Jetzt darfst du Box ${day} öffnen.`,
  }
}
