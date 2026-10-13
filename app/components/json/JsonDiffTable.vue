<script setup lang="ts">
import { previewValue } from '~/utils/json/tree'
import type { JsonDiffEntry, JsonDiffKind } from '~/utils/json/diff'

const props = defineProps<{ entries: readonly JsonDiffEntry[] }>()

const PAGE_SIZE = 500
const KIND_CLASSES: Readonly<Record<JsonDiffKind, string>> = {
  added: 'text-success',
  removed: 'text-danger',
  changed: 'text-warning',
}

const visibleCount = ref<number>(PAGE_SIZE)
const visible = computed<readonly JsonDiffEntry[]>(() => props.entries.slice(0, visibleCount.value))

watch(
  () => props.entries,
  (): void => {
    visibleCount.value = PAGE_SIZE
  },
)
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-border">
    <table data-testid="json-diff-table" class="w-full text-left text-sm">
      <thead class="bg-background text-xs text-muted">
        <tr>
          <th scope="col" class="px-3 py-2 font-medium">Path</th>
          <th scope="col" class="px-3 py-2 font-medium">Change</th>
          <th scope="col" class="px-3 py-2 font-medium">Left</th>
          <th scope="col" class="px-3 py-2 font-medium">Right</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border font-mono">
        <tr v-for="entry in visible" :key="`${entry.kind}:${entry.path}`" :data-kind="entry.kind">
          <td class="px-3 py-1.5 break-all">{{ entry.path }}</td>
          <td class="px-3 py-1.5 font-sans" :class="KIND_CLASSES[entry.kind]">{{ entry.kind }}</td>
          <td class="px-3 py-1.5 break-all text-muted">{{ previewValue(entry.left) }}</td>
          <td class="px-3 py-1.5 break-all">{{ previewValue(entry.right) }}</td>
        </tr>
      </tbody>
    </table>
    <button
      v-if="entries.length > visibleCount"
      type="button"
      class="w-full px-3 py-2 text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      @click="visibleCount += PAGE_SIZE"
    >
      Show more ({{ entries.length - visibleCount }} hidden)
    </button>
  </div>
</template>
