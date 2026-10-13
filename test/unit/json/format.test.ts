import { describe, expect, it } from 'vitest'
import {
  formatJson,
  hasUnsafeIntegers,
  inspectJson,
  isJsonIndent,
  locateJsonError,
  minifyJson,
  parseJson,
  sortKeysDeep,
  stringifyJson,
} from '../../../app/utils/json/format'

describe('formatJson', () => {
  it('pretty-prints with sorted keys at every level', () => {
    expect(formatJson('{"b":1,"a":{"d":1,"c":2}}', { indent: 2, sortKeys: true })).toEqual({
      ok: true,
      value: '{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}',
    })
  })

  it('keeps key order when sorting is off', () => {
    const result = formatJson('{"b":1,"a":2}', { indent: 4, sortKeys: false })
    expect(result).toEqual({ ok: true, value: '{\n    "b": 1,\n    "a": 2\n}' })
  })

  it('indents with tabs', () => {
    expect(formatJson('{"a":[1]}', { indent: 'tab', sortKeys: false })).toEqual({ ok: true, value: '{\n\t"a": [\n\t\t1\n\t]\n}' })
  })

  it('reports the line and column of a syntax error', () => {
    const result = formatJson('{\n  "a": 1,\n}', { indent: 2, sortKeys: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ line: 3, column: 1 })
  })

  it('rejects empty input', () => {
    expect(formatJson('   ', { indent: 2, sortKeys: false })).toEqual({ ok: false, error: { message: 'Input is empty' } })
  })
})

describe('minifyJson', () => {
  it('removes insignificant whitespace', () => {
    expect(minifyJson('{ "a" : [1, 2] }')).toEqual({ ok: true, value: '{"a":[1,2]}' })
  })

  it('can sort keys while minifying', () => {
    expect(minifyJson('{"b":1,"a":2}', true)).toEqual({ ok: true, value: '{"a":2,"b":1}' })
  })
})

describe('sortKeysDeep', () => {
  it('sorts objects inside arrays but keeps array order', () => {
    expect(JSON.stringify(sortKeysDeep([{ b: 1, a: 2 }, 3, { d: { z: 1, y: 2 } }]))).toBe('[{"a":2,"b":1},3,{"d":{"y":2,"z":1}}]')
  })
})

describe('locateJsonError', () => {
  it('reads the V8 "(line L column C)" form', () => {
    expect(locateJsonError('', 'Expected double-quoted property name in JSON at position 7 (line 1 column 8)')).toEqual({ line: 1, column: 8 })
  })

  it('reads the Firefox form', () => {
    expect(locateJsonError('', 'JSON.parse: expected property name at line 3 column 1 of the JSON data')).toEqual({ line: 3, column: 1 })
  })

  it('computes line and column from a bare position', () => {
    expect(locateJsonError('{\n"a":x}', 'Unexpected token in JSON at position 6')).toEqual({ line: 2, column: 5 })
  })

  it('points at the end of input for "Unexpected end of JSON input"', () => {
    expect(locateJsonError('{"a":', 'Unexpected end of JSON input')).toEqual({ line: 1, column: 6 })
  })

  it('returns no location when the message has none', () => {
    expect(locateJsonError('nope', 'Unexpected token')).toEqual({})
  })
})

describe('hasUnsafeIntegers', () => {
  it.each([
    ['{"id": 9007199254740993}', true],
    ['[-9007199254740993]', true],
    ['{"id": 9007199254740991}', false],
    ['{"id": "9007199254740993"}', false],
    ['{"note": "escaped \\" 9007199254740993"}', false],
    ['{"f": 12345678901234567.5}', false],
    ['{"e": 1e400}', false],
  ])('%s → %s', (input: string, expected: boolean) => {
    expect(hasUnsafeIntegers(input)).toBe(expected)
  })
})

describe('inspectJson', () => {
  it('returns the parsed value with validity, size and the unsafe-number flag', () => {
    const inspection = inspectJson('{"id": 9007199254740993}')
    expect(inspection.info).toEqual({ valid: true, hasUnsafeIntegers: true, size: 24 })
    expect(inspection.value).toEqual({ id: 9007199254740992 })
  })

  it('carries the error for invalid input', () => {
    const inspection = inspectJson('{"a":1,}')
    expect(inspection.info.valid).toBe(false)
    expect(inspection.info.error).toMatchObject({ line: 1, column: 8 })
    expect(inspection.value).toBeUndefined()
  })
})

describe('parseJson / stringifyJson / isJsonIndent', () => {
  it('parses primitives at the root', () => {
    expect(parseJson('"x"')).toEqual({ ok: true, value: 'x' })
  })

  it('minifies when indent is null', () => {
    expect(stringifyJson({ b: 1, a: [1] }, null, true)).toBe('{"a":[1],"b":1}')
  })

  it('accepts only 2, 4 and "tab"', () => {
    expect([2, 4, 'tab', 3, '2', null].map(isJsonIndent)).toEqual([true, true, true, false, false, false])
  })
})
