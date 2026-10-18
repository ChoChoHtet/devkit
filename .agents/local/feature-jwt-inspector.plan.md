# JWT Inspector — implementation plan

Branch: `feature/jwt-inspector`

## Scope (from tool registry description)
Decode JWT header and claims, check expiry, verify signatures. Client-only, no new dependencies — signature verification uses the native Web Crypto `SubtleCrypto` API.

## Files
1. `app/utils/jwt/decode.ts` — pure decode: split `header.payload.signature`, base64url-decode + JSON.parse header/payload, `Result<JwtDecoded>`. Helper to classify `exp`/`nbf`/`iat` against `now` (injectable for tests).
2. `app/utils/jwt/verify.ts` — async `verifyJwtSignature(decoded, keyMaterial)` via `crypto.subtle`. Algorithm comes from `header.alg` (no manual algorithm picker). Supports HS256/384/512 (UTF-8 secret), RS256/384/512 + PS256/384/512 (SPKI PEM public key), ES256/384/512 (SPKI PEM public key). `alg: "none"` is valid only when the signature segment is empty, flagged as insecure. Unknown `alg` → `Result` failure.
3. `app/utils/jwt/sample.ts` — sample HS256 JWT + matching secret (mirrors `json/sample.ts`).
4. `app/components/jwt/JwtClaimsTable.vue` — renders header + payload as a table; `exp`/`iat`/`nbf` get human-readable timestamps and status badges.
5. `app/pages/tools/jwt-inspector.vue` — replaces the placeholder. Left: token input (CodeEditor, plain, wrap) + live decode (debounced, large-input pause, same pattern as json-formatter/string-inspector). Right: Claims tab (table + raw JSON) and Verify tab (secret/public-key textarea + Verify button + result badge).
   - UI-fix carryover: any action/selector button's highlighted state is driven by actual current state (e.g. active tab, verify result), never hardcoded to one button — this is the exact bug just fixed on JSON Formatter.
6. Tests: `test/unit/jwt/decode.test.ts`, `test/unit/jwt/verify.test.ts`, `test/nuxt/jwt-inspector.test.ts`.

## Out of scope (MVP)
- Editing claims and re-signing.
- JWK / JWKS fetch-by-URL key resolution (only pasted PEM/secret).
