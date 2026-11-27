import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { MinigameProps } from '../../types.ts'
import { ChimneyScene } from './ChimneyScene.ts'
import type { ChimneyCue } from './ChimneyScene.ts'
import { interact, ITEM_LABEL, restoreRoom, tasks } from './model.ts'
import type { Effect, Item, RoomState, Target } from './model.ts'
import './chimney.css'

type Stage = 'intro' | 'room'

const ROOM = { width: 720, height: 440 }
const FLOOR_Y = 300

const ITEM_ICON: Record<Item, string> = { cookies: '🍪', treats: '🐟', wine: '🍷' }

/** Ein antippbarer Gegenstand – Maus, Finger oder Tastatur. */
function Hit({ target, label, onAct, children, disabled = false }: {
  target: Target
  label: string
  onAct(target: Target): void
  children: ReactNode
  disabled?: boolean
}) {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onAct(target)
  }
  return (
    <g
      className="room-hit"
      data-target={target}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => !disabled && onAct(target)}
      onKeyDown={onKey}
    >
      {children}
    </g>
  )
}

/** Die Katze – orange getigert mit weißer Brust. Sitzend vor der Balkontür oder eingerollt auf dem Teppich. */
function Cat({ fed, mood }: { fed: boolean; mood: 'idle' | 'meow' | 'eat' }) {
  if (fed) {
    return (
      <g className="room-cat room-cat--sleep" transform="translate(470 388)">
        <ellipse cx="0" cy="4" rx="40" ry="8" fill="rgb(60 30 20 / 0.2)" />
        <ellipse cx="0" cy="-10" rx="38" ry="20" fill="#e0883a" />
        <path d="M-30 -18q12 -10 24 -2M-8 -26q12 -8 22 0M14 -22q10 -6 18 2" fill="none" stroke="#b9612a" strokeWidth="4" strokeLinecap="round" />
        <path d="M36 -4q16 6 2 16q-30 8 -62 -2" fill="none" stroke="#e0883a" strokeWidth="9" strokeLinecap="round" />
        <circle cx="-30" cy="-8" r="15" fill="#e0883a" />
        <path d="M-42 -18l4 -14l8 10M-26 -20l6 -12l4 13" fill="#e0883a" />
        <path d="M-37 -9q4 3 8 0M-27 -9q4 3 8 0" fill="none" stroke="#3a2418" strokeWidth="2" strokeLinecap="round" />
        <text className="room-zzz" x="-14" y="-38">z</text>
        <text className="room-zzz room-zzz--2" x="-2" y="-50">z</text>
      </g>
    )
  }
  return (
    <g className="room-cat" data-mood={mood} transform="translate(646 300)">
      <ellipse cx="0" cy="0" rx="30" ry="6" fill="rgb(60 30 20 / 0.2)" />
      {/* Schwanz um die Pfoten gelegt */}
      <path className="room-cat__tail" d="M18 -6q34 -4 22 -34" fill="none" stroke="#e0883a" strokeWidth="9" strokeLinecap="round" />
      <path d="M-24 -2q-4 -46 24 -52q28 6 24 52Z" fill="#e0883a" />
      <path d="M-10 -2q-2 -30 10 -34q12 4 10 34Z" fill="#fff4e6" />
      <path d="M-18 -30q4 -6 8 -2M10 -32q6 -4 8 2" fill="none" stroke="#b9612a" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="-10" cy="-2" rx="7" ry="4" fill="#fff4e6" />
      <ellipse cx="10" cy="-2" rx="7" ry="4" fill="#fff4e6" />
      {/* Kopf */}
      <g className="room-cat__head">
        <circle cx="0" cy="-64" r="20" fill="#e0883a" />
        <path d="M-18 -72l2 -20l12 12ZM18 -72l-2 -20l-12 12Z" fill="#e0883a" />
        <path d="M-14 -76l1 -10l6 6ZM14 -76l-1 -10l-6 6Z" fill="#f2a6a0" />
        <path d="M-6 -80v-6M0 -81v-6M6 -80v-6" stroke="#b9612a" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="0" cy="-56" rx="9" ry="7" fill="#fff4e6" />
        {mood === 'eat' ? (
          <path d="M-11 -66q4 -4 8 0M3 -66q4 -4 8 0" fill="none" stroke="#3a2418" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="-7" cy="-66" rx="3.6" ry="4.6" fill="#3f8a4f" />
            <ellipse cx="7" cy="-66" rx="3.6" ry="4.6" fill="#3f8a4f" />
            <ellipse cx="-7" cy="-66" rx="1.3" ry="3.6" fill="#1d1410" />
            <ellipse cx="7" cy="-66" rx="1.3" ry="3.6" fill="#1d1410" />
          </>
        )}
        <path d="M-2 -59h4l-2 3Z" fill="#e26b6b" />
        <path d="M-4 -53q4 3 8 0M-10 -58h-12M-10 -55l-11 3M10 -58h12M10 -55l11 3" fill="none" stroke="#7a4a2a" strokeWidth="1.2" strokeLinecap="round" />
        {mood === 'meow' && <ellipse cx="0" cy="-51" rx="3" ry="3.4" fill="#7a2f28" />}
      </g>
      {mood === 'meow' && <text className="room-bubble" x="-58" y="-92">Miau!</text>}
      {mood === 'eat' && (
        <g>
          <ellipse cx="-34" cy="0" rx="16" ry="5" fill="#3f6fb5" />
          <text className="room-bubble" x="-82" y="-94">Mjam ♥</text>
        </g>
      )}
    </g>
  )
}

function Room({ state, effect, onAct }: { state: RoomState; effect: { kind: Effect; n: number } | null; onAct(target: Target): void }) {
  const hasItem = (item: Item) => state.items.includes(item)
  const catMood = effect?.kind === 'eat' ? 'eat' : effect?.kind === 'meow' ? 'meow' : 'idle'
  return (
    <svg className="room" viewBox={`0 0 ${ROOM.width} ${ROOM.height}`} role="group" aria-label="Gemütliches Wohnzimmer mit Kamin, Sofa, Weihnachtsbaum, Anrichte und Balkontür">
      <defs>
        <pattern id="room-wallpaper" width="36" height="36" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" fill="#a8473c" />
          <path d="M18 6l3 7l7 1l-5 5l1 7l-6 -3l-6 3l1 -7l-5 -5l7 -1Z" fill="#b55a4c" />
        </pattern>
        <linearGradient id="room-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2350" />
          <stop offset="1" stopColor="#4b4a8c" />
        </linearGradient>
        <linearGradient id="room-cold" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="rgb(205 225 255 / 0.45)" />
          <stop offset="1" stopColor="rgb(205 225 255 / 0)" />
        </linearGradient>
        <radialGradient id="room-warm" cx="20%" cy="70%" r="70%">
          <stop offset="0" stopColor="rgb(255 190 110 / 0.35)" />
          <stop offset="1" stopColor="rgb(255 190 110 / 0)" />
        </radialGradient>
      </defs>

      {/* Wand, Holzvertäfelung, Dielen, Teppich */}
      <rect width={ROOM.width} height={FLOOR_Y} fill="url(#room-wallpaper)" />
      <rect y="232" width={ROOM.width} height={FLOOR_Y - 232} fill="#6b3f2a" />
      <rect y="228" width={ROOM.width} height="8" fill="#8a5a36" />
      <rect y={FLOOR_Y} width={ROOM.width} height={ROOM.height - FLOOR_Y} fill="#8a5a36" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 84 + 30} y={FLOOR_Y} width="3" height={ROOM.height - FLOOR_Y} fill="#744a2c" />)}
      <rect y={FLOOR_Y} width={ROOM.width} height="6" fill="#5c3720" />
      <ellipse cx="400" cy="384" rx="200" ry="44" fill="#2f6d3d" />
      <ellipse cx="400" cy="384" rx="176" ry="34" fill="none" stroke="#e8b04a" strokeWidth="3" strokeDasharray="10 8" />

      {/* Bild an der Wand */}
      <rect x="306" y="56" width="104" height="76" rx="4" fill="#6b4a33" />
      <rect x="314" y="64" width="88" height="60" fill="#dce8f5" />
      <path d="M314 124l26 -30l18 18l14 -12l30 24Z" fill="#7d9a78" />
      <circle cx="384" cy="80" r="7" fill="#f5d04a" />

      {/* Kamin – hier ist man gerade herausgepurzelt */}
      <rect x="28" y="120" width="176" height="180" fill="#b9ada3" />
      {Array.from({ length: 6 }, (_, row) => Array.from({ length: 4 }, (_, col) => (
        <rect key={`${row}-${col}`} x={30 + col * 44 + (row % 2) * 18} y={124 + row * 29} width="38" height="24" rx="2" fill="#a99c92" />
      )))}
      <rect x="18" y="108" width="196" height="16" rx="3" fill="#6b4a33" />
      <path d="M64 300V214q52 -48 104 0V300Z" fill="#1d1210" />
      <ellipse cx="116" cy="294" rx="40" ry="7" fill="#e4572e" opacity="0.7" />
      <ellipse cx="116" cy="292" rx="22" ry="4" fill="#ffd23f" opacity="0.8" />
      <g className="room-soot">
        {[[-30, 0], [0, -14], [26, -4], [-12, -30], [14, -34]].map(([dx, dy], i) => (
          <circle key={i} cx={116 + dx} cy={270 + dy} r="18" fill="#6f6868" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </g>
      {/* Strümpfe am Sims */}
      {[52, 106, 160].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 124v26q0 10 -12 12q-8 2 -6 -8q2 -6 10 -6v-24Z`} fill={['#d33b33', '#3f8a4f', '#3f6fb5'][i]} />
          <rect x={x - 8} y="122" width="14" height="8" rx="2" fill="#fff8ee" />
        </g>
      ))}
      <path d="M20 108q48 14 96 0t96 0" fill="none" stroke="#2f6d3d" strokeWidth="7" strokeLinecap="round" />

      {/* Weihnachtsbaum */}
      <g>
        <rect x="236" y="276" width="14" height="24" fill="#6b4a33" />
        <path d="M243 120l-42 70h18l-30 50h20l-26 40h120l-26 -40h20l-30 -50h18Z" fill="#2f6d3d" />
        {[[230, 186, '#d33b33'], [258, 200, '#f5d04a'], [222, 236, '#3f6fb5'], [266, 248, '#d33b33'], [244, 268, '#f5d04a'], [212, 272, '#e26bb0']].map(([x, y, c]) => (
          <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="6" fill={c as string} />
        ))}
        <path d="M243 106l4 9h10l-8 6l3 10l-9 -6l-9 6l3 -10l-8 -6h10Z" fill="#f5d04a" />
        <rect x="270" y="280" width="26" height="20" rx="2" fill="#d33b33" />
        <rect x="281" y="280" width="4" height="20" fill="#f5d04a" />
      </g>

      {/* Sofa */}
      <rect x="306" y="196" width="168" height="62" rx="18" fill="#3f6f57" />
      <rect x="300" y="240" width="180" height="48" rx="14" fill="#4d8467" />
      <rect x="292" y="226" width="26" height="66" rx="12" fill="#3f6f57" />
      <rect x="462" y="226" width="26" height="66" rx="12" fill="#3f6f57" />
      <rect x="326" y="212" width="44" height="34" rx="10" fill="#e8b04a" transform="rotate(-8 348 229)" />
      <rect x="306" y="288" width="8" height="12" fill="#3a2418" />
      <rect x="466" y="288" width="8" height="12" fill="#3a2418" />

      {/* Anrichte: oben Schublade (Leckerli), unten Vitrine mit Glastür (Wein) */}
      <rect x="500" y="196" width="100" height="104" rx="4" fill="#7a4b2e" />
      <rect x="496" y="190" width="108" height="10" rx="3" fill="#5c3720" />
      <rect x="512" y="296" width="8" height="8" fill="#3a2418" />
      <rect x="580" y="296" width="8" height="8" fill="#3a2418" />
      {/* Kerze und Schale obendrauf */}
      <rect x="510" y="168" width="10" height="22" rx="2" fill="#fff8ee" />
      <path d="M515 158q5 6 0 10q-5 -4 0 -10Z" fill="#ffd23f" />
      <ellipse cx="572" cy="186" rx="18" ry="6" fill="#c8955c" />

      <Hit target="drawer" label={state.drawerOpen ? 'Schublade schließen' : 'Schublade öffnen'} onAct={onAct} disabled={state.escaped}>
        <rect x="508" y="204" width="84" height="26" rx="3" fill="#8a5a36" stroke="#5c3720" strokeWidth="2" className="room-glow" />
        <rect x="540" y="214" width="20" height="5" rx="2" fill="#e8b04a" />
        {state.drawerOpen && (
          <g>
            <rect x="500" y="228" width="100" height="22" rx="3" fill="#9c6a42" stroke="#5c3720" strokeWidth="2" />
            <rect x="504" y="230" width="92" height="8" fill="#5c3720" opacity="0.6" />
          </g>
        )}
      </Hit>
      {state.drawerOpen && !hasItem('treats') && !state.catFed && (
        <Hit target="treats" label="Katzen-Leckerli nehmen" onAct={onAct}>
          <g className="room-pickup" transform="translate(550 222)">
            <path d="M-16 6v-18l4 -4h24l4 4v18Z" fill="#3f6fb5" />
            <path d="M-6 -4q6 -6 12 0q-6 6 -12 0Z M6 -4l5 -4v8Z" fill="#fff8ee" />
          </g>
        </Hit>
      )}

      <Hit target="cabinet" label={state.cabinetOpen ? 'Vitrine schließen' : 'Vitrine öffnen'} onAct={onAct} disabled={state.escaped}>
        <rect x="508" y="238" width="84" height="56" rx="3" fill="#5c3720" />
        {/* Flasche hinter dem Glas */}
        {!hasItem('wine') && !state.cabinetOpen && (
          <g opacity="0.7">
            <rect x="542" y="256" width="16" height="34" rx="5" fill="#5a1f2e" />
            <rect x="547" y="246" width="6" height="12" fill="#5a1f2e" />
          </g>
        )}
        {state.cabinetOpen ? (
          <rect x="460" y="238" width="48" height="56" rx="3" fill="rgb(200 225 240 / 0.35)" stroke="#8a5a36" strokeWidth="4" className="room-glow" />
        ) : (
          <rect x="508" y="238" width="84" height="56" rx="3" fill="rgb(200 225 240 / 0.3)" stroke="#8a5a36" strokeWidth="4" className="room-glow" />
        )}
        <circle cx={state.cabinetOpen ? 500 : 586} cy="266" r="3" fill="#e8b04a" />
      </Hit>
      {state.cabinetOpen && !hasItem('wine') && (
        <Hit target="wine" label="Weinflasche nehmen" onAct={onAct}>
          <g className="room-pickup">
            <rect x="542" y="256" width="16" height="34" rx="5" fill="#5a1f2e" />
            <rect x="547" y="244" width="6" height="14" fill="#5a1f2e" />
            <rect x="546" y="240" width="8" height="6" fill="#e8b04a" />
            <rect x="543" y="266" width="14" height="12" fill="#f3ead9" />
          </g>
        </Hit>
      )}

      {/* Balkontür mit Blick in die Nacht */}
      <Hit target="balcony" label="Durch die Balkontür hinaus" onAct={onAct} disabled={state.escaped}>
        <rect x="616" y="62" width="96" height="238" fill="#f6ead7" />
        <rect x="624" y="70" width="80" height="226" fill="url(#room-night)" />
        {[[640, 96], [690, 120], [660, 150], [700, 84]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#fff8e6" />)}
        <rect x="624" y="236" width="80" height="60" fill="#e7eef6" opacity="0.8" />
        <path d="M624 252h80M624 282h80M634 252v44M654 252v44M674 252v44M694 252v44" stroke="#2b2b3a" strokeWidth="3" />
        <g className="room-door" data-open={state.escaped}>
          <rect className="room-door__wing room-door__wing--left" x="624" y="70" width="40" height="226" fill="rgb(200 225 240 / 0.18)" stroke="#f6ead7" strokeWidth="5" />
          <rect className="room-door__wing room-door__wing--right" x="664" y="70" width="40" height="226" fill="rgb(200 225 240 / 0.18)" stroke="#f6ead7" strokeWidth="5" />
        </g>
        <rect x="620" y="62" width="88" height="238" fill="none" stroke="#c8b79a" strokeWidth="4" className="room-glow" />
      </Hit>

      {/* Couchtisch mit Keksen und Milch */}
      <rect x="370" y="352" width="112" height="12" rx="4" fill="#6b4a33" />
      <rect x="380" y="362" width="8" height="26" fill="#5c3720" />
      <rect x="464" y="362" width="8" height="26" fill="#5c3720" />
      <rect x="444" y="324" width="16" height="28" rx="3" fill="#fff8ee" opacity="0.92" />
      <rect x="444" y="324" width="16" height="6" rx="2" fill="#dfe8f2" />
      <Hit target="plate" label={hasItem('cookies') ? 'Leerer Keksteller' : 'Kekse nehmen'} onAct={onAct} disabled={state.escaped}>
        <ellipse cx="408" cy="348" rx="32" ry="8" fill="#f4f1ee" stroke="#c9c4be" strokeWidth="2" className="room-glow" />
        {hasItem('cookies') ? (
          [[396, 346], [414, 348], [420, 344]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#b9814a" />)
        ) : (
          <g className="room-pickup">
            {[[394, 340], [412, 338], [424, 343], [404, 333]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r="9" fill="#d9a35f" />
                <circle cx={x - 3} cy={y - 2} r="1.6" fill="#5c3720" />
                <circle cx={x + 3} cy={y + 2} r="1.6" fill="#5c3720" />
              </g>
            ))}
          </g>
        )}
      </Hit>

      <Hit target="cat" label={state.catFed ? 'Schlafende Katze' : 'Katze vor der Balkontür'} onAct={onAct} disabled={state.escaped}>
        <Cat key={effect?.kind === 'eat' || effect?.kind === 'meow' ? effect.n : 'cat'} fed={state.catFed && effect?.kind !== 'eat'} mood={catMood} />
      </Hit>

      <rect width={ROOM.width} height={ROOM.height} fill="url(#room-warm)" pointerEvents="none" />
      {state.escaped && <rect className="room-cold" x="420" y="0" width="300" height={ROOM.height} fill="url(#room-cold)" pointerEvents="none" />}
    </svg>
  )
}

export default function ChimneyGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const [state, setState] = useState<RoomState>(() => restoreRoom(savedState))
  const [stage, setStage] = useState<Stage>(() => {
    const restored = restoreRoom(savedState)
    return restored.items.length || restored.catFed || restored.escaped ? 'room' : 'intro'
  })
  const [dark, setDark] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [effect, setEffect] = useState<{ kind: Effect; n: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const intro = useRef<ChimneyScene | null>(null)
  const timers = useRef<number[]>([])
  const save = useEffectEvent(saveState)

  useEffect(() => { save(state) }, [state])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const later = (ms: number, then: () => void) => timers.current.push(window.setTimeout(then, ms))

  const onCue = useEffectEvent((cue: ChimneyCue) => {
    if (cue === 'dark') setDark(true)
    if (cue === 'done') {
      later(350, () => {
        setStage('room')
        setMessage('Plumps! Mitten im Kamin gelandet. Pack Kekse und Wein ein – und dann ab über den Balkon.')
        later(80, () => setDark(false))
      })
    }
  })
  useEffect(() => {
    if (stage !== 'intro' || !canvas.current) return
    const scene = new ChimneyScene(canvas.current, { onCue: (cue) => onCue(cue) })
    intro.current = scene
    return () => {
      scene.dispose()
      intro.current = null
    }
  }, [stage])

  const act = (target: Target) => {
    const result = interact(state, target)
    setState(result.state)
    setMessage(result.message)
    setEffect((e) => ({ kind: result.effect, n: (e?.n ?? 0) + 1 }))
    if (result.effect === 'eat') later(1400, () => setEffect(null))
    navigator.vibrate?.(result.effect === 'blocked' || result.effect === 'meow' ? 40 : 15)
  }

  const replay = () => {
    setState(restoreRoom(undefined))
    setMessage(null)
    setEffect(null)
    setStage('intro')
  }

  const list = tasks(state)
  const status = message ?? 'Schau dich um: Was lässt sich im Wohnzimmer antippen?'

  return (
    <div className="chimney">
      <div className="chimney__view" data-dark={dark}>
        {stage === 'intro' ? (
          <>
            <canvas ref={canvas} className="chimney__canvas" />
            <button type="button" className="chimney__skip" onClick={() => intro.current?.skip()}>
              Überspringen ›
            </button>
          </>
        ) : (
          <>
            <Room state={state} effect={effect} onAct={act} />
            <div className="chimney__bag" aria-label="Eingepackt">
              {(['cookies', 'treats', 'wine'] as const).map((item) => (
                <span key={item} data-has={state.items.includes(item)} title={ITEM_LABEL[item]}>
                  {ITEM_ICON[item]}
                </span>
              ))}
            </div>
          </>
        )}
        <div className="chimney__black" aria-hidden="true" />
      </div>

      <p className="chimney__status" role="status" data-tone={state.escaped ? 'done' : effect?.kind === 'blocked' || effect?.kind === 'meow' ? 'hint' : undefined}>
        {stage === 'intro' ? 'Hinauf aufs Dach …' : status}
      </p>

      {stage === 'room' && (
        <ol className="chimney__tasks" aria-label="Aufgaben">
          {list.map((task) => (
            <li key={task.id} data-done={task.done}>{task.done ? '✓ ' : ''}{task.label}</li>
          ))}
        </ol>
      )}

      {state.escaped && (
        <div className="chimney__actions">
          <button type="button" className="button" onClick={onComplete}>
            {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
          </button>
          <button type="button" className="button button--quiet" onClick={replay}>
            Noch einmal durch den Kamin
          </button>
        </div>
      )}
    </div>
  )
}
