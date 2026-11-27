/** Bunter Eichhörnchenkopf – Symbol für getroffene Eichhörnchen. */
export function SquirrelHead({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8.5 11 6 3.5l6.5 4.8M23.5 11 26 3.5l-6.5 4.8" fill="#c8743a" />
      <path d="M7 4.2 6 3.5l1.6 2.4M25 4.2l1-.7-1.6 2.4" fill="none" stroke="#7a4220" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="16" cy="17" rx="10.5" ry="9.5" fill="#c8743a" />
      <ellipse cx="16" cy="21.5" rx="6" ry="4.6" fill="#f3dcb8" />
      <ellipse cx="12" cy="15.5" rx="2.4" ry="2.8" fill="#fff" />
      <ellipse cx="20" cy="15.5" rx="2.4" ry="2.8" fill="#fff" />
      <circle cx="12.4" cy="16" r="1.4" fill="#2b1a12" />
      <circle cx="20.4" cy="16" r="1.4" fill="#2b1a12" />
      <ellipse cx="16" cy="19.6" rx="1.5" ry="1.1" fill="#2b1a12" />
    </svg>
  )
}
