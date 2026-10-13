import { describe, expect, it } from 'vitest'
import { buildChildren, childPath, createRootNode, getJsonType, isExpandedFor, previewValue } from '../../../app/utils/json/tree'

describe('childPath', () => {
  it('uses dot notation for identifiers and indexes for arrays', () => {
    expect(childPath(childPath('$', 'items'), 3)).toBe('$.items[3]')
  })

  it('uses quoted bracket notation for other keys, escaping quotes and backslashes', () => {
    expect(childPath('$', 'odd key')).toBe("$['odd key']")
    expect(childPath('$', "it's\\x")).toBe("$['it\\'s\\\\x']")
    expect(childPath('$', '1st')).toBe("$['1st']")
  })
})

describe('getJsonType / createRootNode', () => {
  it('classifies every JSON type', () => {
    expect([{}, [], 's', 1, true, null].map(getJsonType)).toEqual(['object', 'array', 'string', 'number', 'boolean', 'null'])
  })

  it('records child counts for containers and values for leaves', () => {
    expect(createRootNode({ a: 1, b: 2 })).toEqual({ key: null, path: '$', type: 'object', childCount: 2 })
    expect(createRootNode([1, 2, 3])).toEqual({ key: null, path: '$', type: 'array', childCount: 3 })
    expect(createRootNode('x')).toEqual({ key: null, path: '$', type: 'string', value: 'x' })
  })
})

describe('buildChildren', () => {
  it('builds object children with paths', () => {
    const children = buildChildren({ a: 1, 'b c': [true] }, '$')
    expect(children.map((c) => c.node)).toEqual([
      { key: 'a', path: '$.a', type: 'number', value: 1 },
      { key: 'b c', path: "$['b c']", type: 'array', childCount: 1 },
    ])
    expect(children[1]?.value).toEqual([true])
  })

  it('pages through array children', () => {
    const value = Array.from({ length: 1200 }, (_, i) => i)
    const page = buildChildren(value, '$', 500, 500)
    expect(page).toHaveLength(500)
    expect(page[0]?.node).toEqual({ key: 500, path: '$[500]', type: 'number', value: 500 })
  })

  it('returns no children for leaves', () => {
    expect(buildChildren(42, '$')).toEqual([])
  })
})

describe('previewValue', () => {
  it('summarises containers and truncates long strings', () => {
    expect(previewValue({ a: 1 })).toBe('{…} 1 key')
    expect(previewValue([1, 2])).toBe('[…] 2 items')
    expect(previewValue('x'.repeat(10), 4)).toBe('"xxxx…"')
    expect(previewValue(null)).toBe('null')
    expect(previewValue(undefined)).toBe('—')
  })
})

describe('isExpandedFor', () => {
  it('opens levels 1–2 by default, everything for "all", only the root for "none"', () => {
    expect([0, 1, 2].map((d) => isExpandedFor('default', d))).toEqual([true, true, false])
    expect(isExpandedFor('all', 9)).toBe(true)
    expect([0, 1].map((d) => isExpandedFor('none', d))).toEqual([true, false])
  })
})
