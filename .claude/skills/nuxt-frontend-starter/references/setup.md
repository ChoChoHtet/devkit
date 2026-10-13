# Setup reference

Copy these files as written, then adapt the names. Versions are as of 2026-10-13. Check
them again before you install (see SKILL.md §1).

## 1. Scaffold

```bash
node -v   # must satisfy ^22.22.3 || ^24.15.0 || >=26

npm create nuxt@latest devkit-web -- --template minimal --packageManager npm --no-gitInit --no-modules
cd devkit-web
```

If the command runs without a TTY, it exits with code 2 unless you pass the dir, `--template`,
`--packageManager`, and `--gitInit`/`--no-gitInit`. Add `--no-install` if you want to install
everything in one step afterwards.

The minimal template gives you `app/app.vue`, `nuxt.config.ts`, `tsconfig.json` (project
references into `.nuxt/`), and `public/`. Keep its `tsconfig.json` as it is.

## 2. Dependencies (install only after the user approves)

```bash
npm install @nuxtjs/color-mode@^4.0.1 @lucide/vue@^1.55.0 jose@^6.2.12 protobufjs@^8.8.1 \
  tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3

npm install -D vitest@^5.0.4 @nuxt/test-utils@^4.3.3 @vue/test-utils@^2.5.1 happy-dom@^21.0.1 \
  typescript@~6.0.3 vue-tsc@^3.3.13
```

Don't install `lucide-vue-next` (deprecated), `@nuxtjs/tailwindcss` (Tailwind v3
integration), or `playwright-core`/`@vitest/coverage-v8` (not part of this starter; add them
only if the user asks).

## 3. `package.json`

Merge these fields into the generated file. Keep whatever the template already has
(`nuxt`, `vue`, `vue-router`).

```json
{
  "name": "devkit-web",
  "private": true,
  "type": "module",
  "engines": { "node": "^22.22.3 || ^24.15.0 || >=26" },
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --project unit",
    "test:nuxt": "vitest run --project nuxt"
  }
}
```

`"type": "module"` is required because `vitest.config.ts` imports `@nuxt/test-utils/config`.

## 4. Config files

### `nuxt.config.ts`

```ts
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'devkit-color-mode',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'Local-only developer tools' }],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
```

- In Nuxt 4, `~` resolves to `app/`, so `~/assets/css/main.css` is `app/assets/css/main.css`.
- `classSuffix: ''` is already the v4 default. It's set explicitly so readers know the class is
  `.dark` and not `.dark-mode`.
- TypeScript strict mode is Nuxt's default. Don't enable `typescript.typeCheck`, which runs
  vue-tsc on every build. Use `npm run typecheck` instead.

### `app/assets/css/main.css`

```css
@import "tailwindcss";

/* Must follow the import; without it Tailwind v4 keys dark: off prefers-color-scheme, not the .dark class color-mode sets. */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;
  --background: oklch(0.985 0 0);
  --surface: oklch(1 0 0);
  --foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.552 0.016 285.938);
  --border: oklch(0.92 0.004 286.32);
  --accent: oklch(0.546 0.245 262.881);
  --accent-foreground: oklch(0.985 0 0);
  --danger: oklch(0.577 0.245 27.325);
  --success: oklch(0.527 0.154 150.069);
}

.dark {
  color-scheme: dark;
  --background: oklch(0.141 0.005 285.823);
  --surface: oklch(0.21 0.006 285.885);
  --foreground: oklch(0.985 0 0);
  --muted: oklch(0.705 0.015 286.067);
  --border: oklch(0.274 0.006 286.033);
  --accent: oklch(0.707 0.165 254.624);
  --accent-foreground: oklch(0.141 0.005 285.823);
  --danger: oklch(0.704 0.191 22.216);
  --success: oklch(0.792 0.209 151.711);
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-danger: var(--danger);
  --color-success: var(--success);
}

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
  }
  textarea,
  pre,
  code {
    @apply font-mono text-sm;
  }
}
```

`@theme inline` makes each utility, such as `bg-surface`, point at the variable, which
`.dark` then overrides at runtime.

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          // Vitest 5 caches modules on disk by default, but on a warm run the cached virtual
          // nuxt-vitest-app-entry resolves its relative imports from the wrong directory.
          fsModuleCache: false,
          environmentOptions: {
            nuxt: { domEnvironment: 'happy-dom' },
          },
        },
      }),
    ],
  },
})
```

`fsModuleCache: false` is required. It was verified on 2026-10-13 with Vitest 5.0.4,
@nuxt/test-utils 4.3.3, and Nuxt 4.6.1. Without it, the first run passes and every later run
fails with `Failed to resolve import "./diagnostics/core.js" from
"../../../../../node_modules/nuxt/dist/app/nuxt-vitest-app-entry.js"`. If you already hit
that error, run `npx vitest --clearCache`. The `unit` project keeps the cache.

Official Nuxt 4 guidance: use `defineVitestProject` only for the Nuxt-environment project.
Putting `environment: 'nuxt'` globally through `defineVitestConfig` creates a hybrid
environment that's hard to debug.

## 5. Shell files

### `app/app.vue`

```vue
<script setup lang="ts">
useHead({
  titleTemplate: (title?: string): string => (title ? `${title} · DevKit` : 'DevKit'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

### `app/layouts/default.vue`

```vue
<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>
  </div>
</template>
```

### `app/utils/tools.ts`

```ts
import type { Component } from 'vue'
import { Binary, Braces, FileCode, KeyRound } from '@lucide/vue'

export type ToolSlug = 'json-formatter' | 'jwt-inspector' | 'base64url' | 'protobuf'

export interface ToolDefinition {
  slug: ToolSlug
  title: string
  description: string
  to: string
  icon: Component
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Validate, pretty-print, minify and sort JSON.',
    to: '/tools/json-formatter',
    icon: Braces,
  },
  {
    slug: 'jwt-inspector',
    title: 'JWT Inspector',
    description: 'Decode JWT header and claims, check expiry, verify signatures.',
    to: '/tools/jwt-inspector',
    icon: KeyRound,
  },
  {
    slug: 'base64url',
    title: 'Base64 URL',
    description: 'Encode and decode Base64URL / Base64 text.',
    to: '/tools/base64url',
    icon: Binary,
  },
  {
    slug: 'protobuf',
    title: 'Protobuf',
    description: 'Decode protobuf bytes raw or with a .proto schema; encode JSON.',
    to: '/tools/protobuf',
    icon: FileCode,
  },
]

export function getTool(slug: ToolSlug): ToolDefinition {
  const tool: ToolDefinition | undefined = TOOLS.find((t: ToolDefinition): boolean => t.slug === slug)
  if (!tool) throw new Error(`Unknown tool: ${slug}`)
  return tool
}
```

Tool pages read their title, description, and icon through `getTool('<slug>')`, so the
registry stays the single source. Phase 2 stub page:

```vue
<script setup lang="ts">
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'

const tool: ToolDefinition = getTool('json-formatter')

useHead({ title: tool.title })
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon">
    <div data-testid="tool-placeholder" class="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
      Not implemented yet.
    </div>
  </ToolPage>
</template>
```

The unit test `test/unit/tools.test.ts` covers unique slugs, `to === /tools/<slug>`, and `getTool` throwing on an unknown slug.

`TOOLS` is the single source for the header nav, the index cards, and the tests. When you add
a tool, add one entry here and create one page.

### `app/components/AppHeader.vue`

Requirements:
- A `<header>` with `border-b border-border bg-surface`, sticky on top (`sticky top-0 z-10`).
- On the left, a brand `NuxtLink to="/"` with the `Wrench` icon and the text "DevKit".
- In the middle, a `<nav aria-label="Tools">` that renders a `NuxtLink` for each item in `TOOLS`
  with its icon and title. The active link uses `active-class="bg-accent text-accent-foreground"`.
  The nav scrolls horizontally (`overflow-x-auto`) on narrow screens.
- On the right, `<ThemeToggle />`.

### `app/components/ThemeToggle.vue`

```vue
<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'

const colorMode = useColorMode()
const isDark = computed<boolean>(() => colorMode.value === 'dark')

function toggle(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <button
    type="button"
    data-testid="theme-toggle"
    aria-label="Toggle dark mode"
    :aria-pressed="isDark"
    class="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    @click="toggle"
  >
    <Sun v-if="isDark" class="size-5" aria-hidden="true" />
    <Moon v-else class="size-5" aria-hidden="true" />
  </button>
</template>
```

The first visit follows the OS (`preference: 'system'`). After the first click, the explicit
choice is stored in localStorage under `devkit-color-mode`. The toggle is deliberately
two-state. If the user later wants three states (system/light/dark), cycle `preference`
through `['system', 'light', 'dark']` and add the `Monitor` icon.

### `app/components/ToolPage.vue`

Props: `defineProps<{ title: string; description: string; icon: Component }>()`. It renders an
`<h1>` with the icon, the description in `text-muted`, the one-line privacy note
("Runs entirely in your browser."), and then `<slot />`. Each page sets its own document
title with `useHead({ title: '<Tool title>' })`.

### `app/components/CopyButton.vue`

- Props: `defineProps<{ text: string; label?: string }>()`. The default label is "Copy".
- It's disabled when `text` is empty.
- On click it calls `navigator.clipboard.writeText(text)`. On success it swaps the `Copy`
  icon for `Check` for 1500 ms. On failure (insecure context, permission denied) it shows a
  `CircleAlert` icon and a `title` explaining the failure. It never throws.
- Clear the timeout in `onBeforeUnmount`.

### `app/pages/index.vue`

`useHead({ title: 'Tools' })`, then a responsive grid
(`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`) of cards, one per `TOOLS` item. Each card is a
`NuxtLink` with its icon, title, and description and `data-testid="tool-card-<slug>"`.
