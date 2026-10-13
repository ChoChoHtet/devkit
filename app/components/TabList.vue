<script setup lang="ts" generic="T extends string">
import type { TabItem } from '~/utils/ui'

const props = defineProps<{ tabs: readonly TabItem<T>[]; modelValue: T; label: string; idPrefix: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const buttons = ref<HTMLButtonElement[]>([])

function select(index: number): void {
  const tab = props.tabs[index]
  if (!tab) return
  emit('update:modelValue', tab.id)
  buttons.value[index]?.focus()
}

// Roving tabindex per the WAI-ARIA tabs pattern: arrows move between tabs, Tab leaves the list.
function onKeydown(event: KeyboardEvent, index: number): void {
  const last = props.tabs.length - 1
  const targets: Readonly<Record<string, number>> = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }
  const target = targets[event.key]
  if (target === undefined) return
  event.preventDefault()
  select(target)
}
</script>

<template>
  <div role="tablist" :aria-label="label" class="flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
    <button
      v-for="(tab, index) in tabs"
      :id="`${idPrefix}-tab-${tab.id}`"
      :key="tab.id"
      ref="buttons"
      type="button"
      role="tab"
      :data-testid="`${idPrefix}-tab-${tab.id}`"
      :aria-selected="tab.id === modelValue"
      :aria-controls="`${idPrefix}-panel-${tab.id}`"
      :tabindex="tab.id === modelValue ? 0 : -1"
      class="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-selected:border-accent aria-selected:text-foreground"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      <component :is="tab.icon" v-if="tab.icon" class="size-4" aria-hidden="true" />
      {{ tab.label }}
    </button>
  </div>
</template>
