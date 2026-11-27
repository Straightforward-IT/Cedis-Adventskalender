export function ShippingSign() {
  return (
    <div className="bakery-shipping" aria-hidden="true">
      <svg viewBox="0 0 80 110">
        <path d="M24 50V0m32 50V0" stroke="#93aa94" strokeWidth="5" />
        <rect x="7" y="42" width="66" height="47" rx="10" fill="#386451" stroke="#adc4aa" strokeWidth="5" />
        <path d="M24 65h31m-10-9 10 9-10 9" fill="none" stroke="#f5e9bd" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function DeliveryDoor() {
  return (
    <svg className="bakery-door" viewBox="0 0 100 128" aria-hidden="true">
      <path d="M12 124V47a38 38 0 0 1 76 0v77Z" fill="#284b3c" stroke="#adc4aa" strokeWidth="7" />
      <path className="bakery-door__light" d="M22 119V48a28 28 0 0 1 56 0v71Z" fill="#ffe8a3" />
      <g className="bakery-door__panel">
        <path d="M22 119V48a28 28 0 0 1 56 0v71Z" fill="#648a6c" />
        <path d="M36 112V46m14 66V36m14 76V46" stroke="#4f7459" strokeWidth="2" />
        <path d="M29 57h42v20H29Z" fill="#efe2ba" stroke="#3a634e" strokeWidth="2" />
        <path d="M40 67h18m-6-5 6 5-6 5" fill="none" stroke="#41634f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="69" cy="89" r="3" fill="#f6d381" />
      </g>
      <path d="M9 124h82" stroke="#91a88d" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

export function WasteBin() {
  return (
    <svg className="bakery-bin" viewBox="0 0 88 94" aria-hidden="true">
      <ellipse cx="45" cy="84" rx="34" ry="8" fill="#39463c" opacity="0.2" />
      <path d="m16 42 7 35q1 8 21 8t22-8l7-35" fill="#6e7c73" stroke="#43554a" strokeWidth="3" />
      <path d="m32 54 3 19m9-18v19m12-20-3 19" fill="none" stroke="#9aab9b" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="44" cy="42" rx="31" ry="8" fill="#364841" stroke="#a7b5a5" strokeWidth="3" />
      <g className="bakery-bin__lid">
        <path d="M38 35v-7h14v7" fill="none" stroke="#495e51" strokeWidth="4" strokeLinecap="round" />
        <path d="M11 41q3-8 33-8t33 8q0 6-33 6t-33-6Z" fill="#97a99b" stroke="#495e51" strokeWidth="3" />
      </g>
      <g className="bakery-bin__puff" fill="#fff4cf">
        <circle cx="27" cy="27" r="6" /><circle cx="45" cy="24" r="9" /><circle cx="61" cy="30" r="5" />
      </g>
    </svg>
  )
}
