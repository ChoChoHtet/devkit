import { describe, expect, it } from 'vitest'
import { decodeJwt } from '../../../app/utils/jwt/decode'
import { signJwt } from '../../../app/utils/jwt/sign'
import { verifyJwtSignature } from '../../../app/utils/jwt/verify'

function toPem(der: ArrayBuffer, label: string): string {
  const base64 = Buffer.from(der).toString('base64')
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function decodeOrThrow(token: string) {
  const result = decodeJwt(token)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('signJwt', () => {
  it('signs an HS256 token that verifies with the same secret', async () => {
    const result = await signJwt('{"alg":"HS256","typ":"JWT"}', '{"sub":"1"}', 'top-secret')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.token.split('.')).toHaveLength(3)
    const verified = await verifyJwtSignature(decodeOrThrow(result.value.token), 'top-secret')
    expect(verified).toEqual({ ok: true, value: { alg: 'HS256', valid: true } })
  })

  it('rejects verification with the wrong secret', async () => {
    const result = await signJwt('{"alg":"HS256"}', '{"sub":"1"}', 'right-secret')
    if (!result.ok) throw new Error('expected success')
    const verified = await verifyJwtSignature(decodeOrThrow(result.value.token), 'wrong-secret')
    expect(verified).toEqual({ ok: true, value: { alg: 'HS256', valid: false } })
  })

  it('signs an RS256 token that verifies with the matching public key', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)

    const result = await signJwt('{"alg":"RS256","typ":"JWT"}', '{"sub":"1"}', toPem(pkcs8, 'PRIVATE KEY'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const verified = await verifyJwtSignature(decodeOrThrow(result.value.token), toPem(spki, 'PUBLIC KEY'))
    expect(verified).toEqual({ ok: true, value: { alg: 'RS256', valid: true } })
  })

  it('signs an ES256 token that verifies with the matching public key', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)

    const result = await signJwt('{"alg":"ES256"}', '{"sub":"1"}', toPem(pkcs8, 'PRIVATE KEY'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const verified = await verifyJwtSignature(decodeOrThrow(result.value.token), toPem(spki, 'PUBLIC KEY'))
    expect(verified).toEqual({ ok: true, value: { alg: 'ES256', valid: true } })
  })

  it('produces an empty, insecure signature for alg: none', async () => {
    const result = await signJwt('{"alg":"none"}', '{"sub":"1"}', '')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ token: expect.stringMatching(/\.$/), alg: 'none', insecure: true })
    const decoded = decodeOrThrow(result.value.token)
    expect(decoded.signatureBytes).toHaveLength(0)
  })

  it('rejects invalid header JSON', async () => {
    const result = await signJwt('not json', '{"sub":"1"}', 'secret')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('Header is not valid JSON')
  })

  it('rejects invalid payload JSON', async () => {
    const result = await signJwt('{"alg":"HS256"}', 'not json', 'secret')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('Payload is not valid JSON')
  })

  it('rejects a header without alg', async () => {
    const result = await signJwt('{}', '{"sub":"1"}', 'secret')
    expect(result.ok).toBe(false)
  })

  it('rejects an unsupported algorithm', async () => {
    const result = await signJwt('{"alg":"HS1"}', '{"sub":"1"}', 'secret')
    expect(result.ok).toBe(false)
  })

  it('rejects an empty secret', async () => {
    const result = await signJwt('{"alg":"HS256"}', '{"sub":"1"}', '')
    expect(result.ok).toBe(false)
  })
})
