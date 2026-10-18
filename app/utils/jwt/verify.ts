import { fail, ok } from '../result'
import type { Result } from '../result'
import type { JwtDecoded } from './decode'
import { pemToDer } from './pem'
import { ecKeyParams, hmacKeyParams, isHmacAlg, isRsaAlg, isSupportedAlg, keyInputKindFor, operationParams, rsaKeyParams } from './alg'
import type { EcAlg, HmacAlg, RsaAlg } from './alg'

export interface VerifyOutcome {
  alg: string
  valid: boolean
  insecure?: boolean
}

async function importHmacKey(alg: HmacAlg, secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), hmacKeyParams(alg), false, ['verify'])
}

async function importRsaKey(alg: RsaAlg, der: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', der, rsaKeyParams(alg), false, ['verify'])
}

async function importEcKey(alg: EcAlg, der: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', der, ecKeyParams(alg), false, ['verify'])
}

/**
 * Verifies a JWT's signature against the algorithm named in its own header, using either a
 * shared secret (HMAC) or an SPKI PEM public key (RSA/RSA-PSS/ECDSA). `alg: "none"` only ever
 * "verifies" against an empty signature, and is flagged insecure either way.
 */
export async function verifyJwtSignature(decoded: JwtDecoded, keyMaterial: string): Promise<Result<VerifyOutcome>> {
  const alg = decoded.header.alg
  if (typeof alg !== 'string' || alg === '') return fail('Header is missing "alg"')

  if (alg === 'none') return ok({ alg, valid: decoded.signatureBytes.length === 0, insecure: true })
  if (!isSupportedAlg(alg)) return fail(`Unsupported algorithm: ${alg}`)
  if (keyMaterial.trim() === '') return fail(keyInputKindFor(alg, 'verify') === 'secret' ? 'Secret is empty' : 'Public key is empty')

  const signingInput = new TextEncoder().encode(`${decoded.raw.header}.${decoded.raw.payload}`)

  try {
    if (isHmacAlg(alg)) {
      const key = await importHmacKey(alg, keyMaterial)
      const valid = await crypto.subtle.verify('HMAC', key, decoded.signatureBytes, signingInput)
      return ok({ alg, valid })
    }

    const der = pemToDer(keyMaterial)
    if (!der.ok) return der
    const key = isRsaAlg(alg) ? await importRsaKey(alg, der.value) : await importEcKey(alg, der.value)
    const valid = await crypto.subtle.verify(operationParams(alg), key, decoded.signatureBytes, signingInput)
    return ok({ alg, valid })
  } catch (e) {
    return fail(`Verification failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}
