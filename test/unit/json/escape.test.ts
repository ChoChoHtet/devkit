import { describe, expect, it } from 'vitest'
import { escapeJson, unescapeJson } from '../../../app/utils/json/escape'

describe('escapeJson', () => {
  it('wraps the text in a JSON string literal', () => {
    expect(escapeJson('{"a":"b\\c"}\n')).toEqual({ ok: true, value: '"{\\"a\\":\\"b\\\\c\\"}\\n"' })
  })

  it('rejects empty input', () => {
    expect(escapeJson('').ok).toBe(false)
  })
})

describe('unescapeJson', () => {
  it('reverses escapeJson and flags valid JSON', () => {
    const original = '{\n  "a": "x\\"y"\n}'
    const escaped = escapeJson(original)
    expect(escaped.ok).toBe(true)
    if (escaped.ok) expect(unescapeJson(escaped.value)).toEqual({ ok: true, value: { text: original, validJson: true } })
  })

  it('accepts an escaped body without surrounding quotes', () => {
    expect(unescapeJson('{\\"a\\":1}')).toEqual({ ok: true, value: { text: '{"a":1}', validJson: true } })
  })

  it('reports when the unescaped text is not JSON', () => {
    expect(unescapeJson('"hello\\nworld"')).toEqual({ ok: true, value: { text: 'hello\nworld', validJson: false } })
  })

  it('rejects text that is not a valid string literal', () => {
    const result = unescapeJson('{"a":1}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/not a valid escaped JSON string/)
  })

  it('rejects a quoted literal that is not a string', () => {
    expect(unescapeJson('"a" ').ok).toBe(true)
    expect(unescapeJson('').ok).toBe(false)
  })
})
