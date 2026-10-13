import { describe, expect, it } from 'vitest'
import { MAX_INPUT_BYTES, analyzeString } from '../../../app/utils/string/stats'
import type { StringStats } from '../../../app/utils/string/stats'

function statsOf(text: string): StringStats {
  const result = analyzeString(text)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

const SAMPLES: string[] = ['', 'a', 'héllo 👋', 'a b&c=d/e?f', 'line1\r\nline2\nline3', '"quoted" \\ back\tslash', '日本語のテキスト']

describe('analyzeString', () => {
  it('reports zeros for empty input', () => {
    const stats = statsOf('')
    expect(stats.characters).toBe(0)
    expect(stats.codeUnits).toBe(0)
    expect(stats.lines).toBe(0)
    expect(stats.whitespace).toBe(0)
    expect(stats.utf8Bytes).toBe(0)
    expect(stats.utf16Bytes).toBe(0)
    expect(Object.values(stats.encodings).every((n: number) => n === 0)).toBe(true)
  })

  it('counts code points, code units and bytes for emoji and accents', () => {
    const stats = statsOf('héllo 👋')
    expect(stats.characters).toBe(7)
    expect(stats.codeUnits).toBe(8)
    expect(stats.utf8Bytes).toBe(11)
    expect(stats.utf16Bytes).toBe(16)
  })

  it('counts whitespace, including tabs and newlines', () => {
    expect(statsOf('héllo 👋').whitespace).toBe(1)
    expect(statsOf(' a\tb\n').whitespace).toBe(3)
  })

  it('counts a lone surrogate as one character', () => {
    const stats = statsOf('\uD800')
    expect(stats.characters).toBe(1)
    expect(stats.utf8Bytes).toBe(3)
  })

  it('counts lines across CRLF, LF and CR breaks', () => {
    expect(statsOf('a\r\nb\nc').lines).toBe(3)
    expect(statsOf('a\n').lines).toBe(2)
    expect(statsOf('a').lines).toBe(1)
  })

  it('reports encoded lengths for emoji text', () => {
    const encodings = statsOf('héllo 👋').encodings
    expect(encodings).toEqual({ base64: 16, base64url: 15, hex: 22, urlEncoded: 25, jsonEscaped: 8 })
  })

  it('rejects input over 5 MB', () => {
    expect(analyzeString('a'.repeat(MAX_INPUT_BYTES + 1))).toEqual({
      ok: false,
      error: { message: 'Too large: the limit is 5 MB' },
    })
  })

  it.each(SAMPLES)('matches the platform encoders for %j', (text: string) => {
    const stats = statsOf(text)
    const bytes: Buffer = Buffer.from(text, 'utf8')
    expect(stats.utf8Bytes).toBe(bytes.length)
    expect(stats.encodings.base64).toBe(bytes.toString('base64').length)
    expect(stats.encodings.base64url).toBe(bytes.toString('base64url').length)
    expect(stats.encodings.hex).toBe(bytes.toString('hex').length)
    expect(stats.encodings.urlEncoded).toBe(encodeURIComponent(text).length)
    expect(stats.encodings.jsonEscaped).toBe(JSON.stringify(text).slice(1, -1).length)
  })
})
