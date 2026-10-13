<script setup lang="ts">
import { Wrench } from '@lucide/vue'
import { TOOLS } from '~/utils/tools'
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-border bg-surface">
    <div class="flex h-14 items-center gap-4 px-4 lg:px-6">
      <NuxtLink
        to="/"
        data-testid="brand-link"
        class="flex shrink-0 items-center gap-2 rounded-md font-semibold focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <Wrench class="size-5 text-accent" aria-hidden="true" />
        DevKit
      </NuxtLink>
      <nav aria-label="Tools" class="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tool in TOOLS"
          :key="tool.slug"
          :to="tool.to"
          :data-testid="`nav-${tool.slug}`"
          class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
        >
          <component :is="tool.icon" class="size-4" aria-hidden="true" />
          <span class="sr-only sm:not-sr-only">{{ tool.title }}</span>
        </NuxtLink>
      </nav>
      <ThemeToggle />
    </div>
  </header>
</template>
