/** Gemeinsamer Testschlüssel für alle Boxen in der Vorschau. */
export const PREVIEW_KEY = 'ABCDEFGHJK'

/** Nur der Dev-Server oder ein ausdrücklich als Vorschau gebautes Frontend aktiviert /dev. */
export function isDevPreview(
  pathname = globalThis.location?.pathname ?? '',
  enabled = import.meta.env.DEV || import.meta.env.VITE_DEV_PREVIEW === 'true',
): boolean {
  return enabled && (pathname === '/dev' || pathname.startsWith('/dev/'))
}
