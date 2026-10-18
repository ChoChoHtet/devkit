<script setup lang="ts">
defineProps<{ label: string; value: string; testid?: string }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2 py-1">
    <span class="text-sm text-muted">{{ label }}</span>
    <div class="flex min-w-0 items-center gap-2">
      <span class="font-mono text-sm break-all" :data-testid="testid">{{ value }}</span>
      <CopyButton :text="value" compact />
    </div>
  </div>
</template>
