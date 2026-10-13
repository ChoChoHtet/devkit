<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown } from '@lucide/vue'
import { createRootNode } from '~/utils/json/tree'
import type { JsonTreeNode } from '~/utils/json/tree'

const props = defineProps<{ value: unknown }>()

const expand = provideJsonTreeExpand()
const root = computed<JsonTreeNode>(() => createRootNode(props.value))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex gap-2">
      <button
        type="button"
        data-testid="json-tree-expand-all"
        class="inline-flex items-center gap-1.5 rounded-md border border-control-border px-2.5 py-1 text-xs hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        @click="expand.set('all')"
      >
        <ChevronsUpDown class="size-3.5" aria-hidden="true" />
        Expand all
      </button>
      <button
        type="button"
        data-testid="json-tree-collapse-all"
        class="inline-flex items-center gap-1.5 rounded-md border border-control-border px-2.5 py-1 text-xs hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        @click="expand.set('none')"
      >
        <ChevronsDownUp class="size-3.5" aria-hidden="true" />
        Collapse all
      </button>
    </div>
    <ul data-testid="json-tree" aria-label="JSON tree" class="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface p-2">
      <JsonTreeNode :key="root.type" :node="root" :value="value" :depth="0" />
    </ul>
  </div>
</template>
