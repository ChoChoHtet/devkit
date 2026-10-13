import { fail, ok } from '../result'
import type { Result } from '../result'
import { parseJson } from './format'

export interface UnescapeResult {
  text: string
  validJson: boolean
}

export function escapeJson(input: string): Result<string> {
  if (input === '') return fail('Input is empty')
  return ok(JSON.stringify(input))
}

/** Accepts a quoted string literal, or the escaped body without surrounding quotes (as copied from logs). */
export function unescapeJson(input: string): Result<UnescapeResult> {
  const trimmed = input.trim()
  if (trimmed === '') return fail('Input is empty')
  const literal = trimmed.startsWith('"') ? trimmed : `"${trimmed}"`
  let text: unknown
  try {
    text = JSON.parse(literal)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return fail(`Input is not a valid escaped JSON string: ${reason}`)
  }
  if (typeof text !== 'string') return fail('Input is not a JSON string literal')
  return ok({ text, validJson: parseJson(text).ok })
}
