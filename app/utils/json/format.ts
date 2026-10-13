import { fail, ok } from '../result'
import type { Result, ToolError } from '../result'

export type JsonIndent = 2 | 4 | 'tab'

export interface JsonFormatOptions {
  indent: JsonIndent
  sortKeys: boolean
}

export interface JsonParseInfo {
  valid: boolean
  error?: ToolError
  hasUnsafeIntegers: boolean
  size: number
}

export interface JsonInspection {
  info: JsonParseInfo
  value: unknown
}

export const JSON_INDENTS: readonly JsonIndent[] = [2, 4, 'tab']

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

export function isJsonIndent(value: unknown): value is JsonIndent {
  return value === 2 || value === 4 || value === 'tab'
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

export function locateJsonError(input: string, message: string): Pick<ToolError, 'line' | 'column'> {
  // Engines disagree: V8 says "position N (line L column C)", Firefox "line L column C", Safari gives neither.
  const lineCol = /line (\d+) column (\d+)/i.exec(message)
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) }
  const position = /position (\d+)/i.exec(message)
  const index = position ? Number(position[1]) : /end of (JSON )?input/i.test(message) ? input.length : null
  if (index === null) return {}
  const before = input.slice(0, index).split('\n')
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}

export function parseJson(input: string): Result<unknown> {
  if (input.trim() === '') return fail('Input is empty')
  try {
    return ok(JSON.parse(input))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return fail(message, locateJsonError(input, message))
  }
}

/** Scans the raw text because JSON.parse has already rounded the number by the time we see it. */
export function hasUnsafeIntegers(input: string): boolean {
  const length = input.length
  let i = 0
  while (i < length) {
    const c = input.charCodeAt(i)
    if (c === 34) {
      i++
      while (i < length) {
        const d = input.charCodeAt(i)
        if (d === 92) i += 2
        else if (d === 34) {
          i++
          break
        } else i++
      }
      continue
    }
    if (c === 45 || (c >= 48 && c <= 57)) {
      const start = i
      i++
      while (i < length) {
        const d = input.charCodeAt(i)
        if ((d >= 48 && d <= 57) || d === 46 || d === 101 || d === 69 || d === 43 || d === 45) i++
        else break
      }
      const token = input.slice(start, i)
      if (/^-?\d{16,}$/.test(token)) {
        const big = BigInt(token)
        if (big > MAX_SAFE || big < -MAX_SAFE) return true
      }
      continue
    }
    i++
  }
  return false
}

export function inspectJson(input: string): JsonInspection {
  const parsed = parseJson(input)
  const info: JsonParseInfo = {
    valid: parsed.ok,
    hasUnsafeIntegers: parsed.ok && hasUnsafeIntegers(input),
    size: input.length,
  }
  if (!parsed.ok) info.error = parsed.error
  return { info, value: parsed.ok ? parsed.value : undefined }
}

/** `indent: null` produces minified output. */
export function stringifyJson(value: unknown, indent: JsonIndent | null, sortKeys: boolean): string {
  const prepared = sortKeys ? sortKeysDeep(value) : value
  if (indent === null) return JSON.stringify(prepared)
  return JSON.stringify(prepared, null, indent === 'tab' ? '\t' : indent)
}

export function formatJson(input: string, options: JsonFormatOptions): Result<string> {
  const parsed = parseJson(input)
  if (!parsed.ok) return parsed
  return ok(stringifyJson(parsed.value, options.indent, options.sortKeys))
}

export function minifyJson(input: string, sortKeys: boolean = false): Result<string> {
  const parsed = parseJson(input)
  if (!parsed.ok) return parsed
  return ok(stringifyJson(parsed.value, null, sortKeys))
}
