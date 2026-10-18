export type HmacAlg = 'HS256' | 'HS384' | 'HS512'
export type RsaAlg = 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'PS384' | 'PS512'
export type EcAlg = 'ES256' | 'ES384' | 'ES512'
export type SupportedAlg = HmacAlg | RsaAlg | EcAlg

export type KeyInputKind = 'secret' | 'public-key' | 'private-key'
export type KeyUse = 'sign' | 'verify'

const HMAC_HASH: Readonly<Record<HmacAlg, string>> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }
const RSA_HASH: Readonly<Record<RsaAlg, string>> = {
  RS256: 'SHA-256',
  RS384: 'SHA-384',
  RS512: 'SHA-512',
  PS256: 'SHA-256',
  PS384: 'SHA-384',
  PS512: 'SHA-512',
}
// RFC 7518: PSS salt length equals the hash output size.
const PSS_SALT_LENGTH: Readonly<Record<RsaAlg, number>> = { RS256: 0, RS384: 0, RS512: 0, PS256: 32, PS384: 48, PS512: 64 }
const EC_CURVE: Readonly<Record<EcAlg, string>> = { ES256: 'P-256', ES384: 'P-384', ES512: 'P-521' }

export function isHmacAlg(alg: string): alg is HmacAlg {
  return alg in HMAC_HASH
}

export function isRsaAlg(alg: string): alg is RsaAlg {
  return alg in RSA_HASH
}

export function isEcAlg(alg: string): alg is EcAlg {
  return alg in EC_CURVE
}

export function isSupportedAlg(alg: string): alg is SupportedAlg {
  return isHmacAlg(alg) || isRsaAlg(alg) || isEcAlg(alg)
}

/** The key material an algorithm family needs: a shared secret, or an asymmetric key (public to verify, private to sign). */
export function keyInputKindFor(alg: string, use: KeyUse): KeyInputKind {
  if (isHmacAlg(alg)) return 'secret'
  return use === 'sign' ? 'private-key' : 'public-key'
}

export function hmacKeyParams(alg: HmacAlg): { name: 'HMAC'; hash: string } {
  return { name: 'HMAC', hash: HMAC_HASH[alg] }
}

export function rsaKeyParams(alg: RsaAlg): { name: 'RSA-PSS' | 'RSASSA-PKCS1-v1_5'; hash: string } {
  return { name: alg.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5', hash: RSA_HASH[alg] }
}

export function ecKeyParams(alg: EcAlg): { name: 'ECDSA'; namedCurve: string } {
  return { name: 'ECDSA', namedCurve: EC_CURVE[alg] }
}

/** The algorithm parameter for `crypto.subtle.sign`/`verify` (as opposed to `importKey`), shared by both operations. */
export function operationParams(alg: RsaAlg | EcAlg): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  if (isRsaAlg(alg)) {
    return alg.startsWith('PS') ? { name: 'RSA-PSS', saltLength: PSS_SALT_LENGTH[alg] } : 'RSASSA-PKCS1-v1_5'
  }
  return { name: 'ECDSA', hash: alg === 'ES256' ? 'SHA-256' : alg === 'ES384' ? 'SHA-384' : 'SHA-512' }
}
