import { fail, ok } from '../result'
import type { Result } from '../result'

export interface JwtSegments {
  header: string
  payload: string
  signature: string
}

export type ClaimTimeStatus = 'expired' | 'not-yet-valid' | 'active'

export interface ClaimTiming {
  claim: 'exp' | 'nbf' | 'iat'
  seconds: number
  date: string
  status: ClaimTimeStatus
}

export interface JwtDecoded {
  raw: JwtSegments
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signatureBytes: Uint8Array<ArrayBuffer>
  timings: ClaimTiming[]
}

function base64UrlToBase64(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = padded.length % 4
  return remainder === 0 ? padded : padded + '='.repeat(4 - remainder)
}

export function base64UrlEncodeBytes(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecodeToBytes(segment: string): Result<Uint8Array<ArrayBuffer>> {
  if (segment === '') return ok(new Uint8Array())
  try {
    const binary = atob(base64UrlToBase64(segment))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return ok(bytes)
  } catch {
    return fail('Not valid Base64URL')
  }
}

export function base64UrlDecodeToText(segment: string): Result<string> {
  const bytes = base64UrlDecodeToBytes(segment)
  if (!bytes.ok) return bytes
  try {
    return ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes.value))
  } catch {
    return fail('Not valid UTF-8 text')
  }
}

function parseSegmentJson(segment: string, part: string): Result<Record<string, unknown>> {
  const text = base64UrlDecodeToText(segment)
  if (!text.ok) return fail(`${part} is not valid Base64URL: ${text.error.message}`)
  let value: unknown
  try {
    value = JSON.parse(text.value)
  } catch (e) {
    return fail(`${part} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(`${part} must be a JSON object`)
  }
  return ok(value as Record<string, unknown>)
}

export function splitJwt(token: string): Result<JwtSegments> {
  const trimmed = token.trim()
  if (trimmed === '') return fail('Input is empty')
  const parts = trimmed.split('.')
  if (parts.length !== 3) return fail(`A JWT has 3 dot-separated parts; found ${parts.length}`)
  const [header, payload, signature] = parts as [string, string, string]
  return ok({ header, payload, signature })
}

function claimSeconds(payload: Record<string, unknown>, claim: 'exp' | 'nbf' | 'iat'): number | null {
  const value = payload[claim]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function classifyTimings(payload: Record<string, unknown>, now: number = Date.now()): ClaimTiming[] {
  const nowSeconds = now / 1000
  const timings: ClaimTiming[] = []
  for (const claim of ['exp', 'nbf', 'iat'] as const) {
    const seconds = claimSeconds(payload, claim)
    if (seconds === null) continue
    const status: ClaimTimeStatus =
      claim === 'exp' && seconds <= nowSeconds
        ? 'expired'
        : claim === 'nbf' && seconds > nowSeconds
          ? 'not-yet-valid'
          : 'active'
    timings.push({ claim, seconds, date: new Date(seconds * 1000).toISOString(), status })
  }
  return timings
}

export function decodeJwt(token: string, now: number = Date.now()): Result<JwtDecoded> {
  const segments = splitJwt(token)
  if (!segments.ok) return segments

  const header = parseSegmentJson(segments.value.header, 'Header')
  if (!header.ok) return header
  const payload = parseSegmentJson(segments.value.payload, 'Payload')
  if (!payload.ok) return payload
  const signatureBytes = base64UrlDecodeToBytes(segments.value.signature)
  if (!signatureBytes.ok) return fail(`Signature is not valid Base64URL: ${signatureBytes.error.message}`)

  return ok({
    raw: segments.value,
    header: header.value,
    payload: payload.value,
    signatureBytes: signatureBytes.value,
    timings: classifyTimings(payload.value, now),
  })
}
