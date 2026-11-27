import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MinigameProps } from '../../types.ts'
import { CakeArt, IngredientArt } from './CakeArt.tsx'
import { DeliveryDoor, ShippingSign, WasteBin } from './DispatchArt.tsx'
import { createOrders, describeCake, FIELD_LABELS, FIELDS, ingredientLabel, mismatches, optionsFor, reachableStation, startGame, updateGame } from './model.ts'
import type { BakeryAction, RecipeField } from './model.ts'
import './bakery.css'

const STATIONS = ['Die Backform', 'Die Creme', 'Die Glasur', 'Die Dekoration', 'Der Versand']
const PROMPTS = ['Welche Form hat die Vorlage?', 'Welche Creme kommt zwischen die Böden?', 'Welche Glasur bekommt dein Kuchen?', 'Was setzt du obendrauf?', 'Ist dein Kuchen bereit für die Prüfstation?']
const SHORT_LABELS = ['Form', 'Creme', 'Glasur', 'Deko', 'Versand']

type DispatchPhase = 'arriving' | 'checking' | 'approved' | 'shipping' | 'discarding' | 'rejected'
type Dispatch = { phase: DispatchPhase; step: number; errors: RecipeField[] }

const DISPATCH_TIMINGS = {
  arriving: 780,
  checking: 480,
  error: 850,
  approved: 720,
  shipping: 1000,
  discarding: 1120,
}

function Arrow({ back = false }: { back?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'M19 12H5m7-7-7 7 7 7' : 'M5 12h14m-7-7 7 7-7 7'} /></svg>
}

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
}

function WindowArt() {
  return (
    <svg className="bakery-window" viewBox="0 0 200 220" aria-hidden="true">
      <path d="M16 206V90a84 84 0 0 1 168 0v116Z" fill="#d8e5df" stroke="#b9cdbf" strokeWidth="9" />
      <path d="M28 196V91a72 72 0 0 1 144 0v105Z" fill="#8baeb7" />
      <path d="M29 174q38-24 73 0t70-8v31H29Z" fill="#f5f7e8" />
      <path d="m66 75-20 34h10l-19 32h15l-20 29h66l-20-29h15l-19-32h10Z" fill="#e3efe5" />
      <path d="m137 119-16 27h9l-18 30h48l-17-30h9Z" fill="#d7e6dd" />
      <g fill="#fff9e7"><circle cx="107" cy="53" r="3" /><circle cx="143" cy="88" r="3" /><circle cx="55" cy="62" r="2" /><circle cx="92" cy="125" r="2.5" /><circle cx="36" cy="119" r="2" /><circle cx="159" cy="151" r="2" /></g>
      <path d="M100 19v181M23 103h154" stroke="#eaf0de" strokeWidth="7" />
      <path d="M8 205h184" stroke="#a9c0ac" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}

function Dispenser({ index, active }: { index: number; active: boolean }) {
  return (
    <div className="bakery-dispenser" data-active={active} data-kind={index} aria-hidden="true">
      <span className="bakery-dispenser__pipe" />
      <svg viewBox="0 0 100 145">
        <defs><linearGradient id={`machine-${index}`} x2="1" y2="0"><stop stopColor="#8da798" /><stop offset="0.45" stopColor="#e4e9d9" /><stop offset="1" stopColor="#819e8e" /></linearGradient></defs>
        <path d="M36 0h28v28H36Z" fill={`url(#machine-${index})`} />
        <rect x="19" y="26" width="62" height="13" rx="6" fill="#f0d69b" stroke="#c5ac78" strokeWidth="2" />
        <path d="M23 38h54l-6 51H29Z" fill="#f8f1d9" stroke="#b6c3a9" strokeWidth="2" />
        <path d="M30 43h40l-4 35H34Z" fill={['#dfb381', '#efb8bb', '#a97854', '#bad1a1'][index]} />
        {index === 0 && <path d="M41 56h18v14H41Z" fill="#fff1ce" stroke="#b9844f" strokeWidth="2" />}
        {index === 1 && <path d="M40 67q-2-9 5-11-1-7 6-9 0 6 7 10 6 5 2 10Z" fill="#fff1e1" />}
        {index === 2 && <path d="M45 48q-17 18-4 23 24 9 12-16l-5-8Z" fill="#f4ddad" />}
        {index === 3 && <path d="m50 47 5 9 10 2-7 7 1 10-9-5-9 5 1-10-7-7 10-2Z" fill="#fdf1b5" />}
        <path d="M28 86h44l-10 22H38Z" fill={`url(#machine-${index})`} stroke="#809c8c" strokeWidth="2" />
        <path d="M41 108h18v17H41Z" fill="#527d68" />
        <rect x="37" y="121" width="26" height="7" rx="3" fill="#ecce8d" />
        <circle cx="50" cy="92" r="4" fill={active ? '#f8cd6b' : '#6b9480'} />
      </svg>
      <span className="bakery-dispenser__drop" />
    </div>
  )
}

export default function BakeryGame({ day, savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const orders = useMemo(() => createOrders(day), [day])
  const [state, setState] = useState(() => startGame(savedState, orders, completedBefore))
  const [dispatch, setDispatch] = useState<Dispatch | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [piping, setPiping] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const room = useRef<HTMLDivElement>(null)
  const save = useEffectEvent(saveState)
  useEffect(() => { save(state) }, [state])
  useEffect(() => {
    if (!piping) return
    const timeout = window.setTimeout(() => setPiping(false), 420)
    return () => window.clearTimeout(timeout)
  }, [piping, state.cake])

  const inspectedField = dispatch?.phase === 'checking' ? FIELDS[dispatch.step] : undefined
  const wrong = inspectedField !== undefined && dispatch?.errors.includes(inspectedField) === true

  useEffect(() => {
    if (!dispatch || dispatch.phase === 'rejected') return
    const { phase, step, errors } = dispatch
    const duration = DISPATCH_TIMINGS[wrong ? 'error' : phase]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeout = window.setTimeout(() => {
      switch (phase) {
        case 'arriving':
          setDispatch({ ...dispatch, phase: 'checking' })
          break
        case 'checking':
          if (step + 1 < FIELDS.length) setDispatch({ ...dispatch, step: step + 1 })
          else setDispatch({ ...dispatch, phase: errors.length ? 'discarding' : 'approved' })
          break
        case 'approved':
          setDispatch({ ...dispatch, phase: 'shipping' })
          break
        case 'shipping':
          setState((current) => updateGame(current, { type: 'serve' }, orders))
          setDispatch(null)
          break
        case 'discarding':
          setState((current) => updateGame(current, { type: 'reset-cake' }, orders))
          setDispatch({ ...dispatch, phase: 'rejected' })
          break
      }
    }, reducedMotion ? Math.min(duration, phase === 'checking' ? 400 : 160) : duration)
    return () => window.clearTimeout(timeout)
  }, [dispatch, orders, wrong])

  const order = orders[state.orderIndex]
  const field = FIELDS[state.station]
  const done = state.orderIndex + Number(state.served)
  const finished = state.served && done === orders.length
  const reachable = reachableStation(state.cake)
  const phase = dispatch?.phase ?? (state.served ? 'shipped' : 'idle')
  const scanning = phase === 'arriving' || phase === 'checking'
  const accepted = phase === 'approved' || phase === 'shipping'
  const rejected = phase === 'rejected'
  const move = (action: BakeryAction) => {
    setState((current) => updateGame(current, action, orders))
    setPiping(action.type === 'select')
  }
  const sendOrder = () => {
    if (dispatch || state.served || state.station !== FIELDS.length) return
    setPiping(false)
    setDispatch({ phase: 'arriving', step: 0, errors: mismatches(state.cake, order) })
    room.current?.scrollIntoView({ block: 'nearest' })
  }
  const moveAndFocus = (station: number) => {
    move({ type: 'move', station })
    heading.current?.focus({ preventScroll: true })
  }

  return (
    <div className="bakery" aria-label="Kuchen-Spiel">
      <header className="bakery__topbar">
        <div className="bakery__brand"><span className="bakery__brand-mark" aria-hidden="true">✦</span><div><span className="bakery__eyebrow">Frisch aus der Weihnachtsstraße</span><h3>Die Zuckerstube</h3></div></div>
        <button type="button" className="bakery__help-button" aria-label="Spielanleitung" aria-expanded={showHelp} aria-controls="bakery-help" onClick={() => setShowHelp(!showHelp)}>?</button>
      </header>

      {showHelp && <div id="bakery-help" className="bakery__help"><strong>So wird’s ein Wunschkuchen</strong><p>Wähle an jeder Station die passende Zutat. Mit dem linken Pfeil kannst du vor dem Versand zurückgehen. An der Prüfstation leuchtet die Lupe falsche Zutaten rot an. Landet der Kuchen im Müll, kannst du dieselbe Bestellung neu backen. Fünf ausgelieferte Kuchen öffnen deine Überraschung.</p></div>}

      <div className="bakery__workspace">
        <aside className="bakery-order" aria-label={`Bestellung ${state.orderIndex + 1}`}>
          <div className="bakery-order__pin" aria-hidden="true" />
          <span className="bakery__eyebrow">Der Wunschzettel</span>
          <div className="bakery-order__title"><h4>Genau so, bitte!</h4><span>0{state.orderIndex + 1}</span></div>
          <div className="bakery-order__picture"><CakeArt cake={order} /><span className="bakery-order__sparkle" aria-hidden="true">✧</span></div>
          <dl className="bakery-order__recipe">
            {FIELDS.map((key, index) => <div key={key}><dt><span>0{index + 1}</span>{FIELD_LABELS[key]}</dt><dd>{ingredientLabel(key, order[key])}</dd></div>)}
          </dl>
          <p className="bakery-order__note">Mit Liebe gebacken.<br />Mit Vorfreude erwartet.</p>
        </aside>

        <div className="bakery-factory">
          <div className="bakery-factory__awning" aria-hidden="true"><span>Ein kleines Stück Weihnachtsglück</span></div>
          <div ref={room} className="bakery-factory__room" data-piping={piping} data-dispatch={phase}>
            <div className="bakery-factory__track" style={{ '--station': state.station } as CSSProperties} data-empty={state.cake.shape === null}>
              <WindowArt />
              <div className="bakery-factory__wall-label" aria-hidden="true"><span>★</span> BACKEN MACHT GLÜCKLICH <span>★</span></div>
              <div className="bakery-factory__machines">
                {FIELDS.map((key, index) => <Dispenser key={key} index={index} active={state.station === index && phase === 'idle'} />)}
                <ShippingSign />
              </div>
              <div className="bakery-inspection" data-wrong={wrong} aria-hidden="true">
                <strong>Prüfstation</strong>
                {scanning && <span>{inspectedField ? FIELD_LABELS[inspectedField] : 'Kuchen kommt an'}</span>}
              </div>
              <div className="bakery-conveyor" aria-hidden="true">
                <div className="bakery-conveyor__belt" />
                <div className="bakery-conveyor__rail" />
              </div>
              <DeliveryDoor />
              {phase !== 'shipped' && !rejected && (
                <div className="bakery-conveyor__cake" data-piping={piping}>
                  <CakeArt cake={state.cake} inspection={inspectedField ? { field: inspectedField, wrong } : undefined} />
                </div>
              )}
              {accepted && <span className="bakery-conveyor__approved" aria-hidden="true"><Check /> Korrekt!</span>}
              <WasteBin />
            </div>
          </div>

          <nav className="bakery-stations" aria-label="Backstationen">
            {SHORT_LABELS.map((label, index) => <button type="button" key={label} aria-label={`Station ${index + 1}: ${label}`} aria-current={state.station === index ? 'step' : undefined} disabled={state.served || dispatch !== null || index > reachable} data-done={index < reachable} onClick={() => moveAndFocus(index)}><span>{index < reachable ? <Check /> : index + 1}</span><strong>{label}</strong><i /></button>)}
          </nav>
        </div>
      </div>

      <section className="bakery-controls" aria-label="Kuchen backen">
        {state.served ? (
          <div className="bakery-success" role="status">
            <div className="bakery-success__seal"><Check /></div>
            <div><span className="bakery__eyebrow">{finished ? 'Die Backstube duftet herrlich' : `Bestellung ${done} verschickt`}</span><h4>{finished ? 'Fünf Kuchen. Fünfmal Freude!' : 'Genau wie bestellt!'}</h4><p>{finished ? 'Deine Weihnachtsüberraschung wartet auf dich.' : 'Der Wunschkuchen ist unterwegs.'}</p></div>
            <button type="button" className="bakery-button bakery-button--primary" onClick={() => {
              if (finished) onComplete()
              else {
                move({ type: 'next-order' })
                heading.current?.focus({ preventScroll: true })
              }
            }}>{finished ? 'Überraschung öffnen' : 'Nächste Bestellung'}<Arrow /></button>
          </div>
        ) : dispatch ? (
          <div className="bakery-dispatch-status" data-error={wrong || phase === 'discarding' || rejected}>
            <div role="status">
              <h4>{scanning ? 'Die Lupe prüft deinen Kuchen' : accepted ? 'Korrekt! Der Kuchen geht raus.' : rejected ? 'Der Kuchen ist im Müll gelandet' : 'Dieser Kuchen kommt in den Müll'}</h4>
              <p>{scanning
                ? inspectedField
                  ? `${FIELD_LABELS[inspectedField]} ${wrong ? 'passt nicht zur Bestellung' : 'passt zur Bestellung'}.`
                  : 'Das Fließband bringt ihn zur Prüfstation.'
                : accepted
                  ? 'Alle Zutaten passen zur Bestellung.'
                  : `${dispatch.errors.map((key) => FIELD_LABELS[key]).join(', ')} ${dispatch.errors.length === 1 ? 'passte' : 'passten'} nicht zur Bestellung.`}</p>
            </div>
            {rejected && <button type="button" className="bakery-button bakery-button--primary" onClick={() => setDispatch(null)}>Neu backen<Arrow /></button>}
          </div>
        ) : <>
          <div className="bakery-controls__heading"><div><span className="bakery__eyebrow">Station 0{state.station + 1} von 05</span><h4 ref={heading} tabIndex={-1}>{STATIONS[state.station]}</h4></div><p>{PROMPTS[state.station]}</p></div>

          {field ? <div className="bakery-options" role="group" aria-label={`${FIELD_LABELS[field]} auswählen`} data-count={optionsFor(field).length}>
            {optionsFor(field).map((option) => <button type="button" key={option.value} className="bakery-option" aria-pressed={state.cake[field] === option.value} onClick={() => move({ type: 'select', field, value: option.value })}><IngredientArt field={field} value={option.value} /><span>{option.label}</span><i><Check /></i></button>)}
          </div> : <div className="bakery-review" aria-label="Dein fertiger Kuchen"><CakeArt cake={state.cake} /><div><strong>Bereit zum Verschicken?</strong><p>Schick deinen Kuchen zur Prüfstation oder geh mit dem Pfeil zurück.</p><span className="visually-hidden">{describeCake(state.cake)}</span></div></div>}

          <div className="bakery-controls__actions">
            <button type="button" className="bakery-button bakery-button--back" disabled={state.station === 0} onClick={() => moveAndFocus(state.station - 1)}><Arrow back /><span>Zurück</span></button>
            <span className="bakery-controls__hint" role="status">{field && !state.cake[field] ? 'Wähle eine Zutat aus.' : field ? `${ingredientLabel(field, state.cake[field])} gewählt` : 'Dein Wunschkuchen ist fertig.'}</span>
            <button type="button" className={`bakery-button bakery-button--primary${field ? '' : ' bakery-button--send'}`} disabled={field ? state.cake[field] === null : false} onClick={() => field ? moveAndFocus(state.station + 1) : sendOrder()}>{field ? 'Weiter' : 'Bestellung rausschicken'}<Arrow /></button>
          </div>
        </>}
      </section>

      <footer className="bakery__footer"><div className="bakery-progress" aria-label={`${done} von ${orders.length} Kuchen fertig`}><div aria-hidden="true">{orders.map((_, index) => <span key={index} data-done={index < done}>{index < done ? <Check /> : '✦'}</span>)}</div><strong>{done}<span> / {orders.length} Kuchen</span></strong></div>{!state.served ? <button type="button" className="bakery__restart" onClick={() => move({ type: 'reset-cake' })} disabled={dispatch !== null || state.cake.shape === null}><span aria-hidden="true">↻</span> Kuchen neu beginnen</button> : <span className="bakery__footer-note">Mit einer Prise Liebe.</span>}</footer>
    </div>
  )
}
