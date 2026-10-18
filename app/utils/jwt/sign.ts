import { fail, ok } from '../result'
import type { Result } from '../result'
import { base64UrlEncodeBytes } from './decode'
import { pemToDer } from './pem'
import { ecKeyParams, hmacKeyParams, isHmacAlg, isRsaAlg, isSupportedAlg, keyInputKindFor, operationParams, rsaKeyParams } from './alg'
import type { EcAlg, HmacAlg, RsaAlg } from './alg'

export interface SignedJwt {
  token: string
  alg: string
  insecure?: boolean
}

function parseJsonObject(text: string, part: string): Result<Record<string, unknown>> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    return fail(`${part} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${part} must be a JSON object`)
  return ok(value as Record<string, unknown>)
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

async function importHmacKey(alg: HmacAlg, secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), hmacKeyParams(alg), false, ['sign'])
}

async function importRsaKey(alg: RsaAlg, der: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', der, rsaKeyParams(alg), false, ['sign'])
}

async function importEcKey(alg: EcAlg, der: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', der, ecKeyParams(alg), false, ['sign'])
}

/**
 * Builds and signs a JWT from header/payload JSON text, using the algorithm named in the header.
 * HMAC algorithms take a shared secret; RSA/RSA-PSS/ECDSA take an unencrypted PKCS8 PEM private key.
 */
export async function signJwt(headerText: string, payloadText: string, keyMaterial: string): Promise<Result<SignedJwt>> {
  const header = parseJsonObject(headerText, 'Header')
  if (!header.ok) return header
  const payload = parseJsonObject(payloadText, 'Payload')
  if (!payload.ok) return payload

  const alg = header.value.alg
  if (typeof alg !== 'string' || alg === '') return fail('Header is missing "alg"')

  const signingInput = `${base64UrlEncodeJson(header.value)}.${base64UrlEncodeJson(payload.value)}`

  if (alg === 'none') return ok({ token: `${signingInput}.`, alg, insecure: true })
  if (!isSupportedAlg(alg)) return fail(`Unsupported algorithm: ${alg}`)
  if (keyMaterial.trim() === '') return fail(keyInputKindFor(alg, 'sign') === 'secret' ? 'Secret is empty' : 'Private key is empty')

  const bytes = new TextEncoder().encode(signingInput)

  try {
    let signature: ArrayBuffer
    if (isHmacAlg(alg)) {
      const key = await importHmacKey(alg, keyMaterial)
      signature = await crypto.subtle.sign('HMAC', key, bytes)
    } else {
      const der = pemToDer(keyMaterial)
      if (!der.ok) return der
      const key = isRsaAlg(alg) ? await importRsaKey(alg, der.value) : await importEcKey(alg, der.value)
      signature = await crypto.subtle.sign(operationParams(alg), key, bytes)
    }
    return ok({ token: `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`, alg })
  } catch (e) {
    return fail(`Signing failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}
