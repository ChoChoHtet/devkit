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
    class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-control-border hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    @click="toggle"
  >
    <Sun v-if="isDark" class="size-5" aria-hidden="true" />
    <Moon v-else class="size-5" aria-hidden="true" />
  </button>
</template>
