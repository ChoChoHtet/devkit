---
name: nuxt-frontend-starter
description: Scaffold a client-only (SSR disabled) Nuxt 4 + TypeScript + Vue 3 Composition API frontend with Tailwind CSS v4, Lucide icons, light/dark mode toggle, Vitest tests, and four built-in developer tools (JSON formatter, JWT inspector, Base64URL encoder/decoder, Protobuf decoder/encoder). Use when the user asks to create, bootstrap, or scaffold a new Nuxt/Vue frontend starter, a "devkit" or developer-tools web app, or any of these tool pages from scratch. Do not use for adding features to an existing, unrelated Nuxt app (borrow individual sections from references/ instead).
---

# Nuxt Frontend Starter (DevKit)

A recipe for a small, client-only developer-tools app. This file is the plan. The
`references/` files hold the exact config, the per-tool specs, and the test plan. Read
all of them before you write any code.

| File | Read it for |
|---|---|
| [references/setup.md](references/setup.md) | Scaffold commands, `package.json`, `nuxt.config.ts`, Tailwind/theme CSS, Vitest config, layout, header, theme toggle, tool registry |
| [references/tools.md](references/tools.md) | The UX, util API, edge cases, and acceptance criteria for each tool |
| [references/testing.md](references/testing.md) | Test layout, the required test cases with known-good vectors, and sample test code |

Research baseline: **2026-10-13**. Versions were checked against the public npm registry
and the official Nuxt, Tailwind, Lucide, and color-mode docs on that date.

---

## 1. Stack decisions (and why)

| Concern | Choice | Version (2026-10-13) | Notes |
|---|---|---|---|
| Framework | **Nuxt 4** | `nuxt@^4.6.1` | Nuxt 3 reached **end of life on 2026-07-31**, so the user chose Nuxt 4. It uses the same Vue 3 / Composition API concepts, with source under `app/`. Nuxt 5 is expected around Q4 2026. If it has shipped when you run this skill, ask the user before switching. |
| Rendering | `ssr: false` (SPA) | – | Deploy with `nuxt generate`, which writes static files to `.output/public`. |
| Language | TypeScript, strict | `typescript@~6.0.3`, `vue-tsc@^3.3.13` | Use `<script setup lang="ts">` everywhere. TS 7.x (the native Go port) is `latest` on npm, but its JS API moved under `typescript/unstable/*`. Pin 6.0 so `nuxt typecheck` (vue-tsc) works. See Troubleshooting. |
| UI | Vue 3 Composition API | (bundled with Nuxt, `vue@^3.5`) | No Options API. Use `ref`/`computed`/`watch` with explicit generic types. |
| Styling | **Tailwind CSS v4** with the Vite plugin | `tailwindcss@^4.3.3`, `@tailwindcss/vite@^4.3.3` | Use the official Nuxt guide: Vite plugin plus `@import "tailwindcss"`. **Do not** use `@nuxtjs/tailwindcss` (that's the v3 path), and don't create `tailwind.config.js`. |
| Dark mode | `@nuxtjs/color-mode` | `^4.0.1` | Puts the `.dark` class on `<html>`. Tailwind v4 also needs `@custom-variant dark (&:where(.dark, .dark *));`. Set `colorMode.preference`, never `colorMode.value` (read-only in v4). |
| Icons | **`@lucide/vue`** | `^1.55.0` | `lucide-vue-next` is **deprecated** (renamed after Lucide v1). Use named imports such as `import { Sun } from '@lucide/vue'`. |
| JWT | `jose` | `^6.2.12` | ESM, zero dependencies, WebCrypto. Handles decoding and optional signature verification. |
| Protobuf | `protobufjs` (full build) | `^8.8.1` | Only for schema mode, because it parses `.proto` text at runtime and `@bufbuild/protobuf` can't. Schema-less decoding is a small hand-written wire reader (see tools.md). |
| Base64URL | Hand-written util over `atob`/`btoa` | – | `Uint8Array.fromBase64`/`toBase64` are Baseline 2025 in browsers but **missing in Node 22** (the test runtime). No library is needed. |
| Tests | Vitest + `@nuxt/test-utils` | `vitest@^5.0.4`, `@nuxt/test-utils@^4.3.3`, `@vue/test-utils@^2.5.1`, `happy-dom@^21.0.1` | `@nuxt/test-utils` 4.x requires Vitest 4 or 5. Use the Vitest `projects` setup: `unit` (node) and `nuxt` (`defineVitestProject`). |
| Runtime | Node | `^22.22.3 \|\| ^24.15.0 \|\| >=26` | Required by Nuxt 4.6.1's `engines`. Run `node -v` first. |

Before you install anything, re-check versions with `npm view <pkg> version` (or
`curl -s https://registry.npmjs.org/<pkg>` if npm auth fails). If a **major** version has
moved past this table, read that package's migration notes and tell the user before you
adopt it.

---

## 2. What gets built

```
<project>/
├── app/
│   ├── app.vue                     # <NuxtLayout><NuxtPage/></NuxtLayout> + titleTemplate
│   ├── assets/css/main.css         # Tailwind import, dark variant, semantic theme tokens
│   ├── layouts/default.vue         # Minimal shell: AppHeader + <main><slot/></main>
│   ├── components/
│   │   ├── AppHeader.vue           # Brand link, tool nav (from TOOLS), ThemeToggle
│   │   ├── ThemeToggle.vue         # Sun/Moon button flipping colorMode.preference
│   │   ├── ToolPage.vue            # Title/description/icon header + default slot
│   │   ├── CopyButton.vue          # Clipboard copy with Copy→Check feedback
│   │   └── ProtoFieldTree.vue      # Recursive renderer for raw protobuf fields
│   ├── pages/
│   │   ├── index.vue               # Card grid of all tools
│   │   └── tools/
│   │       ├── json-formatter.vue
│   │       ├── jwt-inspector.vue
│   │       ├── base64url.vue
│   │       └── protobuf.vue
│   └── utils/                      # Pure, framework-free, unit-tested logic
│       ├── tools.ts                # TOOLS registry (slug, title, description, to, icon)
│       ├── json.ts
│       ├── bytes.ts                # hex helpers shared by Base64URL and Protobuf
│       ├── base64url.ts
│       ├── jwt.ts
│       └── protobuf.ts
├── test/
│   ├── unit/                       # node env: utils only, relative imports
│   └── nuxt/                       # nuxt env: components, pages, layout
├── nuxt.config.ts
├── vitest.config.ts
├── tsconfig.json                   # As generated by Nuxt 4 (project references)
└── package.json                    # "type": "module", scripts in setup.md
```

**"Default empty layout"** means `layouts/default.vue` is a bare shell: a header with nav
and the theme toggle, then the page slot, with nothing else in it. Every page uses it
implicitly.

---

## 3. Workflow

Work through these phases in order. Do not move to the next phase until the current
phase's check passes.

### Phase 0: Confirm inputs (ask once, together)
- The target directory or project name. Default: `devkit-web` in the current directory. If
  the directory exists and isn't empty, stop and ask.
- The package manager. Default: npm, unless a lockfile or the user says otherwise.
- The Jira ticket key for the branch and commit, if the project lives in git.
- Show the dependency list from §1 and **get explicit approval before installing**. The
  user's global rules forbid adding dependencies unasked.

### Phase 1: Scaffold and configure (references/setup.md §1–§4)
1. Create the project non-interactively with `npm create nuxt@latest <dir> -- --template minimal --packageManager npm --no-gitInit --no-modules`.
2. Install the runtime and dev dependencies at the pinned ranges.
3. Write `nuxt.config.ts`, `app/assets/css/main.css`, `vitest.config.ts`, and the `package.json` scripts.
4. **Check:** `npm run dev` boots with no errors, `npx nuxt prepare` succeeds, `npm run typecheck` is clean, and `npx vitest run --passWithNoTests` lists both projects. Plain `npm test` exits 1 when there are no test files yet.
5. Install `jose` and `protobufjs` only when you reach the JWT and Protobuf tools in Phase 3. If the user has approved them up front, install them here.

### Phase 2: Shell (references/setup.md §5)
1. Write `app.vue`, `layouts/default.vue`, `AppHeader.vue`, `ThemeToggle.vue`, `ToolPage.vue`, `CopyButton.vue`, `utils/tools.ts`, and `pages/index.vue`.
2. Create the four tool pages as stubs that render `<ToolPage>` with the right title.
3. **Check:** every route renders, the toggle switches themes, and the theme survives a reload (localStorage). Write the layout, header, and theme toggle tests from testing.md now.

### Phase 3: Tools, one at a time (references/tools.md)
Work through **JSON → Base64URL → JWT → Protobuf**. JWT and Protobuf reuse the Base64URL util.
For each tool:
1. Write `app/utils/<tool>.ts` and its unit tests first, using the vectors in testing.md. Get them passing.
2. Build the page on top of the util. Pages hold only UI state and call into the utils.
3. Write the page's nuxt-env test.
4. **Check:** `npm run test` is green and `npm run typecheck` is clean.

### Phase 4: Verify (definition of done in §5)
Run the whole checklist. Report anything that fails, with its output. Don't claim success
on a failing step.

### Phase 5: Hand back
Summarize what you built, list the versions you installed, and note any deviations from
this skill. **Do not commit, push, or open a PR** unless the user asks. When they do, branch
first (include the Jira key) and never push to `main`.

---

## 4. Conventions (apply everywhere)

- **`<script setup lang="ts">` only.** Type everything explicitly: `ref<string>('')`,
  `computed<boolean>(() => …)`, function return types, `defineProps<{ … }>()`, and
  `defineEmits<{ … }>()`.
- **Keep logic in `app/utils/`, UI in pages and components.** Utils are pure TypeScript
  with no Vue or Nuxt imports, except `utils/tools.ts`, which imports icon components. They
  return discriminated unions such as `{ ok: true, … } | { ok: false, error }` instead of
  throwing at the UI boundary. Pages never call `JSON.parse`, `atob`, or `protobufjs`
  directly.
- **Import utils explicitly** in pages (`import { formatJson } from '~/utils/json'`), even
  though Nuxt auto-imports them. It makes grepping and test mocking clearer. Auto-imports
  for Vue and Nuxt APIs (`ref`, `computed`, `useHead`, `useColorMode`) are fine.
- **Use semantic colour tokens**, not raw palette colours: `bg-background`, `bg-surface`,
  `text-foreground`, `text-muted`, `border-border`, `bg-accent text-accent-foreground`,
  `text-danger`, `text-success`. They're defined once in `main.css` for light and dark, so
  components rarely need `dark:` variants.
- **Icons:** named imports from `@lucide/vue`, `class="size-4"` or `size-5`, and
  `aria-hidden="true"` on decorative icons. Icon-only buttons need an `aria-label`.
- **Add a `data-testid` to every interactive element and output region that tests touch**,
  in the form `<tool>-<role>`, for example `json-input`, `json-format`, `json-output`,
  `json-error`.
- **Privacy:** every tool runs locally. Never send input anywhere, never `console.log`
  tokens or payloads, and don't persist tool input to storage. Each tool page shows a
  one-line note: "Runs entirely in your browser."
- **Responsive:** layouts work at 375px width. Input/output panes stack on mobile and sit
  side by side from `lg:` up.
- **Accessibility:** use `<label for>` on every input, `role="alert"` on error regions, and
  visible focus rings (`focus-visible:ring-2 ring-accent`).
- **Comments:** only explain a non-obvious *why*. Don't narrate the code.
- **Formatter/linter:** if the user's repo already has ESLint or Prettier config, follow
  it. Otherwise don't add one unless asked. `@nuxt/eslint` is the standard choice if they
  want one.

---

## 5. Definition of done

- [ ] `node -v` satisfies the engines range in §1.
- [ ] `npm run dev` starts, and `/`, `/tools/json-formatter`, `/tools/jwt-inspector`, `/tools/base64url`, and `/tools/protobuf` all render inside the default layout.
- [ ] The theme toggle flips light and dark instantly, the choice persists across reloads, and the first visit follows the OS preference.
- [ ] No hydration warnings or console errors. `ssr: false` is set.
- [ ] `npm run test` passes both the `unit` and `nuxt` projects. Every case in testing.md exists.
- [ ] `npm run typecheck` reports zero errors.
- [ ] `npm run generate` produces `.output/public/index.html` (plus `200.html` and `404.html`).
- [ ] Every acceptance criterion in tools.md holds when you check it by hand in the browser.
- [ ] There are no `lucide-vue-next`, `@nuxtjs/tailwindcss`, or `tailwind.config.*` files or deps.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `dark:` classes ignored while the `.dark` class is on `<html>` | `@custom-variant dark (…)` is missing, or it sits *before* `@import "tailwindcss"`. |
| The theme never changes | Code is assigning `colorMode.value`. Assign `colorMode.preference` instead. |
| `Cannot read properties of undefined (reading 'config')` in tests | The nuxt project isn't wrapped in `defineVitestProject`, or a test file in `test/nuxt` is matched by the `unit` include. |
| Nuxt tests pass once, then every run fails with `Failed to resolve import "./diagnostics/core.js" … nuxt-vitest-app-entry.js` | Vitest 5's on-disk module cache is enabled. Set `fsModuleCache: false` on the nuxt project (setup.md §4) and run `npx vitest --clearCache`. |
| `aria-current` / active-link assertions fail in nuxt-env tests | It's a limitation of the test environment, not a bug. Don't assert it there (testing.md). |
| `ERR_REQUIRE_ESM` / config import errors in Vitest | `package.json` is missing `"type": "module"`. Add it, or rename the config to `vitest.config.mts`. |
| `mountSuspended` isn't found, or you get e2e import errors | A file imports both `@nuxt/test-utils/runtime` and `@nuxt/test-utils/e2e`, which isn't allowed. |
| The `~` alias fails in `test/unit` | That project is plain node with no Nuxt aliases. Use relative imports (`../../app/utils/json`). |
| `nuxt typecheck` crashes or can't find the TypeScript API | TS 7 is installed. Pin `typescript@~6.0.3`. If TS 6 reports deprecation errors from the generated `.nuxt/tsconfig.*.json`, fall back to `typescript@~5.9.3` and tell the user. |
| `protobufjs` named import is `undefined` | It's CJS. Use `import protobuf from 'protobufjs'`, then `protobuf.parse(…)`. |
| An icon import fails | Lucide v1 dropped some legacy aliases. Check the name at lucide.dev/icons (for example `CircleAlert`, not `AlertCircle`). |
| `npm` returns E401 | The user's `~/.npmrc` points at Coda's CodeArtifact registry, and the token expires. Don't edit `~/.npmrc`. Ask whether they want to re-login or use public npm. On this machine the user chose a **project-level `.npmrc`** containing `registry=https://registry.npmjs.org/`. Use the same flag for `npm create` (`npm --registry=… create nuxt@latest`). |
| You need a real-browser check but the Playwright MCP is down | Run headless Chrome (`/Applications/Google Chrome.app/…/Google Chrome --headless=new --dump-dom <url>`). For clicks, drive it over CDP with `--remote-debugging-port` and Node's global `WebSocket`. Keep the profile dir and script in the scratchpad. |
| Scaffolding into a non-empty dir (for example one with `.claude/`) | Don't use `--force`. Scaffold into the scratchpad and copy `app/ public/ .gitignore tsconfig.json nuxt.config.ts package.json` across. |
| `crypto.subtle` is undefined in the JWT verify step | The page isn't in a secure context. Use `localhost` or HTTPS. Plain-HTTP LAN IPs don't count. |
