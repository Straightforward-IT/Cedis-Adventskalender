import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconQr = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3M21 14v.01M14 21h.01M17.5 21H21v-3.5" />
  </Icon>
)

export const IconKey = () => (
  <Icon>
    <circle cx="8" cy="15" r="4.5" />
    <path d="M11.5 11.5 20 3M16 7l3 3M13.5 9.5l2 2" />
  </Icon>
)

export const IconCamera = () => (
  <Icon>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icon>
)

export const IconClose = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconDoor = () => (
  <Icon>
    <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17" />
    <circle cx="14.5" cy="12.5" r="0.6" fill="currentColor" />
  </Icon>
)

export const IconGate = () => (
  <Icon>
    <path d="M4 21V10a8 6 0 0 1 16 0v11M12 4v17M8 5v16M16 5v16M2.5 21h19" />
  </Icon>
)

export const IconTree = () => (
  <Icon>
    <path d="M12 2.5 7.5 9h2.2L6 14.5h3L5.5 19h13L15 14.5h3L14.3 9h2.2L12 2.5ZM12 19v2.5" />
  </Icon>
)

export const IconHouses = () => (
  <Icon>
    <path d="M3 21V11l4.5-4.5L12 11v10M12 21v-7l4.5-4 4.5 4v7M2 21h20M6.5 21v-4h2v4" />
  </Icon>
)

export const IconStar = () => (
  <Icon>
    <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.8L12 3Z" />
  </Icon>
)

export const IconArrows = () => (
  <Icon>
    <path d="M8 7 3 12l5 5M16 7l5 5-5 5M3 12h18" />
  </Icon>
)
