import { describe, expect, it } from 'vitest'
import { SYMBOL_CHARS, buildAlphabet } from '../../../app/utils/random/charset'
import type { CharsetOptions } from '../../../app/utils/random/charset'

const NONE: CharsetOptions = { uppercase: false, lowercase: false, digits: false, symbols: false, customChars: '' }

function alphabetOf(options: Partial<CharsetOptions>): string {
  const result = buildAlphabet({ ...NONE, ...options })
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('buildAlphabet', () => {
  it('combines the checked character types', () => {
    const alphabet: string = alphabetOf({ uppercase: true, lowercase: true, digits: true })
    expect(alphabet).toHaveLength(62)
    expect(alphabet).toContain('A')
    expect(alphabet).toContain('z')
    expect(alphabet).toContain('9')
  })

  it('adds the symbol set only when symbols is checked', () => {
    expect(alphabetOf({ digits: true })).not.toContain('!')
    expect([...alphabetOf({ digits: true, symbols: true })].filter((c: string) => SYMBOL_CHARS.includes(c))).toHaveLength(
      SYMBOL_CHARS.length,
    )
  })

  it('adds custom characters to the checked types without duplicates', () => {
    expect(alphabetOf({ digits: true, customChars: '0a' })).toBe('0123456789a')
  })

  it('uses only the custom characters when no type is checked', () => {
    expect(alphabetOf({ customChars: '0123456789abcdef' })).toBe('0123456789abcdef')
  })

  it('counts emoji in custom characters as one character each', () => {
    expect(alphabetOf({ customChars: '👍👎' })).toBe('👍👎')
  })

  it('requires at least one type or custom characters', () => {
    expect(buildAlphabet(NONE)).toEqual({
      ok: false,
      error: { message: 'Pick at least one character type or enter custom characters' },
    })
  })

  it('rejects whitespace in custom characters', () => {
    expect(buildAlphabet({ ...NONE, customChars: 'ab c' })).toEqual({
      ok: false,
      error: { message: "Custom characters can't include whitespace" },
    })
  })

  it('needs at least two different characters', () => {
    expect(buildAlphabet({ ...NONE, customChars: 'aaa' })).toEqual({
      ok: false,
      error: { message: 'The alphabet needs at least 2 different characters' },
    })
  })
})
