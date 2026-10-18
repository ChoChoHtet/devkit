import { base64UrlEncodeBytes } from './decode'

export const JWT_SAMPLE_SECRET = 'devkit-sample-secret'

const JWT_SAMPLE_HEADER = { alg: 'HS256', typ: 'JWT' } as const

function jwtSamplePayload(now: number): Record<string, unknown> {
  const nowSeconds = Math.floor(now / 1000)
  return {
    sub: 'user_01hzx',
    name: 'Ada Lovelace',
    role: 'admin',
    iat: nowSeconds - 60,
    nbf: nowSeconds - 60,
    exp: nowSeconds + 3600,
    iss: 'devkit',
    aud: 'devkit-sample',
  }
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

/** Signs a fresh HS256 sample token (claims are relative to `now`, so it's always valid). */
export async function buildJwtSample(now: number = Date.now()): Promise<string> {
  const header = base64UrlEncodeJson(JWT_SAMPLE_HEADER)
  const payload = base64UrlEncodeJson(jwtSamplePayload(now))
  const signingInput = new TextEncoder().encode(`${header}.${payload}`)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SAMPLE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', key, signingInput)
  return `${header}.${payload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`
}
