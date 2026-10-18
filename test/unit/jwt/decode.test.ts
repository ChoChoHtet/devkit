import { describe, expect, it } from 'vitest'
import { base64UrlDecodeToText, base64UrlEncodeBytes, classifyTimings, decodeJwt, splitJwt } from '../../../app/utils/jwt/decode'

function encodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function makeToken(header: unknown, payload: unknown, signature = 'sig'): string {
  return `${encodeJson(header)}.${encodeJson(payload)}.${signature}`
}

describe('splitJwt', () => {
  it('rejects empty input', () => {
    expect(splitJwt('').ok).toBe(false)
  })

  it('rejects a token without exactly 3 parts', () => {
    expect(splitJwt('a.b').ok).toBe(false)
    expect(splitJwt('a.b.c.d').ok).toBe(false)
  })

  it('splits a well-formed token', () => {
    expect(splitJwt('a.b.c')).toEqual({ ok: true, value: { header: 'a', payload: 'b', signature: 'c' } })
  })
})

describe('base64UrlDecodeToText', () => {
  it('decodes padded and unpadded Base64URL', () => {
    expect(base64UrlDecodeToText(base64UrlEncodeBytes(new TextEncoder().encode('hello')))).toEqual({ ok: true, value: 'hello' })
  })

  it('fails on invalid Base64URL', () => {
    expect(base64UrlDecodeToText('***').ok).toBe(false)
  })
})

describe('decodeJwt', () => {
  it('decodes header and payload', () => {
    const token = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: '123' })
    const result = decodeJwt(token)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.header).toEqual({ alg: 'HS256', typ: 'JWT' })
      expect(result.value.payload).toEqual({ sub: '123' })
    }
  })

  it('rejects a header that is not a JSON object', () => {
    const token = makeToken([1, 2], { sub: '123' })
    expect(decodeJwt(token).ok).toBe(false)
  })

  it('rejects malformed Base64URL segments', () => {
    expect(decodeJwt('***.***.***').ok).toBe(false)
  })
})

describe('classifyTimings', () => {
  const now = 1_700_000_000_000

  it('flags an expired token', () => {
    const timings = classifyTimings({ exp: now / 1000 - 10 }, now)
    expect(timings).toEqual([{ claim: 'exp', seconds: now / 1000 - 10, date: new Date(now - 10_000).toISOString(), status: 'expired' }])
  })

  it('flags a not-yet-valid token', () => {
    const timings = classifyTimings({ nbf: now / 1000 + 10 }, now)
    expect(timings[0]?.status).toBe('not-yet-valid')
  })

  it('treats a future exp and past nbf as active', () => {
    const timings = classifyTimings({ exp: now / 1000 + 10, nbf: now / 1000 - 10, iat: now / 1000 - 10 }, now)
    expect(timings.every((t) => t.status === 'active')).toBe(true)
  })

  it('ignores non-numeric claims', () => {
    expect(classifyTimings({ exp: 'soon' }, now)).toEqual([])
  })
})
