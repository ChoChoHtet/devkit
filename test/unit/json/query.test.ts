import { describe, expect, it } from 'vitest'
import { queryJson } from '../../../app/utils/json/query'
import { childPath } from '../../../app/utils/json/tree'

const doc = {
  items: [
    { id: 1, price: 5, name: 'a' },
    { id: 2, price: 20, name: 'b' },
  ],
  'odd key': { 'x.y': 7 },
}

describe('queryJson', () => {
  it('runs filter expressions', () => {
    expect(queryJson(doc, '$.items[?(@.price > 10)].name')).toEqual({ ok: true, value: { matches: ['b'], count: 1 } })
  })

  it('supports recursive descent', () => {
    expect(queryJson(doc, '$..id')).toEqual({ ok: true, value: { matches: [1, 2], count: 2 } })
  })

  it('returns zero matches for a missing path', () => {
    expect(queryJson(doc, '$.nope')).toEqual({ ok: true, value: { matches: [], count: 0 } })
  })

  it('accepts paths copied from the tree (bracket notation)', () => {
    expect(queryJson(doc, childPath(childPath('$', 'odd key'), 'x.y'))).toEqual({ ok: true, value: { matches: [7], count: 1 } })
  })

  it('reports invalid expressions', () => {
    const result = queryJson(doc, '$.items[?(@.price >')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/^Invalid JSONPath expression/)
  })

  it('never evaluates arbitrary code', () => {
    const result = queryJson(doc, '$.items[?(@.constructor.constructor("return process")())]')
    expect(result.ok).toBe(false)
  })

  it('asks for an expression when empty and for valid input when undefined', () => {
    expect(queryJson(doc, '  ').ok).toBe(false)
    expect(queryJson(undefined, '$').ok).toBe(false)
  })
})
