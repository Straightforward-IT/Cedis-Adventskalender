import { createHmac, timingSafeEqual } from 'node:crypto'
import { isValidDay } from './calendar.ts'

/** Crockford-Base32: ohne I, L, O und U – gut abtippbar, falls die Kamera streikt. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const KEY_LENGTH = 10

function toBase32(bytes: Uint8Array, length: number): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < length) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31]
      bits -= 5
    }
    buffer &= (1 << bits) - 1
    if (out.length >= length) break
  }
  return out
}

/** Der Schlüssel eines Hauses wird aus dem Geheimnis abgeleitet – es ist keine Datenbank nötig. */
export function deriveKey(secret: string, day: number): string {
  const digest = createHmac('sha256', secret).update(`weihnachtsstrasse:haus:${day}`).digest()
  return toBase32(digest, KEY_LENGTH)
}

/** Verzeiht Tippfehler-Klassiker: Kleinbuchstaben, Trennzeichen, O statt 0, I/L statt 1. */
export function normalizeKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export function verifyKey(secret: string, day: number, candidate: unknown): boolean {
  if (typeof candidate !== 'string' || candidate.length > 64) return false
  const expected = Buffer.from(deriveKey(secret, day))
  const given = Buffer.from(normalizeKey(candidate))
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Inhalt des QR-Codes (als `?k=`-Parameter): `<Tag>.<Schlüssel>`. */
export function formatToken(day: number, key: string): string {
  return `${day}.${key}`
}

export function parseToken(token: string): { day: number; key: string } | null {
  const match = /^(\d{1,2})\.([0-9A-Za-z-]{4,32})$/.exec(token.trim())
  if (!match) return null
  const day = Number(match[1])
  return isValidDay(day) ? { day, key: normalizeKey(match[2]) } : null
}
