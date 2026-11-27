import { describe, expect, it } from 'vitest'
import { KEY_LENGTH, deriveKey, formatToken, parseToken, verifyKey } from '../src/keys.ts'

const SECRET = 'ein-geheimnis-fuer-die-tests'

describe('deriveKey', () => {
  it('liefert pro Haus einen eigenen, stabilen und abtippbaren Schlüssel', () => {
    const keys = Array.from({ length: 24 }, (_, index) => deriveKey(SECRET, index + 1))
    expect(new Set(keys).size).toBe(24)
    expect(deriveKey(SECRET, 5)).toBe(keys[4])
    for (const key of keys) {
      expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/)
      expect(key).toHaveLength(KEY_LENGTH)
    }
  })

  it('hängt vom Geheimnis ab', () => {
    expect(deriveKey(SECRET, 5)).not.toBe(deriveKey('ein-anderes-geheimnis', 5))
  })
})

describe('verifyKey', () => {
  const key = deriveKey(SECRET, 12)

  it('akzeptiert nur den Schlüssel des jeweiligen Hauses', () => {
    expect(verifyKey(SECRET, 12, key)).toBe(true)
    expect(verifyKey(SECRET, 13, key)).toBe(false)
    expect(verifyKey(SECRET, 12, `${key.slice(0, -1)}${key.endsWith('0') ? '1' : '0'}`)).toBe(false)
  })

  it('verzeiht Schreibweise und Trennzeichen beim Abtippen', () => {
    const typed = `${key.slice(0, 5)}-${key.slice(5)}`.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l')
    expect(verifyKey(SECRET, 12, ` ${typed} `)).toBe(true)
  })

  it('lehnt alles ab, was kein Schlüssel ist', () => {
    for (const candidate of [undefined, null, 42, '', {}, 'x'.repeat(100)]) {
      expect(verifyKey(SECRET, 12, candidate)).toBe(false)
    }
  })
})

describe('parseToken', () => {
  it('liest Tag und Schlüssel aus dem QR-Inhalt', () => {
    const key = deriveKey(SECRET, 7)
    expect(parseToken(formatToken(7, key))).toEqual({ day: 7, key })
  })

  it('lehnt ungültige Tage und Formate ab', () => {
    expect(parseToken('25.ABCDEFGHJK')).toBeNull()
    expect(parseToken('0.ABCDEFGHJK')).toBeNull()
    expect(parseToken('ABCDEFGHJK')).toBeNull()
    expect(parseToken('7.')).toBeNull()
  })
})
