import { describe, expect, it } from 'vitest'
import { extractToken, formatKey, normalizeKey, parseToken } from './token.ts'

describe('extractToken', () => {
  it('liest den Schlüssel aus dem Link im QR-Code', () => {
    expect(extractToken('https://adventskalender.bleck.it/?k=5.WZ861Q6B7G')).toEqual({
      day: 5,
      key: 'WZ861Q6B7G',
    })
  })

  it('versteht auch den nackten Schlüssel', () => {
    expect(extractToken(' 24.M1XFGDTYYQ ')).toEqual({ day: 24, key: 'M1XFGDTYYQ' })
  })

  it('lehnt fremde QR-Codes ab', () => {
    expect(extractToken('https://example.com/irgendwas')).toBeNull()
    expect(extractToken('https://adventskalender.bleck.it/?k=kaputt')).toBeNull()
    expect(extractToken('WIFI:S:Gast;T:WPA;P:geheim;;')).toBeNull()
    expect(extractToken('')).toBeNull()
  })
})

describe('parseToken', () => {
  it('akzeptiert nur die Tage 1 bis 24', () => {
    expect(parseToken('1.ABCDEFGHJK')?.day).toBe(1)
    expect(parseToken('0.ABCDEFGHJK')).toBeNull()
    expect(parseToken('25.ABCDEFGHJK')).toBeNull()
  })
})

describe('normalizeKey', () => {
  it('verzeiht, was beim Abtippen schiefgeht', () => {
    expect(normalizeKey(' wz861-q6b7g ')).toBe('WZ861Q6B7G')
    expect(normalizeKey('ol10-ABIL')).toBe('0110AB11')
  })

  it('ist das Gegenstück zur gut lesbaren Schreibweise', () => {
    expect(formatKey('WZ861Q6B7G')).toBe('WZ861-Q6B7G')
    expect(normalizeKey(formatKey('WZ861Q6B7G'))).toBe('WZ861Q6B7G')
  })
})
