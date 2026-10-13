<script setup lang="ts">
import { Download } from '@lucide/vue'
import { triggerDownload } from '~/utils/download'
import type { DownloadPayload } from '~/utils/result'

const props = withDefaults(defineProps<{ payload: (() => DownloadPayload) | null; label?: string; compact?: boolean }>(), {
  label: 'Download',
  compact: false,
})

function download(): void {
  if (props.payload) triggerDownload(props.payload())
}
</script>

<template>
  <button
    type="button"
    :disabled="payload === null"
    :title="compact ? label : undefined"
    :aria-label="compact ? label : undefined"
    class="inline-flex items-center gap-1.5 rounded-md border border-control-border text-xs hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    :class="compact ? 'p-1' : 'px-2.5 py-1'"
    @click="download"
  >
    <Download class="size-3.5" aria-hidden="true" />
    <span v-if="!compact">{{ label }}</span>
  </button>
</template>
