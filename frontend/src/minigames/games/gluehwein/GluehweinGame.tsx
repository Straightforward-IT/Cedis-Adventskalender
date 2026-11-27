import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MinigameProps } from '../../types.ts'
import { GluehweinScene } from './GluehweinScene.ts'
import type { Stage } from './GluehweinScene.ts'
import {
  addExtra, createShop, describe, discard, EXTRA_FOR, GOAL, hasArrived, isCold, isDone, isPouring, isReady,
  NAMES, pour, restoreHappy, serve, step,
} from './model.ts'
import type { Base, Cup, Extra, Order } from './model.ts'
import './gluehwein.css'

const ICON: Record<Base | Extra, string> = { gluehwein: '🍷', kakao: '☕', rum: '🥃', amaretto: '🌰', sahne: '🍦' }

type Tone = 'info' | 'good' | 'bad'

function orderIcons(order: Order): string {
  return order.extra ? `${ICON[order.base]} + ${ICON[order.extra]}` : ICON[order.base]
}

function cupLabel(cup: Cup): string {
  if (cup.base === null) return 'leer'
  if (isPouring(cup)) return `${NAMES[cup.base]} läuft …`
  return describe({ base: cup.base, extra: cup.extra })
}

export default function GluehweinGame({ savedState, saveState, completedBefore, onComplete }: MinigameProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const scene = useRef<GluehweinScene | null>(null)
  const [startHappy] = useState(() => restoreHappy(savedState))
  const shop = useRef(createShop(startHappy))
  const [stage, setStage] = useState<Stage>(startHappy > 0 ? 'play' : 'intro')
  const [, setFrame] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: Tone; key: number } | null>(null)

  const say = (text: string, tone: Tone = 'info') => setMessage((m) => ({ text, tone, key: (m?.key ?? 0) + 1 }))

  useEffect(() => {
    if (!canvas.current || !overlay.current) return
    const instance = new GluehweinScene(canvas.current, overlay.current, () => shop.current, {
      onStage: setStage,
      onFrame: (dt) => {
        step(shop.current, dt)
        setFrame((n) => (n + 1) % 1_000_000)
      },
    }, startHappy > 0)
    scene.current = instance
    return () => {
      instance.dispose()
      scene.current = null
    }
    // Die Szene entsteht einmal pro Besuch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (cup: number | null) => {
    setSelected(cup)
    scene.current?.select(cup)
  }

  const s = shop.current
  const playing = stage === 'play' && !isDone(s)

  const onPour = (base: Base) => {
    if (!playing) return
    const result = pour(s, base, selected)
    if (result.ok) {
      choose(result.cup)
      say(`${NAMES[base]} läuft in Becher ${result.cup + 1} …`)
    } else if (result.reason === 'busy') {
      say(`Der ${base === 'gluehwein' ? 'Glühweintopf' : 'Kakaokessel'} füllt gerade schon einen Becher.`, 'bad')
    } else if (result.reason === 'full') {
      say('Alle drei Becher sind belegt – erst servieren oder einen ausschütten.', 'bad')
    }
  }

  const onExtra = (extra: Extra) => {
    if (!playing) return
    const result = addExtra(s, extra, selected)
    if (result.ok) {
      choose(result.cup)
      say(extra === 'sahne' ? 'Ein Klecks Sahne obendrauf!' : `Ein Schuss ${NAMES[extra]} hinein!`)
    } else {
      say(EXTRA_FOR[extra] === 'kakao'
        ? 'Sahne kommt auf einen fertig gezapften Kakao ohne Sahne.'
        : `${NAMES[extra]} kommt in einen fertig gezapften Glühwein ohne Schuss.`, 'bad')
    }
  }

  const onDiscard = () => {
    if (!playing || selected === null) return
    if (discard(s, selected)) {
      say('Weggeschüttet – der Becher ist wieder frei.')
      choose(null)
    }
  }

  const serveTo = (customerId: number) => {
    if (!playing) return
    const customer = s.customers.find((c) => c.id === customerId)
    if (!customer || !hasArrived(customer)) return
    const ready = s.cups.map((cup, i) => (isReady(cup) ? i : -1)).filter((i) => i >= 0)
    const cup = selected !== null && isReady(s.cups[selected]) ? selected : ready.length === 1 ? ready[0] : null
    if (cup === null) {
      say(ready.length ? 'Welcher Becher? Tippe ihn erst an.' : 'Noch kein Becher fertig – erst zapfen!', 'bad')
      return
    }
    const result = serve(s, cup, customerId)
    if (!result.ok) return
    scene.current?.served(result.customer, result.outcome, result.drink)
    choose(null)
    const who = result.customer.kind === 'elf' ? 'Der Wichtel' : 'Das Eichhörnchen'
    if (result.outcome === 'happy') {
      say(`${who} strahlt! ${s.happy} von ${GOAL} glücklich.`, 'good')
      saveState({ happy: s.happy })
      if (isDone(s)) scene.current?.finish()
    } else if (result.outcome === 'cold') {
      say(`Brr! ${who} bekam einen kalten Becher – das zählt nicht.`, 'bad')
    } else {
      say(`${who} wollte ${describe(result.customer.order)} – nimmt den Becher aber trotzdem mit.`, 'bad')
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (stage !== 'play') return
    const hit = scene.current?.pick(event.clientX, event.clientY)
    if (!hit) return
    if ('cup' in hit) {
      if (s.cups[hit.cup].base !== null) choose(selected === hit.cup ? null : hit.cup)
    } else {
      serveTo(hit.customer)
    }
  }

  const done = stage === 'done' || isDone(s)
  const pouringBase = (base: Base) => s.cups.find((cup) => cup.base === base && isPouring(cup))
  const status = done
    ? 'Acht glückliche Gäste – dein Stand ist der Renner der Straße! 🍷'
    : message?.text ?? (stage === 'intro' ? 'Der Glühweinstand vor Haus 13 öffnet gleich …'
      : 'Zapf Glühwein oder Kakao, tippe den fertigen Becher an – und dann den Gast.')

  return (
    <div className="gluehwein" data-stage={stage}>
      <div
        className="gluehwein__view"
        role="application"
        aria-label="Glühweinstand: Tippe einen Becher und dann einen Gast an, um zu servieren."
        onPointerDown={onPointerDown}
      >
        <canvas ref={canvas} className="gluehwein__canvas" />
        <div ref={overlay} className="gluehwein__bubbles">
          {s.customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="gluehwein__bubble"
              data-customer={customer.id}
              data-waiting={hasArrived(customer)}
              aria-label={`${describe(customer.order)} servieren`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => serveTo(customer.id)}
            >
              <span className="gluehwein__bubble-icons" aria-hidden="true">{orderIcons(customer.order)}</span>
              <span className="gluehwein__bubble-text">{describe(customer.order)}</span>
            </button>
          ))}
        </div>

        {stage !== 'intro' && (
          <div className="gluehwein__score" aria-label={`${s.happy} von ${GOAL} glücklichen Gästen`}>
            <span aria-hidden="true">😍</span>
            <span key={s.happy} className="gluehwein__count">{s.happy}</span>
            <span className="gluehwein__goal">/ {GOAL}</span>
          </div>
        )}

        {stage === 'intro' && (
          <button type="button" className="gluehwein__skip" onPointerDown={(e) => e.stopPropagation()} onClick={() => scene.current?.skipIntro()}>
            Überspringen ›
          </button>
        )}
      </div>

      <p className="gluehwein__hint" role="status" data-tone={message?.tone ?? 'info'} key={message?.key}>{status}</p>

      {!done && stage === 'play' && (
        <div className="gluehwein__bar">
          <div className="gluehwein__cups" role="group" aria-label="Becher auf der Theke">
            {s.cups.map((cup, i) => {
              const cold = isCold(cup)
              return (
                <button
                  key={i}
                  type="button"
                  className="gluehwein__cup"
                  data-selected={selected === i}
                  data-empty={cup.base === null}
                  data-cold={cold}
                  data-base={cup.base ?? undefined}
                  disabled={cup.base === null}
                  aria-pressed={selected === i}
                  onClick={() => choose(selected === i ? null : i)}
                >
                  <span className="gluehwein__cup-icon" aria-hidden="true">
                    {cup.base ? `${ICON[cup.base]}${cup.extra ? ICON[cup.extra] : ''}` : '◌'}
                  </span>
                  <span className="gluehwein__cup-name">{cold ? `${cupLabel(cup)} – kalt!` : cupLabel(cup)}</span>
                  {cup.base !== null && (
                    <span className="gluehwein__meter" aria-hidden="true">
                      <span
                        data-kind={isPouring(cup) ? 'fill' : 'heat'}
                        style={{ width: `${(isPouring(cup) ? cup.fill : cup.heat) * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="gluehwein__actions">
            {(['gluehwein', 'kakao'] as const).map((base) => {
              const busy = pouringBase(base)
              return (
                <button key={base} type="button" className="gluehwein__action gluehwein__action--pour" data-busy={!!busy} onClick={() => onPour(base)}>
                  <span aria-hidden="true">{ICON[base]}</span> {NAMES[base]}
                  {busy && <span className="gluehwein__busy" style={{ width: `${busy.fill * 100}%` }} aria-hidden="true" />}
                </button>
              )
            })}
            {(['rum', 'amaretto', 'sahne'] as const).map((extra) => (
              <button key={extra} type="button" className="gluehwein__action" onClick={() => onExtra(extra)}>
                <span aria-hidden="true">{ICON[extra]}</span> {NAMES[extra]}
              </button>
            ))}
            <button type="button" className="gluehwein__action gluehwein__action--trash" disabled={selected === null || s.cups[selected]?.base === null || isPouring(s.cups[selected])} onClick={onDiscard}>
              <span aria-hidden="true">🗑️</span> Ausschütten
            </button>
          </div>
        </div>
      )}

      {done && (
        <button type="button" className="button" onClick={onComplete}>
          {completedBefore ? 'Überraschung noch einmal ansehen' : 'Überraschung öffnen'}
        </button>
      )}
    </div>
  )
}
