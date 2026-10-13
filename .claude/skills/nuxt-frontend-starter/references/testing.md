# Testing reference

Use Vitest 5 + `@nuxt/test-utils` 4 with two Vitest **projects** (config in setup.md §4):

| Project | Folder | Environment | What goes here | Imports |
|---|---|---|---|---|
| `unit` | `test/unit/` | `node` | Pure utils in `app/utils/` | **Relative** (`../../app/utils/json`). The `~` alias doesn't exist here. |
| `nuxt` | `test/nuxt/` | `nuxt` (happy-dom) | Components, pages, layout, theme toggle | `~/…` aliases, `mountSuspended`, `mockNuxtImport` from `@nuxt/test-utils/runtime` |

Rules:
- Name files `<subject>.test.ts`. Use one `describe` per exported function or component and
  name each `it` after the behaviour it checks ("rejects odd-length hex"), not the method
  being called.
- Use the known-good vectors below. Don't invent expected values. If you do need a new
  vector, compute it with an independent tool first (for example Node `Buffer`, `crypto`,
  or `protoc --encode`).
- Select DOM elements with `data-testid` only. The IDs are listed per tool in tools.md.
- Every test that mounts `ThemeToggle`, directly or through `AppHeader`, the layout, or
  `app.vue`, **mocks `useColorMode`**. The color-mode client plugin expects an inline head
  script that the test environment doesn't inject.
- Don't test WebCrypto signature verification through the page, because happy-dom's
  `crypto.subtle` support isn't guaranteed. `verifyToken` is fully covered in `unit`.
- `@nuxt/test-utils/runtime` and `@nuxt/test-utils/e2e` must never be imported in the same file.
- E2E/browser tests (Playwright) are **out of scope** for the starter. Add them only if the user asks.

## Required test files and cases

### `test/unit/json.test.ts`
- `formatJson('{"b":1,"a":{"d":1,"c":2}}', { indent: 2, sortKeys: true })` → output is exactly
  `'{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}'`.
- With `indent: 'tab'`, the output uses `\t`. With `sortKeys: false`, key order is preserved.
- `minifyJson('{ "a" : [1, 2] }')` → `'{"a":[1,2]}'`.
- `formatJson('{\n  "a": 1,\n}', …)` → `ok: false` with `line: 3, column: 1`.
- `formatJson('   ', …)` → `ok: false` with message `'Input is empty'`.
- `locateJsonError` handles all three message styles:
  - V8: `'… at position 7 (line 1 column 8)'` → `{1, 8}`.
  - Firefox: `'JSON.parse: … at line 3 column 1 of the JSON data'` → `{3, 1}`.
  - No position: `'Unexpected token'` → `{null, null}`.
  - Also test `'Unexpected end of JSON input'` on input `'{"a":'`, which gives line 1, column 6.
- `sortKeysDeep` sorts keys inside arrays of objects but leaves array order alone.

### `test/unit/base64url.test.ts`
- RFC 4648 §10 vectors, base64url without padding:
  `''→''`, `f→Zg`, `fo→Zm8`, `foo→Zm9v`, `foob→Zm9vYg`, `fooba→Zm9vYmE`, `foobar→Zm9vYmFy`.
  Use `it.each`, and check both `encodeText` and `decodeToText`.
- `encodeText('foob', { alphabet: 'base64' })` → `'Zm9vYg=='` (padding defaults on for base64).
- `bytesToBase64(new Uint8Array([0xfb, 0xff]))` → `'-_8'`. With `{ alphabet: 'base64' }` → `'+/8='`.
- `base64ToBytes` accepts both `'+/8='` and `'-_8'` and returns `[0xfb, 0xff]`. It also accepts
  input with embedded whitespace and newlines.
- The Unicode round trip `'héllo 👋'` ↔ `'aMOpbGxvIPCfkYs'`.
- `base64ToBytes('abc$')` throws `Base64DecodeError` (invalid character).
  `base64ToBytes('abcde')` throws (invalid length).
- `decodeToText('_w')` → `ok: true`, `text: null` (byte `0xff` isn't valid UTF-8).
- 200 000 bytes round-trip without a `RangeError`, which guards the chunking.

### `test/unit/bytes.test.ts`
- `bytesToHex(hexToBytes('0x08 96:01'))` → `'08 96 01'`.
- `hexToBytes('abc')` throws (odd length). `hexToBytes('zz')` throws (invalid character).
- `looksLikeHex('deadbeef')` is true. `looksLikeHex('Zm9v')` is false. `looksLikeHex('')` is false.

### `test/unit/jwt.test.ts`
The sample token is `SAMPLE_JWT` from tools.md §3 (HS256, secret `your-256-bit-secret`).
- `decodeToken('Bearer ' + SAMPLE_JWT)` → `ok`, `kind: 'JWS'`, `header.alg === 'HS256'`,
  `payload.name === 'John Doe'`.
- `decodeToken('abc')` → error `'Expected 3 (JWS) or 5 (JWE) segments, got 1'`.
  `decodeToken('a.b.c')` → `ok: false`. `decodeToken('')` → `'Token is empty'`.
- A 5-segment token with header `eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ` → `kind: 'JWE'`,
  `payload: null`, `header.enc === 'A256GCM'`.
- `getTimeClaims` on the sample payload → `[{ claim: 'iat', seconds: 1516239022, iso: '2018-01-18T01:30:22.000Z' }]`.
- `getTimeStatus`: `({exp:100}, 100)` → `expired`, `({exp:101}, 100)` → `valid`,
  `({nbf:200, exp:300}, 100)` → `not-yet-valid`, `({}, 1)` → `no-expiry`.
- `verifyToken(SAMPLE_JWT, { kind: 'secret', secret: 'your-256-bit-secret' })` → `signatureValid: true`.
  With a wrong secret → `{ signatureValid: false, message: 'Invalid signature' }`.
- ES256 round trip: `generateKeyPair('ES256', { extractable: true })`, then sign with `SignJWT`
  (`setIssuedAt(1700000000)`, `setExpirationTime(1700000060)`).
  - Verify through `{ kind: 'pem', pem: await exportSPKI(publicKey) }` at
    `new Date(1700000010_000)` → valid.
  - Verify through `{ kind: 'jwk', jwk: JSON.stringify(await exportJWK(publicKey)) }` → valid.
  - Verify with the default `currentDate` (now) → `signatureValid: true` and a message containing `"exp"`.
- The unsigned token `eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.` decodes, and `verifyToken` returns
  `signatureValid: false` with a message about alg `none`.

### `test/unit/protobuf.test.ts`
- `decodeRaw(hexToBytes('08 96 01'))` → one field: `fieldNumber 1`, `wireType 0`, `unsigned '150'`.
- `'12 07 74 65 73 74 69 6e 67'` → `len`, `text 'testing'`, `message null`.
- `'1a 03 08 96 01'` → `len`, `message[0].value.unsigned === '150'`, `text null`.
- `'08 ff ff ff ff ff ff ff ff ff 01'` (int32 −1) → `signed '-1'`, `unsigned '18446744073709551615'`.
- ZigZag: `'08 01'` → `zigzag '-1'`. `'08 04'` → `zigzag '2'`.
- `'25 00 00 80 3f'` → field 4, `i32`, `float 1`. `'29 00 00 00 00 00 00 f0 3f'` → field 5, `i64`, `double 1`.
- Errors: `'08 96'` (truncated varint) and `'12 05 61'` (truncated len) throw `/Truncated/`.
  `'0b'` throws `/Group/`. `'00'` throws `/field number 0/`.
- `parseBytesInput('CJYB', 'auto')` and `parseBytesInput('089601', 'auto')` both → `[8, 150, 1]`.
- With the sample schema from tools.md:
  - `listMessageTypes` → `['demo.v1.Test', 'demo.v1.Test.Inner']`. `listMessageTypes('message {')` → `ok: false`.
  - `decodeWithSchema(schema, 'demo.v1.Test', hexToBytes('08 96 01 12 07 74 65 73 74 69 6e 67'))` →
    `a: 150`, `b: 'testing'`, `color: 'COLOR_UNSPECIFIED'`, `big: '0'`.
  - Encode the JSON
    `{"a":150,"b":"testing","inner":{"a":1},"color":"COLOR_RED","big":"9007199254740993","raw":"AQI="}`,
    then compare `bytesToHex` of the result to
    `'08 96 01 12 07 74 65 73 74 69 6e 67 1a 02 08 01 20 01 28 81 80 80 80 80 80 80 10 32 02 01 02'`.
    Decoding those bytes again gives `big: '9007199254740993'`, which proves int64 precision is kept.
  - `decodeWithSchema(schema, 'demo.v1.Nope', …)` → `ok: false`, error contains `no such type`.

### `test/nuxt/theme-toggle.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeToggle from '~/components/ThemeToggle.vue'

const { colorMode } = vi.hoisted(() => ({
  colorMode: { preference: 'system', value: 'light' } as { preference: string; value: string },
}))

mockNuxtImport('useColorMode', () => () => colorMode)

describe('ThemeToggle', () => {
  beforeEach(() => {
    colorMode.preference = 'system'
    colorMode.value = 'light'
  })

  it('switches to dark when the resolved mode is light', async () => {
    const wrapper = await mountSuspended(ThemeToggle)
    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')
    expect(colorMode.preference).toBe('dark')
  })

  it('reports pressed state and switches to light when dark', async () => {
    colorMode.value = 'dark'
    const wrapper = await mountSuspended(ThemeToggle)
    const button = wrapper.get('[data-testid="theme-toggle"]')
    expect(button.attributes('aria-pressed')).toBe('true')
    await button.trigger('click')
    expect(colorMode.preference).toBe('light')
  })
})
```

`mockNuxtImport` is hoisted and can only be used once per file per import. To vary the
behaviour between tests, mutate the `vi.hoisted` state, as shown above.

### `test/nuxt/layout.test.ts`
- Mock `useColorMode` as above.
- `mountSuspended(AppHeader)` renders one nav link per `TOOLS` entry, in the same order, with
  `href === tool.to`, plus the brand link to `/` and the theme toggle.
- `it.each(TOOLS)`: `mountSuspended(App, { route: tool.to })` renders an `<h1>` containing
  `tool.title`. That proves the route exists and the default layout wraps it, because the
  header is present.
- **Don't assert active-link state** (`aria-current="page"` or `router-link-active`) in this
  environment. `NuxtLink` never picks up the route that `mountSuspended` sets, even after
  `navigateTo` (checked with @nuxt/test-utils 4.3.3), although it works in a real browser.
  Check it by hand, or with a browser test if the user adds Playwright.
- `mountSuspended(App, { route: '/' })` renders a `tool-card-<slug>` for each tool.

### `test/nuxt/json-formatter.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import JsonFormatterPage from '~/pages/tools/json-formatter.vue'

describe('JSON formatter page', () => {
  it('formats input with sorted keys', async () => {
    const wrapper = await mountSuspended(JsonFormatterPage)
    await wrapper.get('[data-testid="json-input"]').setValue('{"b":1,"a":2}')
    await wrapper.get('[data-testid="json-sort"]').setValue(true)
    await wrapper.get('[data-testid="json-format"]').trigger('click')
    expect(wrapper.get('[data-testid="json-output"]').text()).toBe('{\n  "a": 2,\n  "b": 1\n}')
  })

  it('shows the error location for invalid JSON', async () => {
    const wrapper = await mountSuspended(JsonFormatterPage)
    await wrapper.get('[data-testid="json-input"]').setValue('{"a":1,}')
    await wrapper.get('[data-testid="json-format"]').trigger('click')
    expect(wrapper.get('[data-testid="json-error"]').text()).toContain('column 8')
  })
})
```

### `test/nuxt/base64url.test.ts`
- Encode mode: typing `foobar` into `b64-input` shows `Zm9vYmFy` in `b64-output`.
- Text `>>>?` encodes to `Pj4-Pw` by default. After switching the alphabet to `base64`, it
  encodes to `Pj4+Pw==`, the standard alphabet with padding.
- Decode mode: `aMOpbGxvIPCfkYs` → `héllo 👋`. `abc$` → `b64-error` is visible.
- Swap moves the output into the input and flips the mode.

### `test/nuxt/jwt-inspector.test.ts`
- Pasting `SAMPLE_JWT` shows `HS256` in `jwt-header`, `John Doe` in `jwt-payload`, `iat` in
  `jwt-claims`, and a `jwt-status` reading "No expiry".
- Pasting `abc` shows `jwt-error`, and the payload card isn't rendered.
- The key-kind select defaults to "Shared secret" for an HS256 token.

### `test/nuxt/protobuf.test.ts`
- In the raw tab, entering `08 96 01` renders field `#1` with value `150` in `pb-raw-output`.
- `1a 03 08 96 01` renders a nested field.
- `08 96` shows `pb-error` containing "Truncated".
- In the schema-decode tab, clicking "Sample schema" fills `pb-type-select` with `demo.v1.Test`,
  and bytes `08 96 01` show `"a": 150` in `pb-json-output`.
- In the encode tab, the sample schema with `{"a":150}` shows `08 96 01` in `pb-encoded-hex`.

## Verifying test vectors independently
Each vector above was checked on 2026-10-13 (Node 22, jose 6.2.12, protobufjs 8.8.1). Two
one-liners re-derive the trickiest ones:

```bash
node -e 'console.log(require("crypto").createHmac("sha256","your-256-bit-secret").update("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ").digest("base64url"))'
# → SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
node -e 'console.log(Buffer.from([0xfb,0xff]).toString("base64url"), Buffer.from("héllo 👋").toString("base64url"))'
# → -_8 aMOpbGxvIPCfkYs
```
