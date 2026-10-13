<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound: boolean = props.error.statusCode === 404
useSeoMeta({
  title: isNotFound ? 'Page not found' : 'Something went wrong',
  description: 'The page you were looking for does not exist.',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <section class="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
    <p class="text-sm font-medium text-accent">{{ error.statusCode }}</p>
    <h1 class="text-2xl font-semibold">{{ isNotFound ? 'Page not found' : 'Something went wrong' }}</h1>
    <p class="text-muted">
      {{ isNotFound ? 'The page you were looking for does not exist.' : 'Please try again in a moment.' }}
    </p>
    <NuxtLink
      to="/"
      class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      Back to tools
    </NuxtLink>
  </section>
</template>
