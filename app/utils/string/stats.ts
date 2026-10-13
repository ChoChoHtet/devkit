import { fail, ok } from '../result'
import type { Result } from '../result'

export const MAX_INPUT_BYTES = 5 * 1024 * 1024

export interface StringStats {
  characters: number
  codeUnits: number
  utf8Bytes: number
  utf16Bytes: number
  lines: number
  whitespace: number
  encodings: {
    base64: number
    base64url: number
    hex: number
    urlEncoded: number
    jsonEscaped: number
  }
}

const WHITESPACE_PATTERN = /\s/gu
const SURROGATE_PAIR_PATTERN = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g
const LINE_BREAK_PATTERN = /\r\n|\r|\n/g
// Characters encodeURIComponent leaves unescaped. Each is one ASCII byte in UTF-8.
const URL_UNRESERVED_PATTERN = /[A-Za-z0-9\-_.!~*'()]/g

const utf8Encoder: TextEncoder = new TextEncoder()

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

export function analyzeString(text: string): Result<StringStats> {
  const utf8Bytes: number = utf8Encoder.encode(text).length
  if (utf8Bytes > MAX_INPUT_BYTES) return fail('Too large: the limit is 5 MB')

  const codeUnits: number = text.length
  const unreserved: number = countMatches(text, URL_UNRESERVED_PATTERN)
  const lineBreaks: number = countMatches(text, LINE_BREAK_PATTERN)

  return ok({
    characters: codeUnits - countMatches(text, SURROGATE_PAIR_PATTERN),
    codeUnits,
    utf8Bytes,
    utf16Bytes: codeUnits * 2,
    lines: text === '' ? 0 : lineBreaks + 1,
    whitespace: countMatches(text, WHITESPACE_PATTERN),
    encodings: {
      base64: 4 * Math.ceil(utf8Bytes / 3),
      base64url: Math.ceil((4 * utf8Bytes) / 3),
      hex: 2 * utf8Bytes,
      // Each byte that isn't unreserved becomes a %XX triplet.
      urlEncoded: unreserved + 3 * (utf8Bytes - unreserved),
      jsonEscaped: JSON.stringify(text).length - 2,
    },
  })
}
