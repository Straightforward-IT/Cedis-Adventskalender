import { useId } from 'react'
import { describeCake, FLAVOURS } from './model.ts'
import type { Cake, Recipe, RecipeField } from './model.ts'

const OUTLINES = {
  round: 'M35 77a65 28 0 1 0 130 0a65 28 0 1 0-130 0',
  square: 'M44 49Q100 36 156 49Q164 51 164 58V95Q100 116 36 95V58Q36 51 44 49Z',
  heart: 'M100 111C76 96 34 81 34 58C34 30 76 28 100 50C124 28 166 30 166 58C166 81 124 96 100 111Z',
}

const LENS_TARGETS = {
  shape: [123, 134],
  filling: [120, 121],
  icing: [70, 81],
  topping: [103, 64],
}

type Inspection = { field: RecipeField; wrong: boolean }

export function ToppingArt({ topping }: { topping: Recipe['topping'] }) {
  if (topping === 'berries') return (
    <g>
      <path d="M98 67q-9-23 9-27q7 13-9 27" fill="#448765" />
      <circle cx="88" cy="71" r="12" fill="#c24e52" />
      <circle cx="110" cy="74" r="11" fill="#e26865" />
      <circle cx="101" cy="83" r="10" fill="#b4424d" />
      <circle cx="85" cy="67" r="3" fill="#ffb6a3" />
      <circle cx="107" cy="70" r="3" fill="#ffb6a3" />
    </g>
  )
  if (topping === 'heart') return (
    <g>
      <path d="M100 93C92 86 74 76 74 64C74 48 93 49 100 59C107 49 126 48 126 64C126 76 108 86 100 93Z" fill="#a83c47" transform="translate(0 4)" />
      <path d="M100 93C92 86 74 76 74 64C74 48 93 49 100 59C107 49 126 48 126 64C126 76 108 86 100 93Z" fill="#e9747e" />
      <path d="M81 65q0-10 11-7" fill="none" stroke="#ffbfbd" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
  if (topping === 'tree') return (
    <g strokeLinejoin="round">
      <path d="M98 48 80 69h10L76 87h20v9h9v-9h20l-15-18h10L102 48Z" fill="#2b604c" transform="translate(0 4)" />
      <path d="M98 44 80 65h10L76 83h20v9h9v-9h20l-15-18h10L102 44Z" fill="#569774" />
      <path d="M91 66q9 6 20 0m-22 13q13 6 24 0" fill="none" stroke="#c8e0ac" strokeWidth="3" />
      <circle cx="99" cy="59" r="3" fill="#f6ce75" />
      <circle cx="94" cy="75" r="3" fill="#e87974" />
      <circle cx="108" cy="77" r="3" fill="#f6ce75" />
    </g>
  )
  return (
    <g strokeLinejoin="round">
      <path d="m100 46 9 17 20 3-14 14 3 19-18-9-18 9 3-19-14-14 20-3Z" fill="#c1903b" transform="translate(0 4)" />
      <path d="m100 43 9 17 20 3-14 14 3 19-18-9-18 9 3-19-14-14 20-3Z" fill="#f4cd73" />
      <path d="m99 54-5 11-11 2" fill="none" stroke="#fff1b9" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

/** Eigene Vektorgrafik: dieselben Zutaten zeichnen Vorlage, Auswahl und laufenden Kuchen. */
export function CakeArt({ cake, className = '', decorative = false, inspection }: {
  cake: Cake
  className?: string
  decorative?: boolean
  inspection?: Inspection
}) {
  const id = useId().replace(/:/g, '')
  const icing = FLAVOURS.find((flavour) => flavour.value === cake.icing)
  const filling = FLAVOURS.find((flavour) => flavour.value === cake.filling)
  const outline = cake.shape ? OUTLINES[cake.shape] : ''
  return (
    <svg className={`bakery-cake ${className}`} data-highlight={inspection?.wrong ? inspection.field : undefined} viewBox="0 0 200 175" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : describeCake(cake)} aria-hidden={decorative || undefined}>
      <defs>
        <linearGradient id={`${id}-icing`} x1="0" y1="0" x2="0.4" y2="1">
          <stop stopColor={icing?.light ?? '#f5d59c'} />
          <stop offset="1" stopColor={icing?.color ?? '#d5a161'} />
        </linearGradient>
        <linearGradient id={`${id}-tray`} x2="0" y2="1">
          <stop stopColor="#fffcf2" />
          <stop offset="1" stopColor="#d4c5aa" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="151" rx="86" ry="14" fill="#503c30" opacity="0.13" />
      <path d="M18 120Q100 95 182 120L192 142Q100 169 8 142Z" fill={`url(#${id}-tray)`} stroke="#b9ad96" strokeWidth="1.5" />
      <path d="M14 140Q100 163 186 140" fill="none" stroke="#fffdf2" strokeWidth="3" />
      {cake.shape ? (
        <g className="bakery-cake__layers">
          <path className="bakery-cake__shape" d={outline} transform="translate(0 34)" fill="#a9683e" stroke="#a9683e" strokeWidth="2" />
          <path d={outline} transform="translate(0 27)" fill="#d69f64" />
          <path className="bakery-cake__filling" d={outline} transform="translate(0 20)" fill={filling?.color ?? '#d69f64'} />
          <path d={outline} transform="translate(0 11)" fill="#edc18a" />
          {cake.icing && (
            <path className="bakery-cake__icing" d={outline} transform="translate(0 4)" fill={icing?.color} stroke={icing?.color} strokeWidth="5" strokeLinejoin="round" />
          )}
          <path className="bakery-cake__icing" d={outline} fill={`url(#${id}-icing)`} stroke={icing?.light ?? '#f5d59c'} strokeWidth="2" />
          {cake.icing && (
            <g className="bakery-cake__icing" fill={icing?.color}>
              {cake.shape === 'round' && <path d="M40 88q7 8 13 9v11q5 8 10 0v-7l18 5v8q5 9 10 0v-6h21v5q5 10 10 0v-7l19-5v7q6 9 10-1V95l8-6q-52 27-119-1" />}
              {cake.shape === 'square' && <path d="M38 94v7l12 4v8q5 8 10 0v-5l19 4v8q5 8 10 0v-6h23v7q5 9 10 0v-9l19-4v6q5 8 10 0v-9l11-4v-7q-62 22-124 0" />}
              {cake.shape === 'heart' && <path d="M53 83q15 13 26 19v9q5 8 10 0v-3l11 7 12-8v6q5 8 10-1v-11l22-15q-22 16-44 25-25-13-47-28" />}
            </g>
          )}
          {cake.topping && <g className="bakery-cake__topping" transform={cake.shape === 'heart' ? 'translate(0 -5)' : undefined}><ToppingArt topping={cake.topping} /></g>}
          <path d="m49 124 4 1m14 5 3 1m70-5 3-1" fill="none" stroke="#b7804d" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g fill="none" stroke="#bbac93" strokeWidth="2" strokeDasharray="4 5">
          <ellipse cx="100" cy="127" rx="53" ry="13" />
        </g>
      )}
      {inspection && (
        <g className="bakery-cake__lens" data-wrong={inspection.wrong} style={{
          transform: `translate(${LENS_TARGETS[inspection.field][0]}px, ${LENS_TARGETS[inspection.field][1]}px)`,
        }} aria-hidden="true">
          <path d="M18-18 46-46" stroke="#2d5044" strokeWidth="13" strokeLinecap="round" />
          <path d="M22-21 42-41" stroke="#96b2a3" strokeWidth="5" strokeLinecap="round" />
          <circle className="bakery-cake__glass" r="25" strokeWidth="5" />
          <path d="M-16-6q3-10 13-12" fill="none" stroke="#fffae9" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

export function IngredientArt({ field, value }: { field: keyof Recipe; value: string }) {
  if (field === 'topping') return (
    <svg viewBox="60 30 80 80" aria-hidden="true"><ToppingArt topping={value as Recipe['topping']} /></svg>
  )
  if (field === 'shape') return (
    <CakeArt cake={{ shape: value as Recipe['shape'], filling: null, icing: null, topping: null }} decorative />
  )
  const flavour = FLAVOURS.find((item) => item.value === value)!
  return (
    <svg viewBox="0 0 80 64" aria-hidden="true">
      <ellipse cx="40" cy="56" rx="29" ry="5" fill="#715140" opacity="0.12" />
      {field === 'filling' ? <>
        <path d="M14 33q2 25 26 25t26-25" fill="#f8f2df" stroke="#c7b79d" strokeWidth="2" />
        <ellipse cx="40" cy="34" rx="26" ry="10" fill={flavour.color} />
        <path d="M22 33q-1-9 11-12-1-8 10-11 0 8 10 11 11 4 8 12" fill={flavour.light} />
        <path d="M32 29q12-8 21 0" fill="none" stroke={flavour.color} strokeWidth="3" strokeLinecap="round" />
      </> : <>
        <path d="M19 22h42l-4 31q-17 10-34 0Z" fill={flavour.color} stroke={flavour.light} strokeWidth="2" />
        <ellipse cx="40" cy="22" rx="21" ry="9" fill={flavour.light} />
        <ellipse cx="40" cy="22" rx="16" ry="5" fill={flavour.color} />
        <path d="m45 21 13-17" stroke="#bb9a74" strokeWidth="6" strokeLinecap="round" />
        <path d="M32 36q8-4 16 0v9q-8 5-16 0Z" fill="#fff5db" opacity="0.8" />
      </>}
    </svg>
  )
}
