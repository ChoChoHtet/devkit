# Tool specifications

Every tool has two parts: a **pure util in `app/utils/`** (unit-tested) and a **page in
`app/pages/tools/`** (UI state only). The reference util code below was executed and
type-checked under `strict` + `noUncheckedIndexedAccess` with TypeScript 6.0, jose 6.2,
and protobufjs 8.8 on 2026-10-13. Use it as written and keep the exported names, because
testing.md depends on them.

Shared page skeleton (every tool):

```vue
<script setup lang="ts">
import { Braces } from '@lucide/vue'
useHead({ title: 'JSON Formatter' })
</script>

<template>
  <ToolPage title="JSON Formatter" description="…" :icon="Braces">
    <!-- toolbar row, then a grid: lg:grid-cols-2 input pane | output pane -->
  </ToolPage>
</template>
```

- **Panes:** `<textarea>` with `rows="16"`, `spellcheck="false"`, `autocomplete="off"`, and
  the classes `w-full rounded-md border border-border bg-surface p-3 font-mono text-sm`.
- **Output:** a read-only `<pre>` (so tests can use `.text()`), with a `<CopyButton>` in the pane header.
- **Errors:** `<p role="alert" data-testid="<tool>-error" class="text-danger">`.
- **Recompute:** output comes from `computed` over the inputs, so there's no Run button.
  JSON Formatter is the exception: it has explicit Format and Minify actions, because
  reformatting while the user types moves their cursor.
- **Empty input** means no output and no error, just a muted placeholder hint.
- **Sample button:** every tool has a "Sample" button that loads a known-good input, so it
  can be tried out quickly.

---

## 1. JSON Formatter (`/tools/json-formatter`, `app/utils/json.ts`)

### UX
- **Toolbar:** an indent `<select>` (`2`, `4`, `tab`; default `2`), a "Sort keys" checkbox,
  and the buttons **Format**, **Minify**, **Sample**, and **Clear**.
- Format and Minify write into the output pane. When the input is invalid, show the error
  message, plus "Line L, column C" when the location is known.
- A status line under the output shows "Valid JSON · N characters" when the input is valid.

### Acceptance criteria
- `{"b":1,"a":{"d":1,"c":2}}` with Sort keys and indent 2 becomes keys `a`, `c`, `d`, `b`, nested correctly.
- Minify strips all insignificant whitespace.
- `{"a":1,}` shows an error that points to line 1, column 8 (V8). The location may be missing
  in Safari, and that's acceptable.
- Large integers (> 2^53) lose precision. That's a known `JSON.parse` limitation. Show a
  warning when the input matches `/[^"\d.]\d{16,}/` and keep processing.

### Reference util

```ts
export type JsonIndent = 2 | 4 | 'tab'

export interface JsonFormatOptions {
  indent: JsonIndent
  sortKeys: boolean
}

export interface JsonErrorInfo {
  message: string
  line: number | null
  column: number | null
}

export type JsonResult = { ok: true; output: string } | { ok: false; error: JsonErrorInfo }

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

export function locateJsonError(input: string, message: string): Pick<JsonErrorInfo, 'line' | 'column'> {
  // Engines disagree: V8 says "position N (line L column C)", Firefox "line L column C", Safari gives neither.
  const lineCol = /line (\d+) column (\d+)/i.exec(message)
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) }
  const position = /position (\d+)/i.exec(message)
  const index = position ? Number(position[1]) : /end of (JSON )?input/i.test(message) ? input.length : null
  if (index === null) return { line: null, column: null }
  const before = input.slice(0, index).split('\n')
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}

function parse(input: string): { ok: true; value: unknown } | { ok: false; error: JsonErrorInfo } {
  if (input.trim() === '') return { ok: false, error: { message: 'Input is empty', line: null, column: null } }
  try {
    return { ok: true, value: JSON.parse(input) }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { message, ...locateJsonError(input, message) } }
  }
}

export function formatJson(input: string, options: JsonFormatOptions): JsonResult {
  const parsed = parse(input)
  if (!parsed.ok) return parsed
  const value = options.sortKeys ? sortKeysDeep(parsed.value) : parsed.value
  return { ok: true, output: JSON.stringify(value, null, options.indent === 'tab' ? '\t' : options.indent) }
}

export function minifyJson(input: string, sortKeys: boolean = false): JsonResult {
  const parsed = parse(input)
  if (!parsed.ok) return parsed
  return { ok: true, output: JSON.stringify(sortKeys ? sortKeysDeep(parsed.value) : parsed.value) }
}
```

**Test IDs:** `json-input`, `json-indent`, `json-sort`, `json-format`, `json-minify`,
`json-sample`, `json-clear`, `json-output`, `json-error`.

---

## 2. Base64 URL (`/tools/base64url`, `app/utils/base64url.ts` + `app/utils/bytes.ts`)

### Why hand-written
`Uint8Array.fromBase64` / `toBase64` (which take an `{ alphabet: 'base64url' }` option) are
Baseline 2025 in browsers but **not available in Node 22**, which is where the unit tests
run. The lib typings may also be missing. `atob`/`btoa` exist in both environments.

### UX
- A mode toggle (segmented control) for **Encode** and **Decode**. There's also a **Swap**
  button (`ArrowLeftRight` icon) that moves the output into the input and flips the mode.
- **Encode options:** alphabet `base64url` (default) or `base64`, and a "Padding" checkbox
  (default off for base64url, on for base64. Changing the alphabet resets padding to that
  default).
- **Decode accepts:** either alphabet, with or without padding, and with whitespace or line
  breaks (for example, pasted PEM bodies).
- **Decode output:** the UTF-8 text. If the bytes aren't valid UTF-8, show "Binary data (not
  UTF-8)" and the hex dump instead. Always show the byte count.
- Text is encoded as UTF-8 via `TextEncoder`, so emoji and non-Latin characters round-trip.

### Acceptance criteria
- `foobar` encodes to `Zm9vYmFy`, and `héllo 👋` encodes to `aMOpbGxvIPCfkYs`.
- Bytes `fb ff` give `-_8` in base64url and `+/8=` in base64. Both strings decode back to `fb ff`.
- `abc$` → error "Invalid character in Base64 input". `abcde` → error "Invalid Base64 length".

### Reference utils

`app/utils/bytes.ts` (shared with Protobuf):

```ts
export function bytesToHex(bytes: Uint8Array, separator: string = ' '): string {
  return Array.from(bytes, (b: number): string => b.toString(16).padStart(2, '0')).join(separator)
}

export function hexToBytes(input: string): Uint8Array {
  const clean = input.replace(/0x/gi, '').replace(/[\s:,]/g, '')
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Invalid hex: only 0-9, a-f allowed')
  if (clean.length % 2 !== 0) throw new Error('Invalid hex: odd number of digits')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function looksLikeHex(input: string): boolean {
  const clean = input.replace(/0x/gi, '').replace(/[\s:,]/g, '')
  return clean.length > 0 && clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean)
}
```

`app/utils/base64url.ts`:

```ts
export type Base64Alphabet = 'base64url' | 'base64'

export interface Base64EncodeOptions {
  alphabet?: Base64Alphabet
  padding?: boolean
}

export class Base64DecodeError extends Error {
  override name = 'Base64DecodeError'
}

export type Base64TextResult =
  | { ok: true; bytes: Uint8Array; text: string | null }
  | { ok: false; error: string }

const CHUNK_SIZE = 0x8000

export function bytesToBase64(bytes: Uint8Array, options: Base64EncodeOptions = {}): string {
  const alphabet: Base64Alphabet = options.alphabet ?? 'base64url'
  const padding: boolean = options.padding ?? alphabet === 'base64'
  let binary = ''
  // Spreading a huge array into fromCharCode overflows the call stack, so go in chunks.
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  let out = btoa(binary)
  if (alphabet === 'base64url') out = out.replace(/\+/g, '-').replace(/\//g, '_')
  return padding ? out : out.replace(/=+$/, '')
}

/** Accepts either alphabet, optional padding and embedded whitespace. */
export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Base64DecodeError('Invalid character in Base64 input')
  }
  const unpadded = normalized.replace(/=+$/, '')
  if (unpadded.length % 4 === 1) throw new Base64DecodeError('Invalid Base64 length')
  const binary = atob(unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4))
  return Uint8Array.from(binary, (c: string): number => c.charCodeAt(0))
}

export function encodeText(text: string, options: Base64EncodeOptions = {}): string {
  return bytesToBase64(new TextEncoder().encode(text), options)
}

export function decodeToText(input: string): Base64TextResult {
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(input)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  try {
    return { ok: true, bytes, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: true, bytes, text: null }
  }
}
```

**Test IDs:** `b64-mode-encode`, `b64-mode-decode`, `b64-alphabet`, `b64-padding`,
`b64-input`, `b64-output`, `b64-swap`, `b64-error`, `b64-bytes`.

---

## 3. JWT Inspector (`/tools/jwt-inspector`, `app/utils/jwt.ts`, uses `jose`)

### UX
- **Token input** (textarea). It accepts a leading `Bearer ` and wrapped lines.
- **Coloured token view:** the header segment in `text-danger`, the payload in
  `text-accent`, and the signature in `text-success`, separated by `.` and wrapping with
  `break-all`.
- **Three output cards:**
  - **Header:** pretty JSON with a `CopyButton`. Show `alg` and `typ` as badges.
  - **Payload:** pretty JSON with a `CopyButton`.
  - **Claims:** a table of standard claims that are present (`iss`, `sub`, `aud`, `jti`,
    `iat`, `nbf`, `exp`). The time claims show their ISO date and a relative time ("in 3h",
    "2 days ago", via `Intl.RelativeTimeFormat`).
- **Status badge** from `getTimeStatus`: `valid` (success, `ShieldCheck`), `expired` (danger,
  `ShieldAlert`), `not-yet-valid` (danger), or `no-expiry` (muted). Evaluate it against
  `Date.now()` and re-evaluate every 30 s with a plain `setInterval` (no VueUse), cleared in
  `onBeforeUnmount`.
- **Warnings:** `alg: none` → "Unsigned token". JWE (5 segments) → show the header only, with
  "Encrypted token (JWE): payload cannot be decoded without the private key."
- **Verify signature** (a collapsible section, closed by default):
  - **Key type** `<select>`: *Shared secret (HS\*)*, *Public key PEM (SPKI or X.509 cert)*, or
    *JWK (JSON)*. Preselect it from `header.alg` (`HS*` → secret, anything else → PEM).
  - A **Verify** button runs `verifyToken`, which is async. Show a spinner while it runs,
    then the result badge: signature valid or invalid, plus the message.
  - Never persist the secret or key. Clear the verification result whenever the token or key
    changes.
  - Don't fetch JWKS URLs (CORS, and the privacy rule). If the user asks for it later, it's a
    separate feature.
- WebCrypto needs a secure context (localhost or HTTPS). If `globalThis.crypto?.subtle` is
  missing, disable Verify and say why.

### Acceptance criteria
Use the jwt.io sample token, signed HS256 with the secret `your-256-bit-secret`:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```
- It decodes to header `{"alg":"HS256","typ":"JWT"}` and payload `name: "John Doe"`, with `iat`
  shown as `2018-01-18T01:30:22.000Z`. The status is `no-expiry`.
- Verifying with `your-256-bit-secret` reports valid. Any other secret reports "Invalid signature".
- `abc` → "Expected 3 (JWS) or 5 (JWE) segments, got 1".

### Reference util

```ts
import { decodeJwt, decodeProtectedHeader, errors, importJWK, importSPKI, importX509, jwtVerify } from 'jose'
import type { CryptoKey, JWK, JWTPayload, KeyObject, ProtectedHeaderParameters } from 'jose'

export type JwtKind = 'JWS' | 'JWE'

export interface DecodedJwt {
  kind: JwtKind
  header: ProtectedHeaderParameters
  payload: JWTPayload | null
  segments: string[]
}

export type JwtDecodeResult = { ok: true; jwt: DecodedJwt } | { ok: false; error: string }

export type JwtTimeStatus = 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry'

export interface JwtTimeClaim {
  claim: 'iat' | 'nbf' | 'exp'
  seconds: number
  iso: string
}

export type VerifyKeyInput =
  | { kind: 'secret'; secret: string }
  | { kind: 'pem'; pem: string }
  | { kind: 'jwk'; jwk: string }

export interface VerifyOutcome {
  signatureValid: boolean
  message: string
}

export function normalizeToken(raw: string): string {
  return raw.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '')
}

function toError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function decodeToken(raw: string): JwtDecodeResult {
  const token = normalizeToken(raw)
  if (token === '') return { ok: false, error: 'Token is empty' }
  const segments = token.split('.')
  if (segments.length !== 3 && segments.length !== 5) {
    return { ok: false, error: `Expected 3 (JWS) or 5 (JWE) segments, got ${segments.length}` }
  }
  try {
    const header = decodeProtectedHeader(token)
    if (segments.length === 5) return { ok: true, jwt: { kind: 'JWE', header, payload: null, segments } }
    return { ok: true, jwt: { kind: 'JWS', header, payload: decodeJwt(token), segments } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export function getTimeClaims(payload: JWTPayload): JwtTimeClaim[] {
  const claims: JwtTimeClaim[] = []
  for (const claim of ['iat', 'nbf', 'exp'] as const) {
    const seconds = payload[claim]
    if (typeof seconds === 'number') claims.push({ claim, seconds, iso: new Date(seconds * 1000).toISOString() })
  }
  return claims
}

export function getTimeStatus(payload: JWTPayload, nowSeconds: number): JwtTimeStatus {
  if (typeof payload.nbf === 'number' && nowSeconds < payload.nbf) return 'not-yet-valid'
  if (typeof payload.exp !== 'number') return 'no-expiry'
  return nowSeconds >= payload.exp ? 'expired' : 'valid'
}

async function importKey(input: VerifyKeyInput, alg: string): Promise<CryptoKey | KeyObject | JWK | Uint8Array> {
  switch (input.kind) {
    case 'secret':
      return new TextEncoder().encode(input.secret)
    case 'pem':
      return input.pem.includes('BEGIN CERTIFICATE') ? importX509(input.pem, alg) : importSPKI(input.pem, alg)
    case 'jwk':
      return importJWK(JSON.parse(input.jwk) as JWK, alg)
  }
}

export async function verifyToken(raw: string, keyInput: VerifyKeyInput, currentDate: Date = new Date()): Promise<VerifyOutcome> {
  const token = normalizeToken(raw)
  try {
    const { alg } = decodeProtectedHeader(token)
    if (!alg || alg === 'none') return { signatureValid: false, message: 'Token is unsigned (alg "none")' }
    const key = await importKey(keyInput, alg)
    await jwtVerify(token, key, { algorithms: [alg], currentDate })
    return { signatureValid: true, message: 'Signature verified and time claims are valid' }
  } catch (e) {
    // jose checks the signature before claims, so a claim failure means the signature itself was good.
    if (e instanceof errors.JWTExpired || e instanceof errors.JWTClaimValidationFailed) {
      return { signatureValid: true, message: `Signature verified, but ${e.message}` }
    }
    if (e instanceof errors.JWSSignatureVerificationFailed) return { signatureValid: false, message: 'Invalid signature' }
    return { signatureValid: false, message: toError(e) }
  }
}
```

`algorithms: [alg]` pins verification to the algorithm the header declares. That's correct for
an inspector, which is answering "does this key sign this token?". It's **not** the right
pattern for server-side auth, where the allowed algorithms must come from configuration.

**Test IDs:** `jwt-input`, `jwt-sample`, `jwt-header`, `jwt-payload`, `jwt-claims`, `jwt-status`,
`jwt-error`, `jwt-key-kind`, `jwt-key`, `jwt-verify`, `jwt-verify-result`.

---

## 4. Protobuf (`/tools/protobuf`, `app/utils/protobuf.ts`, uses `protobufjs`)

### Modes (tabs)
1. **Decode (raw):** schema-less wire-format decoding. This is the default tab.
2. **Decode (schema):** paste a `.proto`, pick the message type, and get JSON.
3. **Encode (schema):** paste a `.proto`, pick the message type, enter JSON, and get bytes.

### UX
- **Bytes input format** `<select>`: `auto` (default), `hex`, or `base64`. Auto treats
  even-length pure-hex input as hex and everything else as base64/base64url. `deadbeef` is
  read as hex, so tell the user to pick base64 explicitly when that's ambiguous.
- **Raw decode output:** `<ProtoFieldTree :fields>` is a recursive list. Each row shows
  `#<field> · <wire type name> · @<offset>` and then:
  - **varint:** unsigned, plus signed (int64) and zigzag (sint) when they differ.
  - **i64 (fixed64):** unsigned, signed, and double.
  - **i32 (fixed32):** unsigned, signed, and float.
  - **len:** if `message` is non-null, render the nested tree, expanded. Also show "as string"
    when `text` is non-null, and always show "as hex (N bytes)" in a `<details>`. If there's
    no message, show the string, or the hex if there's no string.
  - Wire type names: `0 varint`, `1 i64`, `2 len`, `5 i32`.
- **Schema textarea:** a monospace editor with a "Sample schema" button. The message-type
  `<select>` is filled from `listMessageTypes` and auto-selects the first type. Parse errors
  appear under the schema.
- **Schema decode output:** pretty JSON (`longs`, `enums`, and `bytes` rendered as strings,
  defaults included) with a `CopyButton`.
- **Encode output:** hex and base64 views of the encoded bytes, each with a `CopyButton`.
- **Limitations** (state these in the UI as muted help text):
  - Groups (wire types 3 and 4) aren't supported.
  - The schema must be self-contained (`import` statements aren't resolved).
  - Packed repeated fields show up as `len` in raw mode.
  - Encoding goes through protobufjs `fromObject`, which coerces mismatched types (for
    example, `"x"` into an int32 becomes `0`) and ignores unknown keys.

### Acceptance criteria (protobuf.dev encoding examples)
- `08 96 01` → field 1, varint 150.
- `12 07 74 65 73 74 69 6e 67` → field 2, len, text `testing`, no nested message.
- `1a 03 08 96 01` → field 3, len, nested message whose field 1 is varint 150.
- `CJYB` in auto mode (base64) → the same as `08 96 01`.
- `08 96` → error that mentions "Truncated".
- Schema decode of `08 96 01 12 07 74657374696e67` with the sample schema below gives
  `{ a: 150, b: "testing", … }`.

Sample schema (use it for the "Sample schema" button and the tests):

```proto
syntax = "proto3";
package demo.v1;

message Test {
  int32 a = 1;
  string b = 2;
  Inner inner = 3;
  Color color = 4;
  int64 big = 5;
  bytes raw = 6;

  message Inner {
    int32 a = 1;
  }
}

enum Color {
  COLOR_UNSPECIFIED = 0;
  COLOR_RED = 1;
}
```

### Reference util

```ts
import protobuf from 'protobufjs'
import { base64ToBytes } from './base64url'
import { hexToBytes, looksLikeHex } from './bytes'

export type BytesFormat = 'auto' | 'hex' | 'base64'
export type WireType = 0 | 1 | 2 | 5

export type RawValue =
  | { kind: 'varint'; unsigned: string; signed: string; zigzag: string }
  | { kind: 'i64'; unsigned: string; signed: string; double: number }
  | { kind: 'i32'; unsigned: number; signed: number; float: number }
  | { kind: 'len'; length: number; bytes: Uint8Array; text: string | null; message: RawField[] | null }

export interface RawField {
  fieldNumber: number
  wireType: WireType
  offset: number
  value: RawValue
}

export class ProtoDecodeError extends Error {
  override name = 'ProtoDecodeError'
  readonly offset: number

  constructor(message: string, offset: number) {
    super(`${message} (byte ${offset})`)
    this.offset = offset
  }
}

export type ProtoResult<T> = { ok: true; value: T } | { ok: false; error: string }

const MAX_DEPTH = 16
const MAX_FIELD_NUMBER = 536_870_911
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

export function parseBytesInput(input: string, format: BytesFormat): Uint8Array {
  if (format === 'hex' || (format === 'auto' && looksLikeHex(input))) return hexToBytes(input)
  return base64ToBytes(input)
}

function tryText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return CONTROL_CHARS.test(text) ? null : text
  } catch {
    return null
  }
}

export function decodeRaw(bytes: Uint8Array, depth: number = 0): RawField[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fields: RawField[] = []
  let pos = 0

  const need = (n: number): void => {
    if (pos + n > bytes.length) throw new ProtoDecodeError(`Truncated: need ${n} more byte(s)`, pos)
  }
  // BigInt keeps 64-bit varints exact; Number would silently round above 2^53.
  const readVarint = (): bigint => {
    let result = 0n
    for (let i = 0; i < 10; i++) {
      need(1)
      const b = bytes[pos++]!
      result |= BigInt(b & 0x7f) << BigInt(7 * i)
      if ((b & 0x80) === 0) return BigInt.asUintN(64, result)
    }
    throw new ProtoDecodeError('Varint longer than 10 bytes', pos)
  }

  while (pos < bytes.length) {
    const offset = pos
    const tag = readVarint()
    const fieldNumber = Number(tag >> 3n)
    const wireType = Number(tag & 7n)
    if (fieldNumber < 1 || fieldNumber > MAX_FIELD_NUMBER) {
      throw new ProtoDecodeError(`Invalid field number ${fieldNumber}`, offset)
    }
    let value: RawValue
    switch (wireType) {
      case 0: {
        const u = readVarint()
        value = {
          kind: 'varint',
          unsigned: u.toString(),
          signed: BigInt.asIntN(64, u).toString(),
          zigzag: ((u >> 1n) ^ -(u & 1n)).toString(),
        }
        break
      }
      case 1:
        need(8)
        value = {
          kind: 'i64',
          unsigned: view.getBigUint64(pos, true).toString(),
          signed: view.getBigInt64(pos, true).toString(),
          double: view.getFloat64(pos, true),
        }
        pos += 8
        break
      case 2: {
        const length = Number(readVarint())
        need(length)
        const sub = bytes.subarray(pos, pos + length)
        pos += length
        let message: RawField[] | null = null
        if (length > 0 && depth < MAX_DEPTH) {
          try {
            message = decodeRaw(sub, depth + 1)
          } catch {
            message = null
          }
        }
        value = { kind: 'len', length, bytes: sub, text: tryText(sub), message }
        break
      }
      case 5:
        need(4)
        value = {
          kind: 'i32',
          unsigned: view.getUint32(pos, true),
          signed: view.getInt32(pos, true),
          float: view.getFloat32(pos, true),
        }
        pos += 4
        break
      case 3:
      case 4:
        throw new ProtoDecodeError('Group wire types (3/4) are not supported', offset)
      default:
        throw new ProtoDecodeError(`Invalid wire type ${wireType}`, offset)
    }
    fields.push({ fieldNumber, wireType: wireType as WireType, offset, value })
  }
  return fields
}

function loadType(source: string, typeName: string): protobuf.Type {
  return protobuf.parse(source, { keepCase: true }).root.lookupType(typeName)
}

function toError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function listMessageTypes(source: string): ProtoResult<string[]> {
  try {
    const { root } = protobuf.parse(source, { keepCase: true })
    root.resolveAll()
    const names: string[] = []
    const walk = (ns: protobuf.NamespaceBase): void => {
      for (const nested of ns.nestedArray) {
        if (nested instanceof protobuf.Type) names.push(nested.fullName.replace(/^\./, ''))
        if (nested instanceof protobuf.Type || nested instanceof protobuf.Namespace) walk(nested)
      }
    }
    walk(root)
    return { ok: true, value: names }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export function decodeWithSchema(source: string, typeName: string, bytes: Uint8Array): ProtoResult<Record<string, unknown>> {
  try {
    const type = loadType(source, typeName)
    const value = type.toObject(type.decode(bytes), { longs: String, enums: String, bytes: String, defaults: true })
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export function encodeWithSchema(source: string, typeName: string, json: string): ProtoResult<Uint8Array> {
  try {
    const type = loadType(source, typeName)
    const message = type.fromObject(JSON.parse(json) as Record<string, unknown>)
    const invalid = type.verify(message)
    if (invalid) return { ok: false, error: invalid }
    return { ok: true, value: type.encode(message).finish() }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
```

Notes:
- `protobufjs` is CommonJS, so the default import is required. Named imports come back
  `undefined` under Node ESM.
- `type.encode().finish()` returns a Node `Buffer` in tests and a `Uint8Array` in the browser.
  Compare results with `bytesToHex(...)`, not `toEqual(new Uint8Array(...))`.
- Strings decoded in raw mode are shown as text content only. Never render them with `v-html`.

**Test IDs:** `pb-tab-raw`, `pb-tab-schema-decode`, `pb-tab-schema-encode`, `pb-bytes-format`,
`pb-bytes-input`, `pb-raw-output`, `pb-schema-input`, `pb-type-select`, `pb-json-input`,
`pb-json-output`, `pb-encoded-hex`, `pb-encoded-base64`, `pb-error`.
