<script setup lang="ts">
import { FileUp } from '@lucide/vue'
import { MAX_FILE_BYTES, readTextFile } from '~/utils/file'
import type { LoadedTextFile } from '~/utils/file'
import type { Result } from '~/utils/result'

const props = withDefaults(defineProps<{ accept?: string; maxBytes?: number }>(), {
  accept: '',
  maxBytes: MAX_FILE_BYTES,
})

const emit = defineEmits<{ load: [file: LoadedTextFile] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragDepth = ref<number>(0)
const error = ref<string>('')
const isDragging = computed<boolean>(() => dragDepth.value > 0)

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

async function load(file: File | undefined): Promise<void> {
  if (!file) return
  const result: Result<LoadedTextFile> = await readTextFile(file, props.maxBytes)
  if (!result.ok) {
    error.value = result.error.message
    return
  }
  error.value = ''
  emit('load', result.value)
}

// Capture phase: CodeMirror would otherwise insert dropped files into the editor itself.
function onDragEnter(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth.value++
}

function onDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
}

function onDragLeave(event: DragEvent): void {
  if (!hasFiles(event)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

async function onDrop(event: DragEvent): Promise<void> {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
  dragDepth.value = 0
  await load(event.dataTransfer?.files[0])
}

async function onPick(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  await load(input.files?.[0])
  input.value = ''
}

function open(): void {
  fileInput.value?.click()
}

defineExpose({ open, load })
</script>

<template>
  <div
    class="relative flex min-h-0 flex-col gap-2"
    data-testid="file-drop"
    @dragenter.capture="onDragEnter"
    @dragover.capture="onDragOver"
    @dragleave.capture="onDragLeave"
    @drop.capture="onDrop"
  >
    <slot :open="open" />
    <div
      v-if="isDragging"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-accent bg-surface/90 text-sm font-medium text-accent"
    >
      <FileUp class="size-5" aria-hidden="true" />
      Drop file to load it
    </div>
    <p v-if="error" role="alert" data-testid="file-drop-error" class="text-sm text-danger">{{ error }}</p>
    <input ref="fileInput" type="file" class="hidden" :accept="accept" tabindex="-1" aria-hidden="true" @change="onPick" />
  </div>
</template>
