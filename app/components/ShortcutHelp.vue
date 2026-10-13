<script setup lang="ts">
import { X } from '@lucide/vue'
import { SHORTCUTS } from '~/utils/shortcuts'

const dialog = ref<HTMLDialogElement | null>(null)

function open(): void {
  const el = dialog.value
  if (!el || el.open) return
  if (typeof el.showModal === 'function') el.showModal()
  else el.setAttribute('open', '')
}

function close(): void {
  const el = dialog.value
  if (!el) return
  if (typeof el.close === 'function') el.close()
  else el.removeAttribute('open')
}

useShortcuts({ help: open })

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    data-testid="shortcut-help"
    aria-labelledby="shortcut-help-title"
    class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-5 text-foreground backdrop:bg-black/50"
    @click.self="close"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="shortcut-help-title" class="text-lg font-semibold">Keyboard shortcuts</h2>
      <button
        type="button"
        aria-label="Close"
        class="rounded-md p-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        @click="close"
      >
        <X class="size-5" aria-hidden="true" />
      </button>
    </div>
    <dl class="space-y-2 text-sm">
      <div v-for="shortcut in SHORTCUTS" :key="shortcut.action" class="flex items-center justify-between gap-4">
        <dt class="text-muted">{{ shortcut.description }}</dt>
        <dd>
          <kbd class="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs">{{ shortcut.keys }}</kbd>
        </dd>
      </div>
    </dl>
  </dialog>
</template>
