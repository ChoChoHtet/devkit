<script setup lang="ts">
import { Download } from '@lucide/vue'
import { triggerDownload } from '~/utils/download'
import type { DownloadPayload } from '~/utils/result'

const props = withDefaults(defineProps<{ payload: (() => DownloadPayload) | null; label?: string }>(), {
  label: 'Download',
})

function download(): void {
  if (props.payload) triggerDownload(props.payload())
}
</script>

<template>
  <button
    type="button"
    :disabled="payload === null"
    class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    @click="download"
  >
    <Download class="size-3.5" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>
