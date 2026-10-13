<script setup lang="ts">
import type { Component } from 'vue'
import { CircleCheck, CircleX, Info, TriangleAlert } from '@lucide/vue'
import type { StatusTone } from '~/utils/ui'

const props = defineProps<{ tone: StatusTone }>()

const ICONS: Readonly<Record<StatusTone, Component>> = {
  success: CircleCheck,
  danger: CircleX,
  warning: TriangleAlert,
  muted: Info,
}

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  muted: 'text-muted',
}

const icon = computed<Component>(() => ICONS[props.tone])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-sm" :class="TONE_CLASSES[tone]" :data-tone="tone">
    <component :is="icon" class="size-4 shrink-0" aria-hidden="true" />
    <span><slot /></span>
  </span>
</template>
