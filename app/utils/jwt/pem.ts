import { fail, ok } from '../result'
import type { Result } from '../result'

/** Strips PEM armor (`-----BEGIN ...-----` / `-----END ...-----`) and decodes the Base64 body to DER bytes. */
export function pemToDer(pem: string): Result<Uint8Array<ArrayBuffer>> {
  const body = pem
    .trim()
    .split('\n')
    .filter((line) => !line.includes('-----'))
    .join('')
    .replace(/\s+/g, '')
  if (body === '') return fail('Key is empty')
  try {
    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return ok(bytes)
  } catch {
    return fail('Key is not valid PEM/Base64')
  }
}
