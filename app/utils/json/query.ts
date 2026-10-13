import { JSONPath } from 'jsonpath-plus'
import { fail, ok } from '../result'
import type { Result } from '../result'

export interface JsonQueryResult {
  matches: unknown[]
  count: number
}

type JsonPathInput = null | boolean | number | string | object | unknown[]

export function queryJson(value: unknown, expression: string): Result<JsonQueryResult> {
  const path = expression.trim()
  if (path === '') return fail('Enter a JSONPath expression, e.g. $.items[*].id')
  if (value === undefined) return fail('Fix the JSON input to run a query')
  try {
    // 'safe' uses jsonpath-plus's own expression evaluator, never eval/Function.
    const matches: unknown = JSONPath({ path, json: value as JsonPathInput, eval: 'safe', wrap: true })
    const list: unknown[] = Array.isArray(matches) ? matches : []
    return ok({ matches: list, count: list.length })
  } catch (e) {
    return fail(`Invalid JSONPath expression: ${e instanceof Error ? e.message : String(e)}`)
  }
}
