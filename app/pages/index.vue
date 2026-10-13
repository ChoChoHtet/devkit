<script setup lang="ts">
import { TOOLS } from '~/utils/tools'

useSeoMeta({
  title: 'Tools',
  description: 'Free developer tools that run entirely in your browser: JSON, JWT, Base64, Protobuf, random strings and text stats.',
  ogTitle: 'DevKit · Developer tools',
  ogDescription: 'Free developer tools that run entirely in your browser.',
  ogType: 'website',
})
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">Developer tools</h1>
      <p class="text-muted">Everything runs locally in your browser. Nothing is sent to a server.</p>
    </header>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="tool in TOOLS"
        :key="tool.slug"
        :to="tool.to"
        :data-testid="`tool-card-${tool.slug}`"
        :style="{ boxShadow: `inset 0 2px 0 ${tool.color}` }"
        class="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <component :is="tool.icon" class="size-6" :style="{ color: tool.color }" aria-hidden="true" />
        <h2 class="font-semibold">{{ tool.title }}</h2>
        <p class="text-sm text-muted">{{ tool.description }}</p>
      </NuxtLink>
    </div>
  </section>
</template>
