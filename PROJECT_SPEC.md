# DevKit: Project Specification

| | |
|---|---|
| **Status** | Draft v1, ready for review |
| **Date** | 2026-10-13 |
| **Owner** | TBD |
| **Codebase** | `devkit/` (Nuxt 4 + TypeScript + Vue 3 + Tailwind v4 + Vitest) |

---

## 1. Summary

DevKit is a free, public website with four everyday developer tools:

1. **JSON Formatter**: format, validate, browse, query, and compare JSON.
2. **JWT Inspector**: decode, verify, and create JSON Web Tokens, like jwt.io.
3. **Base64 URL**: convert text to and from Base64URL / Base64.
4. **Protobuf**: decode protobuf bytes with or without a schema, and encode JSON into protobuf.

**The core promise: nothing you paste ever leaves your browser.** There's no backend, no
analytics, and no storage of your input. That matters because people paste tokens,
secrets, and production payloads into tools like these.

---

## 2. Decisions log

These decisions came out of the requirements Q&A on 2026-10-13. Everything else in this
document follows from them.

| Topic | Decision |
|---|---|
| Audience | **Public internet.** Anyone can use it. |
| Rendering | **Pages are prerendered at build time** and all tool logic runs in the browser. This replaces the original "SSR disabled" setting so search engines and link previews see real content. There's still no server at runtime. |
| Input storage | **Never stored.** Only preferences (theme, indent, last-used options) are saved, in localStorage. |
| Analytics | **None.** |
| Max input size | **About 5 MB**, processed in the browser on the main thread. |
| Shared features | **File drag-and-drop/upload, download output as a file, and keyboard shortcuts** in every tool. |
| Editor | **CodeMirror 6** for every JSON or code pane (JSON tool, JWT header/payload, Protobuf schema and JSON). |
| JSON scope | Format, minify, and sort keys, plus a **tree view, escape/unescape, JSON diff, and JSONPath query**. |
| JSON parsing | Strict JSON, with a **warning** when big numbers (above 2^53) would lose precision. |
| JSON trigger | **Explicit buttons** plus Ctrl/Cmd+Enter. Validity is shown live. |
| JSON diff | **Structural**: key order is ignored and changes are reported by path. |
| JWT scope | **Parity with jwt.io**: a Decoder (decode, claims breakdown, verify with a secret or a public key) and an Encoder (sign with a secret or a private key, generate examples). |
| Base64 scope | **UTF-8 text only**, with a manual Encode/Decode toggle (no auto-detect). |
| Protobuf modes | **Raw decode, schema decode, and schema encode.** |
| Protobuf schema | **One pasted `.proto` file**, plus Google's built-in well-known types. |
| Protobuf framing | **Plain message, gRPC frame, and length-delimited stream.** |
| Protobuf use | General purpose: API/gRPC debugging, queue messages, and building test payloads. |

---

## 3. Product-wide requirements

### 3.1 Goals
- Do the four everyday jobs faster and more safely than the popular online tools do.
- Make privacy verifiable. A strict Content Security Policy blocks every outgoing request,
  so "nothing leaves your browser" is enforced, not just promised.
- Work well on a laptop, be usable on a phone, and look right in both light and dark mode.

### 3.2 Non-goals (v1)
- User accounts, saved history, sharing links, or any backend.
- Browser extensions, a desktop app, or a CLI.
- Tools beyond the four listed (for example URL encoding, hashing, or UUIDs). They can come later.

### 3.3 Non-functional requirements

| Area | Requirement |
|---|---|
| **Privacy** | No network requests after the page loads, enforced by the CSP `connect-src 'self'`. No analytics, no cookies, and no input in localStorage or sessionStorage. Input is never logged to the console. |
| **Security** | Strict CSP: `default-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'none'`. Never render user content as HTML (no `v-html`). Never use `eval` (JSONPath runs in safe mode). Each tool shows a "Don't paste production secrets" hint where it's relevant. |
| **Performance** | A 5 MB input formats, decodes, or encodes in **under 1 second** on a typical laptop. Typing stays smooth (no frame drops) for inputs up to 1 MB. Above 1 MB, live validation pauses and the user presses the action button instead. |
| **Bundle size** | The home page loads **no** tool libraries. Each tool page loads only its own libraries (route-level code splitting). Target: no more than 300 KB of gzipped JS per tool page. |
| **Accessibility** | WCAG 2.2 AA. Every control works by keyboard. Every input has a label. Errors are announced (`role="alert"`). Contrast passes in both themes. The editor doesn't trap the Tab key. |
| **Browsers** | The last two versions of Chrome, Edge, Firefox, and Safari (desktop and mobile). |
| **Responsive** | Works at 375px wide. Panes stack on mobile and sit side by side on large screens. |
| **SEO** | Every route is prerendered with its own title, description, and Open Graph tags. The site has a `sitemap.xml`, `robots.txt`, and a friendly 404 page. |
| **Reliability** | Tools never crash on bad input. Every failure becomes a clear message, ideally with a location (line/column or byte offset). |
| **Quality** | Unit tests for all logic, component tests for every page, typecheck clean, and an E2E smoke test before launch. |

### 3.4 Shared features (every tool)

| Feature | Behaviour |
|---|---|
| **File drop / upload** | Drop a file on an input pane or use the "Open file" button. The size limit is 5 MB, and larger files get a clear error. Text tools read the file as UTF-8. Protobuf can read it as raw bytes. |
| **Download output** | A "Download" button saves the current output with a sensible name and type, for example `formatted.json`, `token.txt`, or `message.bin`. |
| **Copy** | Every output has a Copy button that shows a ✓ for 1.5 s. |
| **Clear / Sample** | Clear empties the tool. Sample loads a working example. |
| **Keyboard shortcuts** | Listed below. They're chosen to avoid browser-reserved combinations such as Ctrl+Shift+C (DevTools). Press `?` to show a help dialog. |
| **Preferences** | Per-tool options (indent, alphabet, and so on) are remembered in localStorage under a `devkit:` key prefix. Input itself is never stored. |
| **Privacy note** | Every tool page shows "Runs entirely in your browser." |

Keyboard shortcuts (Mod = Cmd on macOS, Ctrl elsewhere):

| Shortcut | Action |
|---|---|
| Mod + Enter | Run the tool's main action (Format, Encode, Decode, Verify, …) |
| Alt + Shift + C | Copy the main output |
| Alt + Shift + D | Download the main output |
| Alt + Shift + X | Clear the tool |
| Alt + Shift + O | Open a file |
| ? (when not typing) | Show the shortcut help |

### 3.5 Shared architecture

**Stack:** Nuxt 4.6, Vue 3.5 Composition API, and TypeScript in strict mode. Tailwind CSS 4.3
with semantic colour tokens, `@nuxtjs/color-mode` 4 for the theme, and `@lucide/vue` for
icons. Tests run on Vitest 5 with `@nuxt/test-utils` 4.

**Rendering (this is a change from the current code):**
- Switch from `ssr: false` to **SSR on, but only at build time**, and deploy the output of
  `nuxt generate`. Every route becomes a static HTML file with real content and meta tags.
- Anything that only works in the browser (CodeMirror, WebCrypto, file reading) is mounted
  inside `<ClientOnly>`, so prerendering never touches it.
- The theme toggle icon must avoid a hydration mismatch. Render it client-only, or show a
  neutral icon while `colorMode.unknown` is true.
- Hosting is any static host (open question §9). Security headers are set at the host or CDN.

**Layers:**

```
Page (app/pages/tools/<tool>.vue)        UI state only: inputs, options, which tab is open
  └─ Components (app/components/...)     Presentational: editors, trees, tables, badges
       └─ Utils (app/utils/<tool>/...)   Pure TypeScript logic, no Vue, fully unit-tested
            └─ Libraries                 jose, protobufjs, jsonpath-plus, microdiff, CodeMirror
```

Rules:
- **Utils never throw at the UI boundary.** They return `{ ok: true, … }` or
  `{ ok: false, error }`.
- **Pages never call libraries directly.** They always go through a util.
- **One shared editor component,** `<CodeEditor>`, wraps CodeMirror. It handles the
  language (json, proto, plain), read-only mode, light/dark theme switching, error markers
  (from a list of `{ line, column, message }`), and `v-model`.

**Shared components and composables (built once, in M1):**

| Name | Purpose |
|---|---|
| `CodeEditor.vue` | The CodeMirror 6 wrapper described above. |
| `FileDrop.vue` | Wraps a pane. Handles drag-over highlight, drop, the "Open file" button, size checks, and reading the file as text or bytes. |
| `DownloadButton.vue` | Saves text or bytes as a file through a Blob URL. |
| `CopyButton.vue` | Already exists. |
| `ToolPage.vue` | Already exists. Title, description, privacy note, and slot. |
| `StatusBadge.vue` | Success, danger, warning, or muted badge with an icon. |
| `ShortcutHelp.vue` | The `?` dialog. |
| `useShortcuts()` | Registers the tool's shortcut handlers and cleans them up on unmount. |
| `usePreference<T>(key, default)` | A typed localStorage preference that falls back safely if storage is blocked. |

**Shared data model:**

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError }

interface ToolError {
  message: string          // plain-language explanation
  line?: number            // for text inputs
  column?: number
  offset?: number          // byte offset for binary inputs
}

interface DownloadPayload {
  filename: string
  mimeType: string
  data: string | Uint8Array
}
```

**New dependencies that need approval** (versions as of 2026-10-13):

| Package | Version | Why |
|---|---|---|
| `codemirror` + `@codemirror/lang-json` + `@codemirror/lint` + `@codemirror/legacy-modes` | 6.0.2 / 6.0.2 / 6.9.7 / 6.5.5 | Editor, JSON highlighting, error markers, `.proto` highlighting |
| `jsonpath-plus` | 11.2.0 | JSONPath queries, run in its safe evaluator (no `eval`) |
| `microdiff` | 1.6.0 | Structural JSON diff, with zero dependencies |
| `jose` | 6.2.12 | JWT decode, verify, sign, and key generation (WebCrypto) |
| `protobufjs` | 8.8.1 | `.proto` parsing, schema decode and encode, well-known types |
| `@playwright/test` | latest at M9 | E2E smoke tests before launch |

---

## 4. Tool: JSON Formatter

### 4.1 Overview
Paste or drop JSON to check it's valid, pretty-print or minify it, sort its keys, browse it
as a tree, query it with JSONPath, escape it into a string, or compare two documents.

### 4.2 Goals
- Find what's wrong with invalid JSON in seconds (the exact line and column, shown in the editor).
- Make large, deeply nested responses easy to read and explore.
- Answer "what changed between these two payloads?" without caring about key order.

### 4.3 Scope
**In:** validate, format (2 spaces, 4 spaces, or tab), minify, sort keys (recursively), tree
view, JSONPath query, escape/unescape, structural diff, big-number warning, file drop,
download, copy.

**Out (v1):** JSON5 or comments input, JSON Schema validation, converting to YAML/CSV/XML,
editing values inside the tree, and lossless big-number formatting.

### 4.4 Functional requirements

| ID | Requirement |
|---|---|
| JSON-01 | Show a live validity status ("Valid JSON · 12,345 chars" or "Invalid JSON") while typing, with a 300 ms debounce. Pause it for inputs over 1 MB. |
| JSON-02 | When the input is invalid, show the error message with **line and column**, and underline the error in the editor. |
| JSON-03 | **Format** writes pretty-printed JSON to the output, using the chosen indent (2, 4, or tab). |
| JSON-04 | **Minify** writes compact JSON to the output. |
| JSON-05 | **Sort keys** (a checkbox) sorts object keys alphabetically at every level and leaves array order alone. It applies to Format and Minify. |
| JSON-06 | When integers above 2^53 are found, warn: "Some numbers are too large and may lose precision." Formatting still happens. |
| JSON-07 | The **Tree** tab shows a collapsible tree of the parsed value with type colours. Levels 1–2 start expanded. "Expand all" and "Collapse all" are available. Each node can copy its value and its path (`$.items[3].id`). |
| JSON-08 | The tree stays fast on large inputs. Children render only when a node is expanded, and more than 500 children show a "Show more" button. |
| JSON-09 | The **Query** tab takes a JSONPath expression (for example `$.items[?(@.price > 10)].name`) and shows the matches as a JSON array plus a match count. Invalid expressions show an error. Queries run in safe mode. |
| JSON-10 | **Escape** turns the JSON into a JSON string literal (quotes, backslashes, and newlines escaped). **Unescape** does the reverse and then validates the result. |
| JSON-11 | The **Diff** tab has two editors, Left and Right. Pressing Compare lists every difference as *path · type (added, removed, changed) · left value · right value*, and shows both sides formatted. Key order is ignored. Arrays are compared by index. |
| JSON-12 | Diff shows "No differences" when the two values are deeply equal. |
| JSON-13 | Shared features: drop or upload a `.json` file, download the output as `formatted.json`, `minified.json`, or `diff.json`, copy, Sample, Clear, and shortcuts. |
| JSON-14 | Indent and sort-keys preferences are remembered. |

### 4.5 Non-functional requirements
- Format or minify 5 MB in under 1 s. A diff of two 1 MB documents finishes in under 1 s.
- The editor stays responsive while typing in a 1 MB document.

### 4.6 Data model

```ts
type JsonIndent = 2 | 4 | 'tab'
interface JsonFormatOptions { indent: JsonIndent; sortKeys: boolean }

interface JsonParseInfo { valid: boolean; error?: ToolError; hasUnsafeIntegers: boolean; size: number }

interface JsonTreeNode {
  key: string | number | null      // null for the root
  path: string                      // JSONPath, e.g. $.items[3].id
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  value?: string | number | boolean | null   // leaves only
  childCount?: number               // containers only
}

interface JsonDiffEntry {
  path: string
  kind: 'added' | 'removed' | 'changed'
  left?: unknown
  right?: unknown
}

interface JsonQueryResult { matches: unknown[]; count: number }
```

### 4.7 UI overview

```
┌ JSON Formatter ─────────────────────────────────────────────────────┐
│ [Format] [Minify] [Escape] [Unescape]  Indent [2▾]  ☐ Sort keys      │
│ [Sample] [Clear] [Open file]                                         │
├──────────────────────────────┬──────────────────────────────────────┤
│ Input (CodeMirror)           │ Tabs: [Output] [Tree] [Query] [Diff]  │
│                              │                                      │
│ 1 {                          │ Output: formatted JSON (read-only)   │
│ 2   "a": 1,                  │ [Copy] [Download]                    │
│ 3 } ~~~~ error underline     │                                      │
├──────────────────────────────┴──────────────────────────────────────┤
│ ● Valid JSON · 1,204 chars       ⚠ Large numbers may lose precision  │
└─────────────────────────────────────────────────────────────────────┘
Diff tab: [Left editor] [Right editor] [Compare] → table of changes
```

### 4.8 Workflow
1. The user pastes or drops JSON, and validity shows immediately.
2. If it's invalid, the user fixes it using the line and column marker.
3. The user presses Format (or Mod+Enter) and copies or downloads the result.
4. Optionally, they switch to Tree to explore, Query to filter, or Diff to compare it with another payload.

### 4.9 Architecture

| File | Role |
|---|---|
| `app/pages/tools/json-formatter.vue` | Page, tabs, and options state |
| `app/utils/json/format.ts` | `formatJson`, `minifyJson`, `sortKeysDeep`, `locateJsonError`, `hasUnsafeIntegers` |
| `app/utils/json/escape.ts` | `escapeJson`, `unescapeJson` |
| `app/utils/json/tree.ts` | `buildChildren(value, path)`, built lazily one level at a time |
| `app/utils/json/query.ts` | `queryJson(value, expr)` through `jsonpath-plus` in safe mode |
| `app/utils/json/diff.ts` | `diffJson(left, right)` through `microdiff`, mapped to `JsonDiffEntry` with JSONPath paths |
| `app/components/json/JsonTree.vue`, `JsonTreeNode.vue`, `JsonDiffTable.vue` | Presentation |

### 4.10 Milestones
- **J1 (core):** validate, format, minify, sort keys, error location, big-number warning, editor, copy/download/file drop.
- **J2 (explore):** tree view and JSONPath query.
- **J3 (transform & compare):** escape/unescape and structural diff.

---

## 5. Tool: JWT Inspector

### 5.1 Overview
A jwt.io-style tool in two tabs. The **Decoder** shows what's inside a token, checks it, and
verifies its signature. The **Encoder** builds and signs a new token. Everything runs in the
browser through WebCrypto (`jose`).

### 5.2 Goals
- Answer the common questions instantly. Is this token well-formed? What's in it? Is it
  expired? Was it signed with this key?
- Let developers create test tokens for any common algorithm without writing code.
- Be safer than jwt.io: no network, no tracking, and clear warnings about secrets.

### 5.3 Scope
**In:**
- **Decoder:** token input, decoded header and payload, claims breakdown, time-claim
  checks, and signature verification with a secret (UTF-8 or Base64URL) or a public key
  (PEM SPKI, X.509 certificate, or JWK).
- **Encoder:** header and payload editors, an algorithm picker, signing with a secret or a
  private key (PEM PKCS#8 or JWK), unsecured `none` tokens, and generating example keys
  and tokens.
- **Both:** copy, clear, file drop, download, and shortcuts.

**Out (v1):**
- Fetching JWKS from a URL (it would need a network call and break the CSP promise).
- Decrypting JWE. JWE header decoding is supported.
- Nested JWTs.
- ES256K, which WebCrypto doesn't support.

**Supported algorithms:** HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA (Ed25519), and `none` (Encoder only, with a warning).

### 5.4 Functional requirements: Decoder

| ID | Requirement |
|---|---|
| JWTD-01 | The token input accepts a raw token, `Bearer <token>`, or a token with whitespace or line breaks. It decodes live. |
| JWTD-02 | The input colours the three parts: header, payload, and signature, each in its own colour. |
| JWTD-03 | Status: **"Valid JWT"**, or **"Invalid JWT: <reason>"** (wrong number of parts, bad Base64URL, header or payload isn't JSON). |
| JWTD-04 | The decoded **Header** and **Payload** appear as read-only formatted JSON, each with Copy. |
| JWTD-05 | **Claims breakdown** (a tab beside each JSON view) is a table of every claim with its value and a plain-language description. It covers the registered claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) and common OIDC claims (`name`, `email`, `scope`, `azp`, `nonce`, `auth_time`, `sid`, …). Unknown claims show "Custom claim". |
| JWTD-06 | Time claims (`exp`, `nbf`, `iat`, `auth_time`) show local time, UTC, and relative time ("expires in 2 h", "issued 3 days ago"). |
| JWTD-07 | A time status badge shows Valid, Expired, Not yet valid, or No expiry. It refreshes every 30 s. |
| JWTD-08 | **Verify signature:** for HS\* the user enters a secret and chooses its encoding (**UTF-8** or **Base64URL**). For other algorithms the user pastes a **public key**, and its format (PEM SPKI, X.509 certificate, or JWK JSON) is detected automatically. |
| JWTD-09 | Verification runs automatically when the token or key changes. Results: **"Signature Verified"**, **"Invalid Signature"**, or "Enter a secret/key to verify". If the signature is valid but the token is expired or not yet valid, the badge says so. |
| JWTD-10 | Verification only uses the algorithm from the header, and the key type must match it (an RSA key can't verify an ES256 token). Mismatches get a clear error. |
| JWTD-11 | `alg: none` tokens decode and show the warning "Unsigned token: anyone could have created it." |
| JWTD-12 | JWE tokens (5 parts) show the header only, with the message "Encrypted token (JWE): payload cannot be decoded here." |
| JWTD-13 | **Generate example** fills the Decoder with an example token for the chosen algorithm, along with the matching secret or public key, so it shows "Signature Verified" straight away. |
| JWTD-14 | The weak-secret warning appears when an HS\* secret is shorter than the hash size (for example, under 32 bytes for HS256). |

### 5.5 Functional requirements: Encoder

| ID | Requirement |
|---|---|
| JWTE-01 | The algorithm picker lists all the supported algorithms. Changing it updates `alg` in the header. |
| JWTE-02 | The **Header** and **Payload** are editable JSON editors with live validation. Warn if the header's `alg` differs from the picker, as jwt.io does. |
| JWTE-03 | Payload helpers: "Set iat = now", "Set exp = now + [15 m / 1 h / 1 d]", and "Add jti (random)". |
| JWTE-04 | **Signing key:** HS\* takes a secret with an encoding choice (UTF-8 or Base64URL). Asymmetric algorithms take a **private key** as PEM (PKCS#8) or JWK, detected automatically. `none` needs no key and shows a warning. |
| JWTE-05 | **Generate key** creates a secret (HS\*) or a key pair (asymmetric) in the browser, then shows the private key and the public key as both PEM and JWK, each with Copy. |
| JWTE-06 | The **encoded token** updates live (debounced) whenever the header, payload, algorithm, or key changes. It's coloured by part and has Copy and Download (`token.txt`). |
| JWTE-07 | **"Open in Decoder"** moves the token, plus the matching secret or public key, to the Decoder tab so the user can verify it immediately. |
| JWTE-08 | Errors are specific: "Header is not valid JSON (line 3, col 5)", "Private key does not match RS256", "Secret is empty". |

### 5.6 Non-functional requirements
- Decode in under 50 ms. Verify or sign in under 300 ms. Generate an RSA key in under 3 s,
  with a spinner while it runs.
- Secrets and keys are never stored, not even in preferences. Fields are cleared when the user leaves the page.
- Show a permanent hint: "Never paste production secrets or private keys into any website, including this one."
- WebCrypto needs a secure context (HTTPS or localhost). If it isn't available, explain why
  and disable verifying and signing.

### 5.7 Data model

```ts
type JwtAlgorithm =
  | 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512'
  | 'PS256' | 'PS384' | 'PS512' | 'ES256' | 'ES384' | 'ES512' | 'EdDSA' | 'none'

interface DecodedJwt {
  kind: 'JWS' | 'JWE'
  header: Record<string, unknown>
  payload: Record<string, unknown> | null     // null for JWE
  segments: string[]                          // raw parts, for colouring
}

interface ClaimRow {
  name: string
  value: unknown
  description: string                         // e.g. "Expiration time"
  time?: { local: string; utc: string; relative: string }
}

type TimeStatus = 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry'

type SecretEncoding = 'utf8' | 'base64url'
type KeyInput =
  | { kind: 'secret'; value: string; encoding: SecretEncoding }
  | { kind: 'publicKey'; text: string }       // PEM SPKI, X.509 PEM, or JWK JSON
  | { kind: 'privateKey'; text: string }      // PEM PKCS#8 or JWK JSON

interface VerifyOutcome {
  state: 'verified' | 'invalid' | 'no-key' | 'error'
  timeStatus?: TimeStatus
  message: string
}

interface GeneratedKeys {
  secret?: string
  privatePem?: string; privateJwk?: string
  publicPem?: string;  publicJwk?: string
}
```

### 5.8 UI overview

```
┌ JWT Inspector ──────────────── [Decoder] [Encoder] ───────────────┐
│ DECODER                                                           │
│ Encoded token                         [Generate example ▾][Clear] │
│ ┌──────────────────────────────┐   ● Valid JWT  ● Signature Verified │
│ │ eyJhbGc… . eyJzdWI… . Sfl…   │   ● Expires in 2 h                │
│ └──────────────────────────────┘                                  │
│ Header  [JSON | Claims]          Payload  [JSON | Claims]         │
│ { "alg": "HS256", … } [Copy]     { "sub": "123", … }      [Copy]  │
│                                                                   │
│ Verify signature                                                  │
│ Secret [••••••••••••] Encoding (●UTF-8 ○Base64URL)                 │
│   — or for RS/ES/PS/EdDSA —  Public key (PEM / JWK) [textarea]    │
│ ⚠ Never paste production secrets into any website.                │
└───────────────────────────────────────────────────────────────────┘
ENCODER: Algorithm [HS256▾] · Header editor · Payload editor + helpers
         · Secret / Private key [Generate key] → Encoded token [Copy][Open in Decoder]
```

### 5.9 Workflow
- **Decode:**
  1. The user pastes a token. The header, payload, claims, and status appear immediately.
  2. The user adds a secret or public key, and the signature is checked automatically.
- **Encode:**
  1. The user picks an algorithm and edits the payload (optionally using the helpers).
  2. They provide or generate a key, and the token appears.
  3. They copy it, or open it in the Decoder to confirm it verifies.

### 5.10 Architecture

| File | Role |
|---|---|
| `app/pages/tools/jwt-inspector.vue` | Tabs, shared state for "Open in Decoder" |
| `app/components/jwt/JwtDecoder.vue`, `JwtEncoder.vue`, `JwtTokenView.vue`, `ClaimsTable.vue`, `KeyInput.vue` | UI |
| `app/utils/jwt/decode.ts` | `normalizeToken`, `decodeToken`, `getTimeStatus`, `getTimeClaims` |
| `app/utils/jwt/claims.ts` | Claim descriptions and `buildClaimRows` |
| `app/utils/jwt/keys.ts` | `detectKeyFormat`, `importVerifyKey`, `importSignKey`, `generateKeys(alg)`, `secretBytes(value, encoding)` |
| `app/utils/jwt/verify.ts` | `verifyToken(token, key)` → `VerifyOutcome` |
| `app/utils/jwt/sign.ts` | `signToken(header, payload, alg, key)` (`jose` SignJWT, or UnsecuredJWT for `none`) |

### 5.11 Milestones
- **W1 (decoder core):** decode, colouring, status, header/payload, claims breakdown, time status, JWE and `none` handling.
- **W2 (verify):** secret (UTF-8/Base64URL), PEM, X.509, JWK, the mismatch errors, the weak-secret warning, and Generate example.
- **W3 (encoder):** algorithm picker, editors, helpers, signing, key generation, and Open in Decoder.

---

## 6. Tool: Base64 URL

### 6.1 Overview
Converts text to Base64URL (URL-safe) or standard Base64, and back. Text is always treated as UTF-8.

### 6.2 Goals
- Encode and decode correctly every time, including emoji and non-Latin text.
- Be forgiving when decoding (missing padding, line breaks, either alphabet) and strict about real errors.

### 6.3 Scope
**In:** a manual Encode/Decode toggle, the alphabet choice (Base64URL or Base64), a padding
option, a swap button, live conversion, a byte count, file drop (as text), download, and copy.

**Out (v1):** binary files, hex input or output, image preview, auto-detect, and MIME line wrapping.

### 6.4 Functional requirements

| ID | Requirement |
|---|---|
| B64-01 | **Mode toggle:** Encode (text → Base64) or Decode (Base64 → text). There's no auto-detection. |
| B64-02 | **Alphabet:** Base64URL (`-` `_`, the default) or standard Base64 (`+` `/`). |
| B64-03 | **Padding** checkbox for encoding. It's off by default for Base64URL and on for Base64, and changing the alphabet resets it to that default. |
| B64-04 | Conversion is live as the user types (debounced at 150 ms). Mod+Enter forces it. |
| B64-05 | Decoding accepts either alphabet, with or without padding, and ignores spaces and line breaks. |
| B64-06 | Invalid Base64 shows a specific error: "Invalid character '$' at position 3" or "Invalid length". |
| B64-07 | If the decoded bytes aren't valid UTF-8 text, show "Decoded data is not UTF-8 text (N bytes)" plus a hex preview of the first 64 bytes. There's no text output in that case. |
| B64-08 | Show the input and output sizes in characters and bytes. |
| B64-09 | **Swap** moves the output into the input and flips the mode. |
| B64-10 | Shared features: drop a text file as input, download the output as `encoded.txt` or `decoded.txt`, copy, Sample, Clear, and shortcuts. Mode, alphabet, and padding are remembered. |

### 6.5 Non-functional requirements
- 5 MB of text converts in under 500 ms, and large inputs don't crash (conversion runs in chunks).

### 6.6 Data model

```ts
type Base64Mode = 'encode' | 'decode'
type Base64Alphabet = 'base64url' | 'base64'
interface Base64Options { mode: Base64Mode; alphabet: Base64Alphabet; padding: boolean }

type Base64Output =
  | { ok: true; text: string; inputBytes: number; outputBytes: number }
  | { ok: false; error: ToolError; hexPreview?: string }   // hexPreview when bytes aren't UTF-8
```

### 6.7 UI overview

```
┌ Base64 URL ─────────────────────────────────────────────────────┐
│ (● Encode ○ Decode)  Alphabet [Base64URL▾]  ☐ Padding  [⇄ Swap] │
├───────────────────────────────┬─────────────────────────────────┤
│ Text (UTF-8)                  │ Base64URL            [Copy][⤓]  │
│ héllo 👋                      │ aMOpbGxvIPCfkYs                 │
│ 10 chars · 11 bytes           │ 15 chars                        │
└───────────────────────────────┴─────────────────────────────────┘
```

### 6.8 Workflow
1. Choose Encode or Decode.
2. Type, paste, or drop text, and the result appears live.
3. Copy or download it, or press Swap to reverse the operation.

### 6.9 Architecture

| File | Role |
|---|---|
| `app/pages/tools/base64url.vue` | Page and options |
| `app/utils/base64url.ts` | `bytesToBase64`, `base64ToBytes`, `encodeText`, `decodeToText` (shared with JWT and Protobuf) |
| `app/utils/bytes.ts` | `bytesToHex`, `hexToBytes`, `looksLikeHex` (shared) |

### 6.10 Milestones
- **B1:** the complete tool. It's the smallest tool, and it proves out the shared components (FileDrop, DownloadButton, shortcuts, preferences).

---

## 7. Tool: Protobuf

### 7.1 Overview
Inspects and builds Protocol Buffers messages. You can decode any bytes without a schema,
decode them into named JSON with a pasted `.proto`, or encode JSON into bytes. It
understands plain messages, gRPC frames, and length-delimited streams.

### 7.2 Goals
- Find out what's inside protobuf bytes from network captures, logs, or queues, even without the schema.
- With the schema, get clean, readable JSON.
- Build test payloads (JSON → bytes) in the right framing for gRPC or streams.

### 7.3 Scope
**In:**
- **Raw decode (no schema)**, and decoding and encoding **with one pasted `.proto` file**.
  Google's well-known types are imported automatically (`google/protobuf/timestamp.proto`,
  `duration`, `any`, `struct`, `wrappers`, `empty`, `field_mask`).
- **Byte input** as hex, Base64, or Base64URL, or a binary file.
- **Framings:** plain, gRPC (including gzip-compressed frames and gRPC-web trailer frames),
  and varint length-delimited streams.
- **Output:** JSON or bytes (hex, Base64, or a `.bin` download).

**Out (v1):**
- Multiple `.proto` files, imports other than the well-known types, and descriptor sets.
- Groups (wire types 3 and 4) in raw mode.
- gRPC compression other than gzip.
- Text-format protobuf.

### 7.4 Functional requirements

| ID | Requirement |
|---|---|
| PB-01 | **Three tabs:** Raw decode, Schema decode, and Schema encode. Byte input is shared across the decode tabs. |
| PB-02 | **Byte input format:** Auto (the default), Hex, or Base64/Base64URL. Auto treats input as hex when it contains only hex digits and has even length, and otherwise as Base64. Hex input may contain spaces, `0x`, `:`, or `,`. |
| PB-03 | **File input** loads a binary file as raw bytes, and shows its name and size. |
| PB-04 | **Framing:** Auto, Plain, gRPC, or Length-delimited. Auto picks **gRPC** when the bytes form complete gRPC frames (a flag byte of 0, 1, or 0x80/0x81, then a 4-byte big-endian length that fits exactly). Otherwise it picks **Plain**. A length-delimited stream must be selected explicitly. |
| PB-05 | **gRPC frames:** decode every frame. Compressed frames (flag 1) are decompressed with gzip in the browser. gRPC-web trailer frames (flag 0x80) are shown as header text. Each frame is listed separately. |
| PB-06 | **Length-delimited:** split the bytes into messages using each varint length prefix, and list each one separately. |
| PB-07 | **Raw decode** shows a tree per message. Each field row has the field number, wire type, byte offset, and value. |
| PB-08 | **Raw value views:** varint shows unsigned, signed (int64), zigzag (sint), and bool when it's 0 or 1. Fixed64 shows unsigned, signed, and double. Fixed32 shows unsigned, signed, and float. Length-delimited shows a nested message when the bytes parse as one, a string when they're printable UTF-8, and always the hex. |
| PB-09 | Decode errors give the reason and the **byte offset** ("Truncated varint at byte 12"). Any fields decoded before the error are still shown. |
| PB-10 | **Schema:** a `.proto` editor with syntax highlighting, a Sample button, and file drop. Parse errors show the line number. Well-known type imports resolve automatically. Other imports get the error "Only self-contained .proto files are supported (import X)". |
| PB-11 | The **message type picker** lists every message, including nested ones (for example `demo.v1.Test.Inner`), and the first one is selected by default. |
| PB-12 | **Schema decode** outputs JSON. Options: show default values (on), enums as names or numbers, 64-bit integers as strings (to avoid precision loss), and bytes as Base64 or hex. |
| PB-13 | **Schema encode:** the JSON input is validated against the chosen message type. Unknown fields and wrong types produce errors that name the field ("field 'a': integer expected"), instead of silently being coerced. |
| PB-14 | **Encode output** comes as hex and Base64, each with Copy, plus "Download .bin". An output framing option wraps the result as Plain, gRPC frame, or length-delimited. |
| PB-15 | **"Decode this"** sends the encoded bytes to the Schema decode tab for a round-trip check. |
| PB-16 | Shared features: Sample (schema plus matching bytes), Clear, shortcuts, and download of the decoded JSON as `message.json`. Format, framing, and decode options are remembered. |

### 7.5 Non-functional requirements
- Raw-decode a 5 MB payload in under 1 s. Nesting is capped at 16 levels so hostile input can't recurse forever.
- 64-bit values stay exact (BigInt in raw mode, strings in schema mode).
- Decoded strings are only ever shown as text, never as HTML.

### 7.6 Data model

```ts
type BytesFormat = 'auto' | 'hex' | 'base64'
type Framing = 'auto' | 'plain' | 'grpc' | 'delimited'

interface Frame {
  index: number
  offset: number
  kind: 'message' | 'grpc-trailer'
  compressed: boolean
  bytes: Uint8Array            // after decompression
}

type WireType = 0 | 1 | 2 | 5
type RawValue =
  | { kind: 'varint'; unsigned: string; signed: string; zigzag: string }
  | { kind: 'i64'; unsigned: string; signed: string; double: number }
  | { kind: 'i32'; unsigned: number; signed: number; float: number }
  | { kind: 'len'; length: number; bytes: Uint8Array; text: string | null; message: RawField[] | null }

interface RawField { fieldNumber: number; wireType: WireType; offset: number; value: RawValue }

interface SchemaInfo { messageTypes: string[]; errors: ToolError[] }

interface SchemaDecodeOptions {
  defaults: boolean
  enums: 'name' | 'number'
  longs: 'string' | 'number'
  bytes: 'base64' | 'hex'
}
```

### 7.7 UI overview

```
┌ Protobuf ─────────── [Raw decode] [Schema decode] [Schema encode] ┐
│ Bytes  Format [Auto▾]  Framing [Auto▾]  [Open file] [Sample]       │
│ ┌──────────────────────────────────────┐  Detected: gRPC, 1 frame │
│ │ 00 00 00 00 03 08 96 01              │                          │
│ └──────────────────────────────────────┘                          │
│ Frame 1 (3 bytes)                                                 │
│  └ #1 · varint · @0 → 150   (signed 150 · zigzag 75)              │
│                                                                   │
│ SCHEMA tabs: [.proto editor] Message [demo.v1.Test▾]              │
│   decode → JSON output [Copy][⤓]   encode → JSON in → hex/base64  │
└───────────────────────────────────────────────────────────────────┘
```

### 7.8 Workflow
- **Unknown bytes:**
  1. Paste hex or Base64, or open a file. The format and framing are auto-detected.
  2. Read the field tree, and use the nested and string views to work out the structure.
- **With a schema:**
  1. Paste the `.proto` and pick the message type.
  2. Paste the bytes and read the JSON.
- **Build a payload:**
  1. Paste the `.proto` and pick the type.
  2. Write the JSON and choose the output framing.
  3. Copy the hex or Base64, or download the `.bin`, and optionally press "Decode this" to check it.

### 7.9 Architecture

| File | Role |
|---|---|
| `app/pages/tools/protobuf.vue` | Tabs and shared byte input |
| `app/components/protobuf/BytesInput.vue`, `ProtoFieldTree.vue`, `FrameList.vue`, `SchemaPanel.vue` | UI |
| `app/utils/protobuf/bytes-input.ts` | `parseBytesInput(text, format)` |
| `app/utils/protobuf/framing.ts` | `detectFraming`, `splitGrpcFrames` (with gzip through `DecompressionStream`), `splitDelimited`, `wrapGrpc`, `wrapDelimited` |
| `app/utils/protobuf/wire.ts` | `decodeRaw(bytes)`: a hand-written wire reader using BigInt, depth-limited |
| `app/utils/protobuf/schema.ts` | `loadSchema` (protobufjs `parse` plus well-known types through `protobuf.common`), `listMessageTypes`, `decodeWithSchema`, `encodeWithSchema` (strict validation before encoding) |

### 7.10 Milestones
- **P1 (raw):** byte input (hex, Base64, file), raw wire decoding, the field tree, and error offsets.
- **P2 (framing):** gRPC frames (including gzip and trailers), length-delimited streams, and auto-detection.
- **P3 (schema):** `.proto` editor, well-known types, type picker, schema decode with options, and strict schema encode with output framing.

---

## 8. Implementation milestones (whole project)

Each milestone ends with green tests, a clean typecheck, and a manual browser check.

| # | Milestone | Summary | Done when |
|---|---|---|---|
| **M0** | Foundation | Nuxt 4 shell, layout, header, theme toggle, and stub pages. **Already done.** | Routes render, the theme persists, and 14 tests pass. |
| **M1** | Platform | Switch to build-time prerendering. Approve and add dependencies. Build `CodeEditor`, `FileDrop`, `DownloadButton`, `StatusBadge`, `ShortcutHelp`, `useShortcuts`, and `usePreference`. Add the CSP and SEO meta. | Every route is prerendered with its own meta tags, there are no hydration warnings, and the shared components are tested. |
| **M2** | Base64 URL (B1) | The complete Base64 tool, which proves the shared components work end to end. | All B64 requirements are met. |
| **M3** | JSON core (J1) | Validate, format, minify, sort, error markers, and the big-number warning. | JSON-01 to 06 and 13–14 are met. |
| **M4** | JSON advanced (J2 + J3) | Tree view, JSONPath, escape/unescape, and diff. | JSON-07 to 12 are met. The tree stays smooth on a 5 MB file. |
| **M5** | JWT Decoder (W1 + W2) | Decode, claims, time status, and verification with secret, PEM, X.509, and JWK. | JWTD-01 to 14 are met. |
| **M6** | JWT Encoder (W3) | Signing, key generation, helpers, and Open in Decoder. | JWTE-01 to 08 are met. A round trip verifies for every algorithm. |
| **M7** | Protobuf raw (P1 + P2) | Wire decoding and all the framings. | PB-01 to 09 are met. |
| **M8** | Protobuf schema (P3) | Schema decode and encode. | PB-10 to 16 are met. |
| **M9** | Launch hardening | Accessibility audit, performance check against the 5 MB targets, a Playwright smoke test per tool, security headers at the host, sitemap/robots/404, a privacy page, and deployment. | Lighthouse ≥ 95 for accessibility, SEO, and best practices on every route. The CSP blocks every outgoing request. |

Suggested order: M1 → M2 → M3 → M5 → M7 → M4 → M6 → M8 → M9. This order puts the core
decoding of every tool in front of users first and adds the advanced features afterwards.
The table order (M2 to M8) also works if you'd rather finish one tool completely before
starting the next.

---

## 9. Risks and open questions

| # | Item | Notes / proposed answer |
|---|---|---|
| R1 | **Hosting and domain aren't chosen.** | Any static host works (Cloudflare Pages, Netlify, S3 + CloudFront). It must support custom response headers for the CSP. |
| R2 | **CSP and inline scripts.** Nuxt and color-mode inject small inline scripts. | Allow them by hash in `script-src`, or accept `'unsafe-inline'` for scripts only. `connect-src 'self'` is the part that actually guarantees privacy. Decide in M1. |
| R3 | **Hydration mismatches after switching to prerendering.** | Keep browser-only parts inside `<ClientOnly>`. The theme icon waits for `colorMode.unknown` to clear. Check the console on every route. |
| R4 | **Bundle size from CodeMirror and jose.** | Code-split per route and lazy-load editor languages. Measure in M1 against the 300 KB gzipped budget. |
| R5 | **Public JWT encoder misuse.** | Low risk, because it can only sign with keys the user already has. Keep the "never paste production secrets" warning prominent. |
| R6 | **Ed25519 in older browsers.** | Supported in all current evergreen browsers. Otherwise show "EdDSA not supported in this browser". |
| R7 | **jwt.io parity details.** | jwt.io's current UI wasn't fully documented publicly. Do a side-by-side comparison during M5–M6 and log any gaps. |
| R8 | **The starter skill still says `ssr: false`.** | Update `.claude/skills/nuxt-frontend-starter` after M1 so future scaffolds match this spec. |
| Q1 | Branding: is "DevKit" the public name, and is there a logo? | Open. |
| Q2 | Is a privacy or legal page needed for a public launch? | Proposed: a short "How DevKit handles your data" page in M9. |

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Base64URL** | A Base64 variant that uses `-` and `_` instead of `+` and `/`, so it's safe in URLs. It usually has no `=` padding. JWTs use it. |
| **JWT / JWS / JWE** | A JSON Web Token. A JWS is a signed token with 3 parts. A JWE is an encrypted token with 5 parts. |
| **PEM / JWK** | Two formats for cryptographic keys. PEM is text with `-----BEGIN …-----` lines. A JWK is a JSON object. |
| **Wire type** | The protobuf tag that says how a field's bytes are laid out (varint, fixed 64-bit, length-delimited, fixed 32-bit). |
| **gRPC frame** | A 5-byte header (a compression flag plus a 4-byte length) in front of every protobuf message sent over gRPC. |
| **Prerendering** | Generating each page's HTML at build time, so the site can be served as static files with no server. |
| **CSP** | Content Security Policy: browser rules that block a page from loading or sending data anywhere it isn't allowed to. |
