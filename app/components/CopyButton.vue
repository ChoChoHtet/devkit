<script setup lang="ts">
import { Check, CircleAlert, Copy } from '@lucide/vue'
import { copyText } from '~/utils/clipboard'

type CopyState = 'idle' | 'copied' | 'failed'

const props = withDefaults(
  defineProps<{
    // A function defers expensive serialisation (e.g. a large tree node) until the click.
    text: string | (() => string)
    label?: string
    compact?: boolean
    disabled?: boolean
  }>(),
  { label: 'Copy', compact: false, disabled: false },
)

const FEEDBACK_MS = 1500
const state = ref<CopyState>('idle')
let resetTimer: ReturnType<typeof setTimeout> | undefined

const isDisabled = computed<boolean>(() => props.disabled || props.text === '')
const failureHint = computed<string | undefined>(() =>
  state.value === 'failed' ? 'Clipboard unavailable (needs HTTPS or localhost and permission)' : undefined,
)

async function copy(): Promise<void> {
  const text: string = typeof props.text === 'function' ? props.text() : props.text
  state.value = (await copyText(text)) ? 'copied' : 'failed'
  clearTimeout(resetTimer)
  resetTimer = setTimeout((): void => {
    state.value = 'idle'
  }, FEEDBACK_MS)
}

onBeforeUnmount((): void => clearTimeout(resetTimer))
</script>

<template>
  <button
    type="button"
    :disabled="isDisabled"
    :title="failureHint ?? (compact ? label : undefined)"
    :aria-label="compact ? label : undefined"
    class="inline-flex items-center gap-1.5 rounded-md border border-border text-xs hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    :class="compact ? 'p-1' : 'px-2.5 py-1'"
    @click="copy"
  >
    <Check v-if="state === 'copied'" class="size-3.5 text-success" aria-hidden="true" />
    <CircleAlert v-else-if="state === 'failed'" class="size-3.5 text-danger" aria-hidden="true" />
    <Copy v-else class="size-3.5" aria-hidden="true" />
    <span v-if="!compact">{{ state === 'copied' ? 'Copied' : label }}</span>
  </button>
</template>
