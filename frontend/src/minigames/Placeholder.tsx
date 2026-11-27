import { isGate } from '../lib/places.ts'
import type { MinigameProps } from './types.ts'

/** Steht in jedem Haus (und am Tor), in das noch kein Minispiel eingezogen ist. */
export default function Placeholder({ day, onComplete, completedBefore }: MinigameProps) {
  return (
    <div className="placeholder">
      <svg className="placeholder__art" viewBox="0 0 120 100" aria-hidden="true">
        <ellipse cx="60" cy="90" rx="46" ry="7" fill="#e5c79a" />
        <rect x="20" y="42" width="34" height="44" rx="4" fill="#3f7a5f" />
        <rect x="33" y="42" width="8" height="44" fill="#f2c14e" />
        <rect x="66" y="56" width="34" height="30" rx="4" fill="#c4463c" />
        <rect x="79" y="56" width="8" height="30" fill="#fff6e6" />
        <rect x="46" y="20" width="30" height="26" rx="4" fill="#6f9bc2" />
        <rect x="57" y="20" width="8" height="26" fill="#fff6e6" />
        <path d="M61 20c-9-12-18-4-8 0M61 20c9-12 18-4 8 0" fill="none" stroke="#fff6e6" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h3>Hier zieht bald ein Minispiel ein</h3>
      <p>
        {isGate(day) ? 'Am letzten Rätsel' : `In Haus ${day}`} wird noch gebastelt. Bis es fertig
        ist, geht es ohne Umweg zur Überraschung.
      </p>
      <button type="button" className="button" onClick={onComplete}>
        {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung freischalten'}
      </button>
    </div>
  )
}
