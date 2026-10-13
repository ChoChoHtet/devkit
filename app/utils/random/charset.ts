import { fail, ok } from '../result'
import type { Result } from '../result'

export const SYMBOL_CHARS = '!@#$%^&*()-_=+[]{};:,.<>?'

const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz'
const DIGIT_CHARS = '0123456789'
const MIN_ALPHABET_SIZE = 2

export interface CharsetOptions {
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  customChars: string
}

export function buildAlphabet(options: CharsetOptions): Result<string> {
  const chosen: string[] = []
  if (options.uppercase) chosen.push(UPPERCASE_CHARS)
  if (options.lowercase) chosen.push(LOWERCASE_CHARS)
  if (options.digits) chosen.push(DIGIT_CHARS)
  if (options.symbols) chosen.push(SYMBOL_CHARS)

  if (chosen.length === 0 && options.customChars.length === 0) {
    return fail('Pick at least one character type or enter custom characters')
  }
  if (/\s/u.test(options.customChars)) {
    return fail("Custom characters can't include whitespace")
  }

  const alphabet: string = [...new Set(`${chosen.join('')}${options.customChars}`)].join('')
  if ([...alphabet].length < MIN_ALPHABET_SIZE) {
    return fail(`The alphabet needs at least ${MIN_ALPHABET_SIZE} different characters`)
  }
  return ok(alphabet)
}
