import { useEffect, useEffectEvent, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { coloredCount, DETAILS, isComplete, PALETTE, REGIONS, restoreColoring, VIEW } from './artwork.ts'
import type { Coloring, Region } from './artwork.ts'
import './coloring.css'

/** Einmal kurz aufleuchten – so lange wie die Animation in coloring.css. */
const FIND_MS = 1400

const Parts = ({ region }: { region: Region }) => (
  <>{region.parts.map((part, i) => <path key={i} d={part.d} transform={part.transform} />)}</>
)
const clipOf = (region: Region) => (region.clipTo ? `url(#coloring-clip-${region.clipTo})` : undefined)

/**
 * Leuchtende Markierung über einer leeren Fläche – genau über dem Teil, den man sieht:
 * Was darüberliegende Flächen verdecken, schneidet eine Maske wieder heraus.
 */
function MissingGlow({ index }: { index: number }) {
  const region = REGIONS[index]
  const id = `coloring-missing-${region.id}`
  return (
    <g>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW.width} height={VIEW.height}>
        <g fill="#fff" stroke="#fff" strokeWidth="3" clipPath={clipOf(region)}><Parts region={region} /></g>
        {REGIONS.slice(index + 1).map((above) => (
          <g key={above.id} fill="#000" clipPath={clipOf(above)}><Parts region={above} /></g>
        ))}
      </mask>
      <g mask={`url(#${id})`} className="coloring-missing">
        <rect width={VIEW.width} height={VIEW.height} className="coloring-missing__fill" />
        <g className="coloring-missing__edge" clipPath={clipOf(region)}><Parts region={region} /></g>
      </g>
    </g>
  )
}

function RegionShape({ region, fill, onPaint }: {
  region: Region
  fill: string
  onPaint(id: string): void
}) {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onPaint(region.id)
  }
  return (
    <g
      className="coloring-region"
      fill={fill}
      clipPath={clipOf(region)}
      role="button"
      tabIndex={0}
      aria-label={region.label}
      onClick={() => onPaint(region.id)}
      onKeyDown={onKey}
    >
      <Parts region={region} />
    </g>
  )
}

export default function ColoringGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [colors, setColors] = useState<Coloring>(() => restoreColoring(savedState))
  const [brush, setBrush] = useState(4)
  const [highlight, setHighlight] = useState(0)
  const save = useEffectEvent(saveState)
  useEffect(() => { save({ colors }) }, [colors])
  useEffect(() => {
    if (!highlight) return
    const timeout = window.setTimeout(() => setHighlight(0), FIND_MS)
    return () => window.clearTimeout(timeout)
  }, [highlight])

  const done = isComplete(colors)
  const count = coloredCount(colors)

  const paint = (id: string) => {
    setColors((before) => ({ ...before, [id]: brush }))
  }

  const missing = REGIONS.length - count
  // Jeder Klick startet das Leuchten neu (auch wenn es gerade noch läuft).
  const showMissing = () => setHighlight((n) => n + 1)

  const clipped = REGIONS.filter((region) => REGIONS.some((other) => other.clipTo === region.id))

  return (
    <div className="coloring">
      <div className="coloring__canvas">
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="group" aria-label={`Ausmalbild Rentier, ${count} von ${REGIONS.length} Flächen bemalt`}>
          <defs>
            <pattern id="coloring-blank" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#fffdf8" />
              <circle cx="4" cy="4" r="0.9" fill="#e4dccd" />
            </pattern>
            {clipped.map((region) => (
              <clipPath key={region.id} id={`coloring-clip-${region.id}`}>
                {region.parts.map((part, i) => <path key={i} d={part.d} transform={part.transform} />)}
              </clipPath>
            ))}
          </defs>
          <g className="coloring__regions">
            {REGIONS.map((region) => (
              <RegionShape
                key={region.id}
                region={region}
                fill={colors[region.id] === undefined ? 'url(#coloring-blank)' : PALETTE[colors[region.id]].hex}
                onPaint={paint}
              />
            ))}
          </g>
          <g className="coloring__details" aria-hidden="true">
            {DETAILS.lines.map((d) => <path key={d} d={d} />)}
            {DETAILS.rings.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
          </g>
          <g className="coloring__shine" aria-hidden="true">
            {DETAILS.shine.map((d) => <path key={d} d={d} />)}
          </g>
          {highlight > 0 && (
            <g key={highlight} className="coloring__missing" aria-hidden="true">
              {REGIONS.map((region, index) => colors[region.id] === undefined && <MissingGlow key={region.id} index={index} />)}
            </g>
          )}
        </svg>
      </div>

      <div className="coloring__palette" role="radiogroup" aria-label="Farbe wählen">
        {PALETTE.map((color, index) => (
          <button
            key={color.hex}
            type="button"
            role="radio"
            aria-checked={brush === index}
            aria-label={color.name}
            className="coloring__swatch"
            style={{ background: color.hex }}
            onClick={() => setBrush(index)}
          />
        ))}
      </div>

      <p className="coloring__status" role="status">
        {done ? 'Wunderschön! Bereit für die Staffelei?' : `${count} von ${REGIONS.length} Flächen bemalt`}
      </p>

      <div className="coloring__actions">
        {!done && (
          <button type="button" className="button button--quiet" onClick={showMissing}>
            <span aria-hidden="true">✨</span> {missing === 1 ? 'Fehlende Fläche zeigen' : `${missing} fehlende Flächen zeigen`}
          </button>
        )}
        <button
          type="button"
          className="button"
          disabled={!done}
          onClick={() => {
            saveState({ colors })
            onComplete()
          }}
        >
          {completedBefore ? 'Bild aufhängen & Überraschung ansehen' : 'Fertig – Bild aufhängen'}
        </button>
      </div>
    </div>
  )
}
