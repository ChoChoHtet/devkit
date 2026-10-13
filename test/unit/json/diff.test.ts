import { describe, expect, it } from 'vitest'
import { compareJsonTexts, diffJson, pathToJsonPath } from '../../../app/utils/json/diff'

describe('diffJson', () => {
  it('ignores key order', () => {
    expect(diffJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toEqual([])
  })

  it('reports added, removed and changed paths', () => {
    expect(diffJson({ a: 1, b: { c: [1, 2] }, d: 1 }, { a: 1, b: { c: [1, 3, 4] }, e: null })).toEqual([
      { path: '$.b.c[1]', kind: 'changed', left: 2, right: 3 },
      { path: '$.b.c[2]', kind: 'added', right: 4 },
      { path: '$.d', kind: 'removed', left: 1 },
      { path: '$.e', kind: 'added', right: null },
    ])
  })

  it('treats a type change as a change', () => {
    expect(diffJson({ a: 1 }, { a: '1' })).toEqual([{ path: '$.a', kind: 'changed', left: 1, right: '1' }])
    expect(diffJson({ a: [1] }, { a: { 0: 1 } })).toEqual([{ path: '$.a', kind: 'changed', left: [1], right: { 0: 1 } }])
  })

  it('compares primitives and mismatched containers at the root', () => {
    expect(diffJson(1, 1)).toEqual([])
    expect(diffJson('a', 'b')).toEqual([{ path: '$', kind: 'changed', left: 'a', right: 'b' }])
    expect(diffJson([1], { 0: 1 })).toEqual([{ path: '$', kind: 'changed', left: [1], right: { 0: 1 } }])
  })

  it('uses bracket notation for awkward keys', () => {
    expect(pathToJsonPath(['odd key', 0, 'x'])).toBe("$['odd key'][0].x")
  })
})

describe('compareJsonTexts', () => {
  it('returns entries and both parsed values', () => {
    const result = compareJsonTexts('{"a":1}', '{"a":2}')
    expect(result).toEqual({
      ok: true,
      value: { entries: [{ path: '$.a', kind: 'changed', left: 1, right: 2 }], left: { a: 1 }, right: { a: 2 } },
    })
  })

  it('says which side is invalid, with its location', () => {
    const left = compareJsonTexts('{"a":1,}', '{}')
    expect(left).toMatchObject({ ok: false, side: 'left', error: { line: 1, column: 8 } })
    const right = compareJsonTexts('{}', '{\n  oops\n}')
    expect(right).toMatchObject({ ok: false, side: 'right', error: { line: 2 } })
    if (!right.ok) expect(right.error.message).toMatch(/^Right: /)
  })
})
