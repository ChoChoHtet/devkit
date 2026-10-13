import { fail, ok } from '../result'
import type { Result } from '../result'
import { buildAlphabet } from './charset'
import type { CharsetOptions } from './charset'

export interface NumberRange {
  min: number
  max: number
}

export const LENGTH_RANGE: NumberRange = { min: 1, max: 1024 }
export const COUNT_RANGE: NumberRange = { min: 1, max: 1000 }
export const DEFAULT_LENGTH = 32

export interface RandomStringOptions extends CharsetOptions {
  length: number
  count: number
  unique: boolean
}

export interface RandomStringResult {
  values: string[]
  alphabetSize: number
  entropyBits: number
}

// Fills the array with uniformly random 32-bit values, e.g. crypto.getRandomValues.
export type RandomSource = (target: Uint32Array<ArrayBuffer>) => void

const UINT32_SPAN = 2 ** 32
const DRAW_BUFFER_SIZE = 256

const defaultRandomSource: RandomSource = (target: Uint32Array<ArrayBuffer>): void => {
  crypto.getRandomValues(target)
}

/**
 * Returns a function that picks an index in [0, max) without modulo bias: draws that fall in the
 * uneven tail above the largest multiple of max are rejected.
 */
export function createIndexPicker(source: RandomSource = defaultRandomSource): (max: number) => number {
  const buffer: Uint32Array<ArrayBuffer> = new Uint32Array(DRAW_BUFFER_SIZE)
  let next: number = DRAW_BUFFER_SIZE

  function draw(): number {
    if (next >= DRAW_BUFFER_SIZE) {
      source(buffer)
      next = 0
    }
    const value: number = buffer[next] ?? 0
    next += 1
    return value
  }

  return (max: number): number => {
    const limit: number = UINT32_SPAN - (UINT32_SPAN % max)
    for (;;) {
      const value: number = draw()
      if (value < limit) return value % max
    }
  }
}

export function rangeError(value: unknown, range: NumberRange, label: string): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return `${label} must be a whole number`
  if (value < range.min || value > range.max) return `${label} must be between ${range.min} and ${range.max}`
  return null
}

export function isLength(value: unknown): value is number {
  return rangeError(value, LENGTH_RANGE, 'Length') === null
}

export function isCount(value: unknown): value is number {
  return rangeError(value, COUNT_RANGE, 'Count') === null
}

export function entropyBits(length: number, alphabetSize: number): number {
  return length * Math.log2(alphabetSize)
}

export function generateStrings(
  options: RandomStringOptions,
  source: RandomSource = defaultRandomSource,
): Result<RandomStringResult> {
  const lengthProblem: string | null = rangeError(options.length, LENGTH_RANGE, 'Length')
  if (lengthProblem) return fail(lengthProblem)
  const countProblem: string | null = rangeError(options.count, COUNT_RANGE, 'Count')
  if (countProblem) return fail(countProblem)

  const alphabet: Result<string> = buildAlphabet(options)
  if (!alphabet.ok) return alphabet

  const characters: string[] = [...alphabet.value]
  const alphabetSize: number = characters.length
  const bits: number = entropyBits(options.length, alphabetSize)

  // Compare in log space: alphabetSize ** length overflows for long strings.
  if (options.unique && bits < Math.log2(options.count)) {
    return fail('Not enough unique values for this alphabet and length')
  }

  const pick: (max: number) => number = createIndexPicker(source)
  const values: string[] = []
  const seen: Set<string> = new Set()
  while (values.length < options.count) {
    let value: string = ''
    for (let i: number = 0; i < options.length; i += 1) {
      value += characters[pick(alphabetSize)] ?? ''
    }
    if (options.unique) {
      if (seen.has(value)) continue
      seen.add(value)
    }
    values.push(value)
  }

  return ok({ values, alphabetSize, entropyBits: bits })
}
