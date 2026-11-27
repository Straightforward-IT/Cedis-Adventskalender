import type { CSSProperties } from 'react'
import { HEIGHT, HORIZON, POND, WIDTH } from './model.ts'
import type { Item } from './model.ts'

/*
 * Die Bausteine des Wimmelbilds. Jede Figur steht mit ihrem Fußpunkt auf (0, 0) und schaut
 * nach rechts; im Bild wird sie nur noch verschoben, skaliert und gespiegelt. Farben, die je
 * Figur wechseln (Jacke, Mütze, Geschenkpapier …), kommen als CSS-Variablen von außen.
 */

const OUTLINE = '#3a2a24'
const SNOW = '#ffffff'
const SHADOW = '#c4d2e8'
const FUR = '#8a5a36'
const FUR_DARK = '#6b4129'
const FUR_LIGHT = '#d8b58c'
const ANTLER = '#5a3a26'
const SKIN = '#f3c6a5'

const shadow = (rx: number) => <ellipse cx="0" cy="0" rx={rx} ry={rx * 0.2} fill={SHADOW} opacity="0.75" />

function Antlers({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  // Ein Geweih aus geschwungenen Ästen – das Erkennungszeichen, aber nur wer genau hinsieht …
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} fill="none" stroke={ANTLER} strokeWidth="3.4" strokeLinecap="round">
      <path d="M0 0q-4-14-14-22M-7-11q-11-3-14-12M-14-22q-2-8 2-14M-14-22q-8-4-13-2" />
      <path d="M6 0q2-16 12-24M9-12q10-4 12-14M18-24q-1-8 4-12M18-24q8-2 12 2" />
    </g>
  )
}

/**
 * Ein grasendes Rentier: Der Hals schwingt in einem Bogen aus der Brust hinunter, die Schnauze
 * steckt im Schnee, das Geweih ragt frei nach vorn-oben – weg vom Körper, damit man es erkennt.
 */
function GrazingReindeer() {
  return (
    <g>
      {shadow(56)}
      {/* Beine hinten (dunkler) */}
      <path d="M-30-48v46M18-48v46" stroke={FUR_DARK} strokeWidth="7" strokeLinecap="round" />
      {/* Hals: vom Widerrist in weitem Bogen bis zum Kopf am Boden */}
      <path d="M8-78C40-80 62-60 70-30L52-24C46-40 38-48 22-46Z" fill={FUR} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30-50C42-48 48-40 52-28" stroke={FUR_LIGHT} strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Körper deckt den Halsansatz ab */}
      <ellipse cx="-4" cy="-58" rx="44" ry="21" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
      <path d="M14-76C26-76 34-70 38-62L22-50Z" fill={FUR} />
      <ellipse cx="-2" cy="-46" rx="30" ry="8" fill={FUR_LIGHT} />
      <path d="M-22-46v44M28-46v44" stroke={FUR} strokeWidth="8" strokeLinecap="round" />
      <path d="M-22-4v3M28-4v3M-30-4v3M18-4v3" stroke="#2b1a12" strokeWidth="8" strokeLinecap="round" />
      <path d="M-46-64q-8-4-6 6q4 4 8-2Z" fill={SNOW} stroke={OUTLINE} strokeWidth="1.5" />
      {/* Rotes Halsband mit Glöckchen */}
      <path d="M40-66q8 8 4 22" stroke="#c2483c" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="40" cy="-44" r="3.6" fill="#e8b04a" stroke={OUTLINE} strokeWidth="1" />
      {/* Geweih zuerst, dann der Kopf davor */}
      <g fill="none" stroke={ANTLER} strokeLinecap="round" strokeWidth="3.4">
        <path d="M68-30q12-10 18-28M77-42q10 2 16-6M84-54q2-10-2-16M84-54q8-6 14-4" />
        <path d="M64-32q6-14 4-32M66-46q-8-6-8-14M68-62q-4-8 0-12" opacity="0.85" />
      </g>
      <path d="M58-30q8-14 18-12q-6 8-16 14Z" fill={FUR_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M52-32C64-38 74-30 70-16C67-6 62 0 54 0C46 0 44-8 46-16C47-24 48-29 52-32Z" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
      <ellipse cx="54" cy="-5" rx="9" ry="6" fill={FUR_LIGHT} />
      <ellipse cx="55" cy="-1" rx="4.5" ry="3.2" fill="#2b1a12" />
      <circle cx="63" cy="-20" r="2.6" fill="#2b1a12" />
      <circle cx="63.8" cy="-20.8" r="0.9" fill={SNOW} />
      {/* Ein Büschel Gras schaut aus dem Schnee */}
      <path d="M38 0q2-8 0-12M42 0q3-7 6-10M64 0q-1-8 2-11" stroke="#5f8a4a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <ellipse cx="54" cy="2" rx="22" ry="4" fill={SNOW} />
    </g>
  )
}

/** Ein Rentier von der Seite. `pose`: stehend, grasend oder liegend. */
function ReindeerBody({ pose, rudolph = false, skate = false }: { pose: 'stand' | 'graze' | 'rest'; rudolph?: boolean; skate?: boolean }) {
  const collar = (
    <g>
      <path d="M26-70q8 8 16 4" fill="none" stroke="#c2483c" strokeWidth="5" strokeLinecap="round" />
      <circle cx="35" cy="-63" r="3.6" fill="#e8b04a" stroke={OUTLINE} strokeWidth="1" />
    </g>
  )
  const nose = rudolph ? (
    <g>
      <circle cx="0" cy="0" r="13" fill="#ff5a4a" opacity="0.35" />
      <circle cx="0" cy="0" r="6" fill="#e0322a" />
      <circle cx="-2" cy="-2" r="2" fill="#ffb3a6" />
    </g>
  ) : (
    <ellipse cx="0" cy="0" rx="4.2" ry="3.4" fill="#2b1a12" />
  )
  if (pose === 'graze') return <GrazingReindeer />
  if (pose === 'rest') {
    return (
      <g>
        {shadow(52)}
        <ellipse cx="-4" cy="-20" rx="46" ry="20" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
        <ellipse cx="-4" cy="-12" rx="30" ry="9" fill={FUR_LIGHT} />
        <path d="M-30-4q10 4 22 2M6-3q12 3 26-1" stroke={FUR_DARK} strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="-48" cy="-26" r="6" fill={SNOW} />
        <path d="M24-30q10-14 18-30l14 4q-4 18-18 30Z" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
        <ellipse cx="50" cy="-62" rx="17" ry="11" fill={FUR} stroke={OUTLINE} strokeWidth="2" transform="rotate(12 50 -62)" />
        <ellipse cx="63" cy="-56" rx="8" ry="6" fill={FUR_LIGHT} />
        <g transform="translate(70 -56)">{nose}</g>
        <circle cx="48" cy="-66" r="2.6" fill="#2b1a12" />
        <path d="M38-70q-8-6-12-2q4 6 12 6" fill={FUR_DARK} />
        <Antlers x={46} y={-71} size={0.95} />
      </g>
    )
  }
  const head = (
      <g>
        <path d="M26-64q8-18 16-34l14 6q-6 18-16 34Z" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
        <ellipse cx="52" cy="-100" rx="18" ry="11" fill={FUR} stroke={OUTLINE} strokeWidth="2" transform="rotate(16 52 -100)" />
        <ellipse cx="66" cy="-94" rx="8" ry="6" fill={FUR_LIGHT} />
        <g transform="translate(72 -94)">{nose}</g>
        <circle cx="50" cy="-104" r="2.6" fill="#2b1a12" />
        <path d="M40-108q-9-6-13-2q4 6 13 6" fill={FUR_DARK} />
        <Antlers x={46} y={-110} />
      </g>
    )
  return (
    <g>
      {shadow(50)}
      {/* Beine hinten (dunkler), dann Körper, dann Beine vorn */}
      <path d="M-30-48v46M22-48v46" stroke={FUR_DARK} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="-2" cy="-58" rx="44" ry="21" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
      <ellipse cx="0" cy="-46" rx="30" ry="8" fill={FUR_LIGHT} />
      <path d="M-22-46v44M30-46v44" stroke={FUR} strokeWidth="8" strokeLinecap="round" />
      <path d="M-22-4v3M30-4v3M-30-4v3M22-4v3" stroke="#2b1a12" strokeWidth="8" strokeLinecap="round" />
      <path d="M-44-64q-8-4-6 6q4 4 8-2Z" fill={SNOW} stroke={OUTLINE} strokeWidth="1.5" />
      {head}
      {collar}
      {skate && (
        <g>
          {/* Schlittschuhe unter den Hufen und ein Ringelschal, der im Fahrtwind flattert */}
          <path d="M-40 3h20M-30 3q-4 0-6-3M12 3h22M22 3q-4 0-6-3" stroke="#8d99b3" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M24-74q10 10 22 2l-2 6q-12 6-20-2Z" fill="#2f6fa8" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M26-72q-14 2-26 12l4 5q12-8 22-10Z" fill="#2f6fa8" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M14-66l3 5M6-61l3 5" stroke="#fff4d6" strokeWidth="2.5" />
          <path d="M-60-30q10 2 16-2M-64-18q10 2 16-2" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        </g>
      )}
    </g>
  )
}

function Elf({ gift = false }: { gift?: boolean }) {
  return (
    <g>
      {shadow(16)}
      <path d="M-6-14v12M5-14v12" stroke="#7b2e2a" strokeWidth="5" strokeLinecap="round" />
      <path d="M-9-2h7M3-2h8" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <path d="M-12-14l4-24h16l4 24Z" fill="var(--coat)" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M-11-20h22" stroke={OUTLINE} strokeWidth="3" />
      <rect x="-2.5" y="-22.5" width="5" height="5" fill="#e8b04a" />
      {gift ? (
        <g>
          <path d="M-8-32l10 8M8-32l2 8" stroke="var(--coat)" strokeWidth="5" strokeLinecap="round" />
          <rect x="2" y="-30" width="16" height="14" fill="var(--paper)" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M10-30v14M2-23h16" stroke="var(--ribbon)" strokeWidth="2.6" />
          <path d="M10-30q-5-6-7-1q3 2 7 1q5-6 7-1q-3 2-7 1" fill="var(--ribbon)" />
        </g>
      ) : (
        <path d="M-9-34q-8 8-8 16M9-34q8 6 8 14" stroke="var(--coat)" strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
      <circle cx="0" cy="-45" r="9" fill={SKIN} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M-9-46l-5-5M9-46l5-5" stroke={SKIN} strokeWidth="4" strokeLinecap="round" />
      <circle cx="3" cy="-46" r="1.4" fill={OUTLINE} />
      <circle cx="-3" cy="-46" r="1.4" fill={OUTLINE} />
      <path d="M-10-51q2-14 16-20q-2 8 4 18Z" fill="var(--hat)" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M-11-51q11 4 22 0" stroke={SNOW} strokeWidth="4" strokeLinecap="round" />
      <circle cx="7" cy="-71" r="3.6" fill={SNOW} stroke={OUTLINE} strokeWidth="1" />
    </g>
  )
}

function Skater() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="16" ry="3" fill="#ffffff" opacity="0.6" />
      <path d="M-4-14l-8 12M5-14l3 12" stroke="#2f3f5f" strokeWidth="5" strokeLinecap="round" />
      <path d="M-17-1h9M3 0h10" stroke="#9aa7bf" strokeWidth="2" strokeLinecap="round" />
      <path d="M-10-14l6-24h14l2 24Z" fill="var(--coat)" stroke={OUTLINE} strokeWidth="1.5" transform="rotate(10 0 -14)" />
      <path d="M-6-34l-16-6M10-32l16 4" stroke="var(--coat)" strokeWidth="5" strokeLinecap="round" />
      <path d="M-4-38q8 4 14 0l6 10" stroke="var(--hat)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx="4" cy="-46" r="9" fill={SKIN} stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="7" cy="-47" r="1.4" fill={OUTLINE} />
      <path d="M-5-51q4-14 18-14q-2 6 0 14Z" fill="var(--hat)" stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="14" cy="-66" r="3.4" fill={SNOW} />
    </g>
  )
}

/** Alle Figuren als wiederverwendbare Vorlagen – das Bild selbst sind nur noch Verweise darauf. */
export function WimmelDefs() {
  return (
    <defs>
      <linearGradient id="wb-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5d6fb0" />
        <stop offset="0.55" stopColor="#a9b9e0" />
        <stop offset="1" stopColor="#f2d9d4" />
      </linearGradient>
      <linearGradient id="wb-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e7eefa" />
        <stop offset="1" stopColor="#ffffff" />
      </linearGradient>
      <radialGradient id="wb-ice" cx="45%" cy="40%" r="70%">
        <stop offset="0" stopColor="#e6f6ff" />
        <stop offset="1" stopColor="#9fcbe6" />
      </radialGradient>
      <radialGradient id="wb-glow">
        <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffe3a0" stopOpacity="0" />
      </radialGradient>

      <g id="wb-fir">
        {shadow(40)}
        <rect x="-6" y="-20" width="12" height="20" fill="#6b4129" />
        <path d="M0-132L-26-90h12L-40-52h15L-52-16h104L25-52h15L14-90h12Z" fill="#2f5f4a" stroke="#1f4436" strokeWidth="2" strokeLinejoin="round" />
        <path d="M0-132l-13 22q7-5 13 1q6-6 13-1Z" fill={SNOW} />
        <path d="M-24-90q12 7 24 0q12 7 24 0M-38-52q19 9 38 0q19 9 38 0M-50-16q25 9 50 0q25 9 50 0" stroke={SNOW} strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
      <g id="wb-bareTree">
        {shadow(28)}
        <g fill="none" stroke="#6b4a32" strokeLinecap="round">
          <path d="M0 0V-70" strokeWidth="9" />
          <path d="M0-40q-18-10-26-30M0-58q14-12 18-34M-14-55q-10-4-16-16M10-78q10-2 16-14M0-70q-4-20 2-36" strokeWidth="5" />
          <path d="M-26-70q-2-10 4-16M18-92q-2-8 4-12M2-106q-6-6-4-14" strokeWidth="3" />
        </g>
        <path d="M-30-71q4-3 8 0M14-93q4-3 8 0M-2-107q4-3 8 0" stroke={SNOW} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g id="wb-bush">
        {shadow(30)}
        <ellipse cx="-12" cy="-14" rx="18" ry="14" fill="#3f6f57" />
        <ellipse cx="12" cy="-14" rx="18" ry="14" fill="#356049" />
        <ellipse cx="0" cy="-22" rx="18" ry="16" fill="#3f6f57" />
        <path d="M-26-20q8-10 16-6q6-14 18-6q12-6 18 8q-26 6-52 4Z" fill={SNOW} />
        <circle cx="-8" cy="-10" r="2.5" fill="#c2483c" /><circle cx="10" cy="-8" r="2.5" fill="#c2483c" />
      </g>
      <g id="wb-rock">
        {shadow(26)}
        <path d="M-26 0q-4-22 10-30q14-10 28 0q14 10 12 30Z" fill="#8c95ab" stroke="#5f6880" strokeWidth="2" />
        <path d="M-20-22q10-12 24-10q12 2 18 10q-20-4-42 0Z" fill={SNOW} />
      </g>
      <g id="wb-cottage">
        {shadow(80)}
        <rect x="-56" y="-78" width="112" height="78" fill="var(--wall)" stroke={OUTLINE} strokeWidth="2" />
        <rect x="26" y="-128" width="16" height="34" fill="#7a4b3a" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-70-74L0-134L70-74Z" fill="#5a3a2e" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
        <path d="M-74-72L0-138L74-72q-8 8-16 2q-8 8-18 0q-10 8-20 0q-10 8-20 0q-10 8-20 0q-10 8-20 0q-8 6-16-2Z" fill={SNOW} opacity="0.95" />
        <rect x="24" y="-132" width="20" height="8" fill={SNOW} rx="4" />
        <rect x="-12" y="-44" width="24" height="44" fill="#6b4129" stroke={OUTLINE} strokeWidth="2" />
        <circle cx="6" cy="-22" r="2" fill="#e8b04a" />
        <rect x="-46" y="-60" width="24" height="22" fill="#ffd77a" stroke={OUTLINE} strokeWidth="2" />
        <rect x="22" y="-60" width="24" height="22" fill="#ffd77a" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-34-60v22M-46-49h24M34-60v22M22-49h24" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M-48-38h28M20-38h28" stroke={SNOW} strokeWidth="4" strokeLinecap="round" />
      </g>
      <g id="wb-elf"><Elf /></g>
      <g id="wb-elfGift"><Elf gift /></g>
      <g id="wb-skater"><Skater /></g>
      <g id="wb-snowman">
        {shadow(26)}
        <circle cx="0" cy="-22" r="22" fill={SNOW} stroke="#b9c6dc" strokeWidth="2" />
        <circle cx="0" cy="-56" r="16" fill={SNOW} stroke="#b9c6dc" strokeWidth="2" />
        <circle cx="0" cy="-82" r="12" fill={SNOW} stroke="#b9c6dc" strokeWidth="2" />
        <path d="M-12-70q12 6 24 0l4 14" stroke="#c2483c" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M2-82l14 3l-14 3Z" fill="#f08a3c" />
        <circle cx="-4" cy="-86" r="1.8" fill={OUTLINE} /><circle cx="5" cy="-86" r="1.8" fill={OUTLINE} />
        <rect x="-11" y="-108" width="22" height="16" fill="#2b2b33" />
        <rect x="-16" y="-94" width="32" height="4" fill="#2b2b33" />
        <path d="M-16-56l-20-10M16-56l20-12" stroke="#6b4a32" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="-58" r="2" fill={OUTLINE} /><circle cx="0" cy="-48" r="2" fill={OUTLINE} />
      </g>
      <g id="wb-gift">
        {shadow(18)}
        <rect x="-15" y="-26" width="30" height="26" fill="var(--paper)" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="-17" y="-32" width="34" height="8" fill="var(--paper)" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M0-32V0" stroke="var(--ribbon)" strokeWidth="5" />
        <path d="M0-32q-12-12-14-2q4 4 14 2q12-12 14-2q-4 4-14 2" fill="var(--ribbon)" stroke={OUTLINE} strokeWidth="1" />
      </g>
      <g id="wb-sled">
        {shadow(30)}
        <path d="M-30-2h56q10 0 10-10" stroke="#8a5a36" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M-20-2v-8M16-2v-8" stroke="#8a5a36" strokeWidth="3" />
        <rect x="-28" y="-16" width="50" height="7" rx="3" fill="#c2483c" stroke={OUTLINE} strokeWidth="1.5" />
        <g transform="translate(-4 -14) scale(0.85)">
          <path d="M-10 0l4-22h16l4 22Z" fill="var(--coat)" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M6-6h16" stroke="#7b2e2a" strokeWidth="6" strokeLinecap="round" />
          <path d="M8-16l16 8" stroke="var(--coat)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="2" cy="-30" r="9" fill={SKIN} stroke={OUTLINE} strokeWidth="1.5" />
          <circle cx="5" cy="-31" r="1.4" fill={OUTLINE} />
          <path d="M-8-35q0-14 18-16q-4 8 0 16Z" fill="var(--hat)" stroke={OUTLINE} strokeWidth="1.5" />
        </g>
      </g>
      <g id="wb-lantern">
        <circle cx="0" cy="-72" r="26" fill="url(#wb-glow)" />
        {shadow(10)}
        <path d="M0 0V-62" stroke="#2f3446" strokeWidth="5" />
        <path d="M-8-64h16l-3-16h-10Z" fill="#ffd77a" stroke="#2f3446" strokeWidth="2.5" />
        <path d="M-10-80h20l-10-8Z" fill="#2f3446" />
        <path d="M-9-82q9-6 18 0" stroke={SNOW} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g id="wb-dog">
        {shadow(24)}
        <path d="M-16-14v12M-8-14v12M10-14v12M16-14v12" stroke="var(--fur)" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="0" cy="-20" rx="22" ry="10" fill="var(--fur)" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M-20-24q-10-8-6-16" stroke="var(--fur)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="22" cy="-32" rx="10" ry="8" fill="var(--fur)" stroke={OUTLINE} strokeWidth="1.5" />
        <ellipse cx="31" cy="-29" rx="5" ry="4" fill="var(--fur)" />
        <circle cx="35" cy="-30" r="2.2" fill={OUTLINE} />
        <path d="M17-38q-4 10 2 12" fill={OUTLINE} opacity="0.6" />
        <circle cx="23" cy="-34" r="1.5" fill={OUTLINE} />
        <path d="M10-24q6 4 14 2" stroke="#c2483c" strokeWidth="3" fill="none" />
      </g>
      <g id="wb-horse">
        {shadow(50)}
        <path d="M-30-48v46M22-48v46" stroke="#4d3220" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="-2" cy="-60" rx="44" ry="22" fill="var(--fur)" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-22-46v44M30-46v44" stroke="var(--fur)" strokeWidth="8" strokeLinecap="round" />
        <path d="M-22-4v3M30-4v3M-30-4v3M22-4v3" stroke="#2b1a12" strokeWidth="8" strokeLinecap="round" />
        <path d="M-44-64q-14 10-12 36q8-12 10-30Z" fill="#3a2418" />
        <path d="M26-70q8-18 16-36l14 4q-4 22-14 38Z" fill="var(--fur)" stroke={OUTLINE} strokeWidth="2" />
        <path d="M30-72q4-20 14-36l-8-2q-12 16-14 34Z" fill="#3a2418" />
        <path d="M44-112q20 4 30 22q-2 8-12 6q-12-8-24-12Z" fill="var(--fur)" stroke={OUTLINE} strokeWidth="2" />
        <circle cx="52" cy="-102" r="2.6" fill="#2b1a12" />
        <path d="M42-112l2-10l6 8" fill="var(--fur)" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="-6" y="-86" width="30" height="8" rx="3" fill="#2f6fa8" stroke={OUTLINE} strokeWidth="1.5" />
      </g>
      <g id="wb-fox">
        {shadow(22)}
        <path d="M-14-12v11M-6-12v11M8-12v11M14-12v11" stroke="#2b1a12" strokeWidth="4" strokeLinecap="round" />
        <path d="M-18-16q-22-2-26-16q14 6 24 4Z" fill="#e07a3a" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M-40-28q-4-4-4-6q6 2 8 4Z" fill={SNOW} />
        <ellipse cx="0" cy="-18" rx="18" ry="9" fill="#e07a3a" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M14-24l18-6l-4 10q-8 6-14 2Z" fill="#e07a3a" stroke={OUTLINE} strokeWidth="1.5" />
        <path d="M18-28l2-10l6 8M24-30l4-8l3 9" fill="#e07a3a" stroke={OUTLINE} strokeWidth="1.2" />
        <path d="M20-20q6 2 10-2" stroke={SNOW} strokeWidth="3" />
        <circle cx="32" cy="-27" r="1.8" fill={OUTLINE} />
        <circle cx="22" cy="-27" r="1.4" fill={OUTLINE} />
      </g>
      <g id="wb-rabbit">
        {shadow(12)}
        <ellipse cx="0" cy="-9" rx="12" ry="9" fill="#f4f6fb" stroke="#9aa7bf" strokeWidth="1.5" />
        <circle cx="-11" cy="-10" r="3.5" fill={SNOW} stroke="#9aa7bf" strokeWidth="1" />
        <circle cx="10" cy="-17" r="6.5" fill="#f4f6fb" stroke="#9aa7bf" strokeWidth="1.5" />
        <path d="M8-22q-2-12 2-16q3 6 1 16M12-22q2-12 7-14q0 8-4 15" fill="#f4f6fb" stroke="#9aa7bf" strokeWidth="1.2" />
        <circle cx="13" cy="-18" r="1.4" fill={OUTLINE} />
        <circle cx="16" cy="-16" r="1.2" fill="#e98b9d" />
      </g>
      <g id="wb-penguin">
        {shadow(14)}
        <ellipse cx="0" cy="-18" rx="12" ry="18" fill="#26283a" />
        <ellipse cx="2" cy="-16" rx="8" ry="13" fill={SNOW} />
        <circle cx="1" cy="-38" r="9" fill="#26283a" />
        <circle cx="4" cy="-39" r="2.6" fill={SNOW} /><circle cx="4.6" cy="-39" r="1.2" fill={OUTLINE} />
        <path d="M9-37l7 2l-7 2Z" fill="#f2a63a" />
        <path d="M-6 0h6M2 0h6" stroke="#f2a63a" strokeWidth="3" strokeLinecap="round" />
        <path d="M-8-32q8 4 18 0" stroke="#c2483c" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g id="wb-bear">
        {shadow(40)}
        <path d="M-26-20v18M-12-20v18M14-20v18M26-20v18" stroke="var(--fur)" strokeWidth="11" strokeLinecap="round" />
        <ellipse cx="0" cy="-34" rx="38" ry="24" fill="var(--fur)" stroke={OUTLINE} strokeWidth="2" />
        <circle cx="38" cy="-46" r="16" fill="var(--fur)" stroke={OUTLINE} strokeWidth="2" />
        <circle cx="32" cy="-62" r="6" fill="var(--fur)" stroke={OUTLINE} strokeWidth="1.5" />
        <ellipse cx="50" cy="-42" rx="8" ry="6" fill="#c9a27a" />
        <circle cx="56" cy="-44" r="3" fill={OUTLINE} />
        <circle cx="42" cy="-50" r="2" fill={OUTLINE} />
        <path d="M-30-54q20-10 44-6" stroke={SNOW} strokeWidth="5" strokeLinecap="round" />
      </g>
      <g id="wb-woodpile">
        {shadow(40)}
        {[[-24, -10], [-8, -10], [8, -10], [24, -10], [-16, -26], [0, -26], [16, -26], [-8, -42], [8, -42]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="8.5" fill="#a06a3e" stroke="#5a3a26" strokeWidth="2" />
            <circle cx={x} cy={y} r="3.5" fill="none" stroke="#d8b58c" strokeWidth="1.5" />
          </g>
        ))}
        <path d="M-6-50q-6-14-16-18M-12-58q-10 0-14-6M6-50q4-14 16-18M12-60q10-2 12-8" stroke="#5a3a26" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M-16-50q16-8 32 0" stroke={SNOW} strokeWidth="5" strokeLinecap="round" />
      </g>
      <g id="wb-stall">
        {shadow(70)}
        <rect x="-60" y="-96" width="6" height="96" fill="#6b4129" />
        <rect x="54" y="-96" width="6" height="96" fill="#6b4129" />
        <rect x="-62" y="-44" width="124" height="44" fill="#a06a3e" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-62-44h124" stroke={SNOW} strokeWidth="5" strokeLinecap="round" />
        {[-48, -24, 0, 24, 48].map((x, i) => (
          <circle key={x} cx={x} cy="-52" r="7" fill={['#c2483c', '#e8b04a', '#3f6f57', '#e872a8', '#2f6fa8'][i]} stroke={OUTLINE} strokeWidth="1" />
        ))}
        <path d="M-72-96h144l-8 22h-128Z" fill="var(--awning)" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-50-96l-6 22M-22-96l-4 22M6-96l-2 22M34-96l2 22M60-96l4 22" stroke={SNOW} strokeWidth="9" opacity="0.85" />
        <path d="M-74-98h148q-10-12-74-18q-64 6-74 18Z" fill={SNOW} />
        <path d="M-64-74q32 10 64 0q32 10 64 0" stroke="#ffd77a" strokeWidth="2" fill="none" strokeDasharray="1 7" strokeLinecap="round" />
      </g>
      <g id="wb-sleigh">
        {shadow(110)}
        <path d="M-96-6h170q22 0 26-24" stroke="#c9a24a" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M-70-6v-14M40-6v-14" stroke="#c9a24a" strokeWidth="5" />
        <path d="M-96-46q-60 6-122-8" stroke="#6b4129" strokeWidth="3" fill="none" />
        <path d="M-100-80q-6 40 10 60h140q30 0 40-30q-30 4-50-10l-10-30q-50 6-130 10Z" fill="#c2483c" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
        <path d="M-92-34q60 10 130 0" stroke="#e8b04a" strokeWidth="5" fill="none" />
        <circle cx="-70" cy="-100" r="26" fill="#8a5a36" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-90-110q20-16 40 0" stroke="#e8b04a" strokeWidth="4" fill="none" />
        <rect x="-102" y="-110" width="18" height="16" fill="#3f6f57" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="-60" y="-116" width="16" height="14" fill="#2f6fa8" stroke={OUTLINE} strokeWidth="1.5" />
        {/* Santa sitzt vorn und schaut ratlos nach seinen Rentieren */}
        <path d="M-30-80q0-40 24-44q24 4 24 44Z" fill="#c2483c" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-30-82h48" stroke={SNOW} strokeWidth="7" strokeLinecap="round" />
        <circle cx="-6" cy="-136" r="15" fill={SKIN} stroke={OUTLINE} strokeWidth="2" />
        <path d="M-22-134q0 26 16 28q16-2 16-28q-8 6-16 4q-8 2-16-4Z" fill={SNOW} stroke="#c9d3e6" strokeWidth="1.5" />
        <circle cx="-1" cy="-140" r="2" fill={OUTLINE} /><circle cx="-11" cy="-140" r="2" fill={OUTLINE} />
        <path d="M-22-146q4-22 28-20q12 8 10 22Z" fill="#c2483c" stroke={OUTLINE} strokeWidth="2" />
        <path d="M-24-146h40" stroke={SNOW} strokeWidth="6" strokeLinecap="round" />
        <circle cx="20" cy="-160" r="5" fill={SNOW} />
        <path d="M14-104q16-12 24-30" stroke="#c2483c" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="39" cy="-136" r="6" fill="#3f6f57" stroke={OUTLINE} strokeWidth="1.5" />
      </g>
      <g id="wb-reindeer"><ReindeerBody pose="stand" /></g>
      <g id="wb-reindeerGraze"><ReindeerBody pose="graze" /></g>
      <g id="wb-reindeerRest"><ReindeerBody pose="rest" /></g>
      <g id="wb-reindeerSkate"><ReindeerBody pose="stand" skate /></g>
      <g id="wb-rudolph"><ReindeerBody pose="stand" rudolph /></g>
    </defs>
  )
}

/** Himmel, Berge, Hügel, Wege und der Eisweiher – alles, was hinter den Figuren liegt. */
export function WimmelBackdrop() {
  const stars = Array.from({ length: 60 }, (_, i) => {
    const x = (i * 977) % WIDTH
    const y = 30 + ((i * 431) % 300)
    return <circle key={i} cx={x} cy={y} r={1.2 + (i % 3) * 0.8} fill="#fff" opacity={0.4 + (i % 4) * 0.12} />
  })
  return (
    <g aria-hidden="true">
      <rect x="0" y="0" width={WIDTH} height={HORIZON + 80} fill="url(#wb-sky)" />
      {stars}
      <path d="M0 180q500-90 1000-20t1100-40t900 60" stroke="#8ff0c8" strokeWidth="60" opacity="0.18" fill="none" />
      <path d="M0 240q600-80 1200-10t1000-50t800 40" stroke="#b28cf0" strokeWidth="40" opacity="0.14" fill="none" />
      <circle cx="2620" cy="160" r="70" fill="#fff7dc" />
      <circle cx="2650" cy="140" r="64" fill="#a2b2df" opacity="0.55" />
      <path
        d={`M0 ${HORIZON - 40}L180 330L320 450L520 280L700 460L880 340L1080 480L1260 300L1460 470L1680 320L1900 480L2100 350L2300 460L2500 300L2720 470L2880 380L${WIDTH} 440V${HORIZON + 80}H0Z`}
        fill="#8796c4"
      />
      <path d="M180 330l-40 50l22-6l18 22l20-30l16 10ZM520 280l-44 60l24-8l20 20l20-28l18 10ZM1260 300l-46 60l24-8l22 22l18-30l20 10ZM1680 320l-40 52l22-8l18 22l20-26l18 8ZM2500 300l-44 58l22-8l22 22l18-28l20 10Z" fill="#eef3ff" />
      <path d={`M0 ${HORIZON}q300-70 700-30t800-20t800 30t700-40V${HORIZON + 120}H0Z`} fill="#d8e2f4" />
      <rect x="0" y={HORIZON + 40} width={WIDTH} height={HEIGHT - HORIZON - 40} fill="url(#wb-ground)" />
      <path d={`M0 ${HORIZON + 60}q400-40 900 0t1000-10t1100 10V${HORIZON + 140}H0Z`} fill="#e7eefa" />
      {/* Wege durchs Bild */}
      <path d="M1500 2000q-60-180 20-330q60-120 0-240M1500 1430q300-120 700-60q300 50 800-30M1500 1100q-200-120-600-80q-400 40-900-40M1500 1100q60-140 320-240" stroke="#dde5f3" strokeWidth="46" fill="none" strokeLinecap="round" />
      <path d="M1500 2000q-60-180 20-330q60-120 0-240M1500 1430q300-120 700-60q300 50 800-30M1500 1100q-200-120-600-80q-400 40-900-40M1500 1100q60-140 320-240" stroke="#f4f7fd" strokeWidth="30" fill="none" strokeLinecap="round" />
      {/* Eisweiher mit Kratzspuren der Schlittschuhe */}
      <ellipse cx={POND.cx} cy={POND.cy + 10} rx={POND.rx + 20} ry={POND.ry + 16} fill="#cfdbee" />
      <ellipse cx={POND.cx} cy={POND.cy} rx={POND.rx} ry={POND.ry} fill="url(#wb-ice)" stroke="#86b4d6" strokeWidth="4" />
      <path d="M1250 1240q120-60 260-20t250 0M1300 1300q160 30 360-10M1400 1180q100-30 220 0" stroke="#ffffff" strokeWidth="3" opacity="0.7" fill="none" />
    </g>
  )
}

function colorStyle(colors: Record<string, string> | undefined): CSSProperties | undefined {
  if (!colors) return undefined
  return Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--${key}`, value])) as CSSProperties
}

export function WimmelItem({ item }: { item: Item }) {
  const sx = item.flip ? -item.scale : item.scale
  return (
    <use
      href={`#wb-${item.kind}`}
      transform={`translate(${item.x.toFixed(1)} ${item.y.toFixed(1)}) scale(${sx.toFixed(3)} ${item.scale.toFixed(3)})`}
      style={colorStyle(item.colors)}
    />
  )
}

/** Leichter Schneefall vorn drüber – er macht das Suchen ein klein wenig kniffliger. */
export function WimmelSnow() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {Array.from({ length: 140 }, (_, i) => (
        <circle key={i} cx={(i * 613) % WIDTH} cy={(i * 1597) % HEIGHT} r={2 + (i % 4)} fill="#fff" opacity="0.75" />
      ))}
    </g>
  )
}
