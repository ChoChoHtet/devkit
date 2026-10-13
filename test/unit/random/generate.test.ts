import { describe, expect, it } from 'vitest'
import {
  createIndexPicker,
  entropyBits,
  generateStrings,
  isCount,
  isLength,
  rangeError,
} from '../../../app/utils/random/generate'
import type { RandomStringOptions, RandomSource } from '../../../app/utils/random/generate'

const BASE: RandomStringOptions = {
  uppercase: false,
  lowercase: false,
  digits: true,
  symbols: false,
  customChars: '',
  length: 8,
  count: 1,
  unique: false,
}

// Replays fixed 32-bit draws, then zeros, so tests can force specific picks.
function scripted(draws: number[]): RandomSource {
  return (target: Uint32Array<ArrayBuffer>): void => {
    target.fill(0)
    target.set(draws.slice(0, target.length))
  }
}

describe('createIndexPicker', () => {
  it('rejects draws in the biased tail and retries', () => {
    // 2^32 mod 3 = 1, so draws at or above 4294967295 would favour index 0.
    const pick = createIndexPicker(scripted([4294967295, 4]))
    expect(pick(3)).toBe(1)
  })

  it('maps accepted draws onto the range by modulo', () => {
    const pick = createIndexPicker(scripted([7, 12]))
    expect(pick(10)).toBe(7)
    expect(pick(10)).toBe(2)
  })
})

describe('rangeError and guards', () => {
  it('accepts whole numbers inside the range', () => {
    expect(rangeError(1, { min: 1, max: 1024 }, 'Length')).toBeNull()
    expect(isLength(1024)).toBe(true)
    expect(isCount(1)).toBe(true)
  })

  it('reports out-of-range and non-integer values with the label', () => {
    expect(rangeError(0, { min: 1, max: 1024 }, 'Length')).toBe('Length must be between 1 and 1024')
    expect(rangeError(1.5, { min: 1, max: 1024 }, 'Length')).toBe('Length must be a whole number')
    expect(rangeError('', { min: 1, max: 1000 }, 'Count')).toBe('Count must be a whole number')
    expect(isLength(1025)).toBe(false)
    expect(isCount(0)).toBe(false)
  })
})

describe('generateStrings', () => {
  it('returns the requested count and length, using only alphabet characters', () => {
    const result = generateStrings({ ...BASE, count: 3, length: 8 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.values).toHaveLength(3)
    for (const value of result.value.values) {
      expect(value).toMatch(/^[0-9]{8}$/)
    }
    expect(result.value.alphabetSize).toBe(10)
  })

  it('maps scripted draws to alphabet characters', () => {
    const result = generateStrings({ ...BASE, length: 3 }, scripted([0, 5, 9]))
    expect(result).toEqual({
      ok: true,
      value: { values: ['059'], alphabetSize: 10, entropyBits: 3 * Math.log2(10) },
    })
  })

  it('reports the entropy of letters + digits at the default length', () => {
    const result = generateStrings({ ...BASE, uppercase: true, lowercase: true, length: 32 })
    expect(result.ok && result.value.entropyBits.toFixed(1)).toBe('190.5')
    expect(entropyBits(32, 62)).toBeCloseTo(190.5, 1)
  })

  it('rejects an invalid length or count before generating', () => {
    expect(generateStrings({ ...BASE, length: 0 })).toEqual({
      ok: false,
      error: { message: 'Length must be between 1 and 1024' },
    })
    expect(generateStrings({ ...BASE, count: 1001 })).toEqual({
      ok: false,
      error: { message: 'Count must be between 1 and 1000' },
    })
  })

  it('passes alphabet errors through', () => {
    expect(generateStrings({ ...BASE, digits: false })).toEqual({
      ok: false,
      error: { message: 'Pick at least one character type or enter custom characters' },
    })
  })

  it('makes every string in a unique batch distinct', () => {
    const result = generateStrings({ ...BASE, count: 10, length: 1, unique: true })
    expect(result.ok && new Set(result.ok ? result.value.values : []).size).toBe(10)
  })

  it('rejects a unique batch the alphabet cannot fill', () => {
    expect(generateStrings({ ...BASE, count: 11, length: 1, unique: true })).toEqual({
      ok: false,
      error: { message: 'Not enough unique values for this alphabet and length' },
    })
  })

  it('allows repeats when unique is off, even if the alphabet is tiny', () => {
    const result = generateStrings({ ...BASE, count: 20, length: 1 })
    expect(result.ok && result.value.values).toHaveLength(20)
  })
})
