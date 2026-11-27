import { useId, useState } from 'react'
import type { SnowReport } from '../api/types.ts'
import { useStore } from '../state/store.ts'

const decimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

function verdict(percent: number): string {
  if (percent <= 5) return 'Heute bleibt der Schlitten wohl im Keller.'
  if (percent <= 30) return 'Mit etwas Glück tanzen ein paar Flocken.'
  if (percent <= 60) return 'Die Chancen stehen gar nicht schlecht!'
  if (percent <= 85) return 'Mütze auf – es riecht nach Schnee!'
  return 'Es schneit! Ab nach draußen!'
}

function temperature(report: SnowReport): string | null {
  const { temperatureMin: min, temperatureMax: max } = report
  if (min === null || max === null) return null
  const format = (value: number) => decimal.format(Math.round(value)).replace('-', '−')
  return `${format(min)} bis ${format(max)} °C`
}

/** Schneekugel, die sich je nach Schneewahrscheinlichkeit füllt. */
function SnowGlobe({ percent }: { percent: number }) {
  const clip = useId()
  const level = 42 - (38 * Math.min(Math.max(percent, 0), 100)) / 100
  return (
    <svg className="snow__globe" viewBox="0 0 48 54" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="24" cy="23" r="19" />
        </clipPath>
      </defs>
      <path d="M11 43h26l4 9H7l4-9Z" fill="#b4403a" />
      <circle cx="24" cy="23" r="20" fill="#bcd3ee" />
      <g clipPath={`url(#${clip})`}>
        <rect x="4" y={level} width="40" height="40" fill="#ffffff" />
        <ellipse cx="24" cy={level} rx="24" ry="3.5" fill="#ffffff" />
        <g fill="#ffffff">
          <circle cx="14" cy="13" r="1.4" />
          <circle cx="31" cy="10" r="1.1" />
          <circle cx="35" cy="21" r="1.4" />
          <circle cx="22" cy="19" r="1.1" />
          <circle cx="11" cy="25" r="1.1" />
          <circle cx="27" cy="29" r="1.3" />
        </g>
      </g>
      <circle cx="24" cy="23" r="20" fill="none" stroke="#fff6e6" strokeWidth="2.5" />
      <path d="M11 16a15 15 0 0 1 7-7" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

/** Zeigt, mit welcher Wahrscheinlichkeit es heute in Hamburg schneit. */
export function SnowOMeter() {
  const snow = useStore((state) => state.snow)
  const [open, setOpen] = useState(false)
  const percent = snow?.probability ?? 0
  const warmth = snow ? temperature(snow) : null

  return (
    <div className="snow">
      <button
        type="button"
        className="chip snow__chip"
        aria-expanded={open}
        aria-label={
          snow ? `Schnee-o-Meter: ${percent} Prozent Schneechance heute in Hamburg` : 'Schnee-o-Meter'
        }
        onClick={() => setOpen(!open)}
      >
        <SnowGlobe percent={percent} />
        <span className="snow__value">{snow ? `${percent} %` : '…'}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="snow__backdrop"
            aria-label="Schnee-o-Meter schließen"
            onClick={() => setOpen(false)}
          />
          <div className="snow__card" role="dialog" aria-label="Schnee-o-Meter">
            <h2>Schnee-o-Meter</h2>
            {snow ? (
              <>
                <div className="snow__reading">
                  <SnowGlobe percent={percent} />
                  <strong>{percent} %</strong>
                </div>
                <p className="snow__verdict">{verdict(percent)}</p>
                <dl className="snow__facts">
                  {snow.snowfallCm !== null && (
                    <div>
                      <dt>Neuschnee</dt>
                      <dd>{decimal.format(snow.snowfallCm)} cm</dd>
                    </div>
                  )}
                  {warmth && (
                    <div>
                      <dt>Temperatur</dt>
                      <dd>{warmth}</dd>
                    </div>
                  )}
                </dl>
                <p className="snow__source">Schneechance heute in {snow.location} · Daten: Open-Meteo</p>
              </>
            ) : (
              <p className="snow__verdict">Der Wetterfrosch meldet sich gerade nicht. Schau später noch einmal vorbei.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
