<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { TREE_PAGE_SIZE, buildChildren, isExpandedFor, previewValue } from '~/utils/json/tree'
import type { JsonTreeChild, JsonTreeNode, JsonValueType } from '~/utils/json/tree'

const props = defineProps<{ node: JsonTreeNode; value: unknown; depth: number }>()

const VALUE_CLASSES: Readonly<Record<JsonValueType, string>> = {
  string: 'text-success',
  number: 'text-accent',
  boolean: 'text-warning',
  null: 'text-muted italic',
  object: 'text-muted',
  array: 'text-muted',
}

const expandState = useJsonTreeExpand()
const isContainer = computed<boolean>(() => props.node.type === 'object' || props.node.type === 'array')
const expanded = ref<boolean>(isContainer.value && isExpandedFor(expandState.mode, props.depth))
const visibleCount = ref<number>(TREE_PAGE_SIZE)

watch(
  () => expandState.version,
  (): void => {
    expanded.value = isContainer.value && isExpandedFor(expandState.mode, props.depth)
  },
)

const children = computed<JsonTreeChild[]>(() =>
  expanded.value ? buildChildren(props.value, props.node.path, 0, visibleCount.value) : [],
)
const hiddenCount = computed<number>(() => Math.max(0, (props.node.childCount ?? 0) - visibleCount.value))

const keyLabel = computed<string>(() => (props.node.key === null ? '$' : String(props.node.key)))
const summary = computed<string>(() => {
  const count = props.node.childCount ?? 0
  return props.node.type === 'array'
    ? `[ ${count} ${count === 1 ? 'item' : 'items'} ]`
    : `{ ${count} ${count === 1 ? 'key' : 'keys'} }`
})

function copyValue(): string {
  return typeof props.value === 'string' ? props.value : JSON.stringify(props.value, null, 2)
}

function showMore(): void {
  visibleCount.value += TREE_PAGE_SIZE
}
</script>

<template>
  <li :data-path="node.path">
    <div class="group flex min-w-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-sm hover:bg-background">
      <button
        v-if="isContainer"
        type="button"
        class="rounded text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${node.path}`"
        @click="expanded = !expanded"
      >
        <ChevronRight class="size-4 transition-transform" :class="expanded && 'rotate-90'" aria-hidden="true" />
      </button>
      <span v-else class="inline-block size-4 shrink-0" />
      <span class="shrink-0" :class="typeof node.key === 'number' ? 'text-muted' : 'text-syntax-key'">{{ keyLabel }}</span>
      <span class="text-muted">:</span>
      <span v-if="isContainer" class="text-muted">{{ summary }}</span>
      <span v-else class="truncate" :class="VALUE_CLASSES[node.type]">{{ previewValue(value, 200) }}</span>
      <span class="ml-auto flex shrink-0 gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <CopyButton compact :text="node.path" label="Copy path" />
        <CopyButton compact :text="copyValue" label="Copy value" />
      </span>
    </div>
    <ul v-if="isContainer && expanded" class="ml-3 border-l border-border pl-2">
      <JsonTreeNode v-for="child in children" :key="child.node.path" :node="child.node" :value="child.value" :depth="depth + 1" />
      <li v-if="hiddenCount > 0" class="py-1">
        <button
          type="button"
          data-testid="json-tree-show-more"
          class="rounded px-2 py-0.5 text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          @click="showMore"
        >
          Show {{ Math.min(hiddenCount, TREE_PAGE_SIZE) }} more ({{ hiddenCount }} hidden)
        </button>
      </li>
    </ul>
  </li>
</template>
