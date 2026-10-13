<script setup lang="ts">
import type { Component } from 'vue'
import { Keyboard, ShieldCheck } from '@lucide/vue'

defineProps<{
  title: string
  description: string
  icon: Component
  color?: string
}>()

const help = ref<{ open: () => void } | null>(null)
</script>

<template>
  <section class="flex flex-1 flex-col gap-6">
    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 class="flex items-center gap-2 text-2xl font-semibold">
            <component :is="icon" class="size-6" :style="{ color: color ?? 'var(--accent)' }" aria-hidden="true" />
            {{ title }}
          </h1>
          <p class="text-muted">{{ description }}</p>
        </div>
        <p class="flex items-center gap-1.5 text-sm font-medium text-success">
          <ShieldCheck class="size-4" aria-hidden="true" />
          Runs entirely in your browser.
        </p>
      </div>
      <button
        type="button"
        data-testid="shortcut-help-open"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-control-border px-2.5 py-1.5 text-xs text-muted hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        @click="help?.open()"
      >
        <Keyboard class="size-4" aria-hidden="true" />
        <span class="sr-only sm:not-sr-only">Shortcuts</span>
      </button>
    </header>
    <slot />
    <ShortcutHelp ref="help" />
  </section>
</template>
