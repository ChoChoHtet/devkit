import { describe, expect, it } from 'vitest'
import { base64UrlEncodeBytes, decodeJwt } from '../../../app/utils/jwt/decode'
import type { JwtDecoded } from '../../../app/utils/jwt/decode'
import { verifyJwtSignature } from '../../../app/utils/jwt/verify'

function encodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function toPem(der: ArrayBuffer): string {
  const base64 = Buffer.from(der).toString('base64')
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`
}

async function sign(alg: string, signingInput: string, secretOrKey: CryptoKey): Promise<string> {
  const params =
    alg.startsWith('HS')
      ? 'HMAC'
      : alg.startsWith('PS')
        ? { name: 'RSA-PSS', saltLength: alg === 'PS256' ? 32 : alg === 'PS384' ? 48 : 64 }
        : alg.startsWith('RS')
          ? 'RSASSA-PKCS1-v1_5'
          : { name: 'ECDSA', hash: alg === 'ES256' ? 'SHA-256' : alg === 'ES384' ? 'SHA-384' : 'SHA-512' }
  const signature = await crypto.subtle.sign(params, secretOrKey, new TextEncoder().encode(signingInput))
  return base64UrlEncodeBytes(new Uint8Array(signature))
}

function decodeOrThrow(token: string): JwtDecoded {
  const result = decodeJwt(token)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('verifyJwtSignature', () => {
  it('verifies a correct HS256 signature', async () => {
    const secret = 'top-secret'
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signingInput = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson({ sub: '1' })}`
    const token = `${signingInput}.${await sign('HS256', signingInput, key)}`
    const result = await verifyJwtSignature(decodeOrThrow(token), secret)
    expect(result).toEqual({ ok: true, value: { alg: 'HS256', valid: true } })
  })

  it('rejects a tampered payload under HS256', async () => {
    const secret = 'top-secret'
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signingInput = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson({ sub: '1' })}`
    const signature = await sign('HS256', signingInput, key)
    const tampered = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson({ sub: '2' })}.${signature}`
    const result = await verifyJwtSignature(decodeOrThrow(tampered), secret)
    expect(result).toEqual({ ok: true, value: { alg: 'HS256', valid: false } })
  })

  it('rejects the wrong secret under HS256', async () => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('right'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signingInput = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson({ sub: '1' })}`
    const token = `${signingInput}.${await sign('HS256', signingInput, key)}`
    const result = await verifyJwtSignature(decodeOrThrow(token), 'wrong')
    expect(result).toEqual({ ok: true, value: { alg: 'HS256', valid: false } })
  })

  it('verifies RS256 with the matching public key', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
    const signingInput = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({ sub: '1' })}`
    const token = `${signingInput}.${await sign('RS256', signingInput, pair.privateKey)}`
    const result = await verifyJwtSignature(decodeOrThrow(token), toPem(spki))
    expect(result).toEqual({ ok: true, value: { alg: 'RS256', valid: true } })
  })

  it('verifies ES256 with the matching public key', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
    const signingInput = `${encodeJson({ alg: 'ES256', typ: 'JWT' })}.${encodeJson({ sub: '1' })}`
    const token = `${signingInput}.${await sign('ES256', signingInput, pair.privateKey)}`
    const result = await verifyJwtSignature(decodeOrThrow(token), toPem(spki))
    expect(result).toEqual({ ok: true, value: { alg: 'ES256', valid: true } })
  })

  it('"none" only verifies against an empty signature, and is flagged insecure', async () => {
    const signingInput = `${encodeJson({ alg: 'none' })}.${encodeJson({ sub: '1' })}`
    const emptySig = await verifyJwtSignature(decodeOrThrow(`${signingInput}.`), '')
    expect(emptySig).toEqual({ ok: true, value: { alg: 'none', valid: true, insecure: true } })

    const nonEmptySig = await verifyJwtSignature(decodeOrThrow(`${signingInput}.abc`), '')
    expect(nonEmptySig).toEqual({ ok: true, value: { alg: 'none', valid: false, insecure: true } })
  })

  it('fails for an unsupported algorithm', async () => {
    const token = `${encodeJson({ alg: 'HS1' })}.${encodeJson({ sub: '1' })}.sig`
    const result = await verifyJwtSignature(decodeOrThrow(token), 'secret')
    expect(result.ok).toBe(false)
  })

  it('fails when the secret/key is empty', async () => {
    const token = `${encodeJson({ alg: 'HS256' })}.${encodeJson({ sub: '1' })}.sig`
    const result = await verifyJwtSignature(decodeOrThrow(token), '')
    expect(result.ok).toBe(false)
  })
})
