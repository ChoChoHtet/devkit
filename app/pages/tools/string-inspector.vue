<script setup lang="ts">
import { Eraser, FolderOpen, ScanText, Sparkles } from '@lucide/vue'
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'
import { copyText } from '~/utils/clipboard'
import { triggerDownload } from '~/utils/download'
import type { LoadedTextFile } from '~/utils/file'
import type { DownloadPayload, Result } from '~/utils/result'
import { analyzeString } from '~/utils/string/stats'
import type { StringStats } from '~/utils/string/stats'

const LIVE_LIMIT_CHARS = 1_000_000
const ANALYZE_DEBOUNCE_MS = 300
const NOTICE_MS = 2000
const JSON_MIME = 'application/json'
const SAMPLE_TEXT = 'Hello, 世界! 👋\nSecond line.'

const tool: ToolDefinition = getTool('string-inspector')
useToolSeo(tool)

const inputDrop = ref<{ open: () => void } | null>(null)
const input = ref<string>('')
const stats = shallowRef<Result<StringStats> | null>(analyzeString(''))
const livePaused = ref<boolean>(false)
const notice = ref<string>('')
let analyzeTimer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const statsJson = computed<string>((): string =>
  stats.value?.ok ? JSON.stringify(stats.value.value, null, 2) : '',
)

const downloadPayload = computed<(() => DownloadPayload) | null>((): (() => DownloadPayload) | null => {
  if (statsJson.value === '') return null
  const data: string = statsJson.value
  return (): DownloadPayload => ({ filename: 'string-stats.json', mimeType: JSON_MIME, data })
})

function analyze(): void {
  clearTimeout(analyzeTimer)
  livePaused.value = false
  stats.value = analyzeString(input.value)
}

watch(input, (value: string): void => {
  clearTimeout(analyzeTimer)
  if (value.length > LIVE_LIMIT_CHARS) {
    livePaused.value = true
    stats.value = null
    return
  }
  livePaused.value = false
  if (value === '') {
    stats.value = analyzeString('')
    return
  }
  analyzeTimer = setTimeout(analyze, ANALYZE_DEBOUNCE_MS)
})

function loadSample(): void {
  input.value = SAMPLE_TEXT
  analyze()
}

function clearAll(): void {
  input.value = ''
}

function onFile(file: LoadedTextFile): void {
  input.value = file.text
}

function notify(message: string): void {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout((): void => {
    notice.value = ''
  }, NOTICE_MS)
}

async function copyStats(): Promise<void> {
  if (statsJson.value === '') return
  notify((await copyText(statsJson.value)) ? 'Copied to clipboard' : 'Clipboard unavailable')
}

function downloadStats(): void {
  if (downloadPayload.value) triggerDownload(downloadPayload.value())
}

useShortcuts({
  run: analyze,
  copy: (): void => void copyStats(),
  download: downloadStats,
  clear: clearAll,
  open: (): void => inputDrop.value?.open(),
})

onBeforeUnmount((): void => {
  clearTimeout(analyzeTimer)
  clearTimeout(noticeTimer)
})

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-control-border bg-surface px-3 py-1.5 text-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon" :color="tool.color">
    <div class="flex min-h-0 flex-1 flex-col gap-4">
      <div role="toolbar" aria-label="String inspector actions" class="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="string-open" :class="buttonClass" @click="inputDrop?.open()">
          <FolderOpen class="size-4" aria-hidden="true" />
          Open file
        </button>
        <button type="button" data-testid="string-sample" :class="buttonClass" @click="loadSample">
          <Sparkles class="size-4" aria-hidden="true" />
          Sample
        </button>
        <button type="button" data-testid="string-clear" :class="buttonClass" @click="clearAll">
          <Eraser class="size-4" aria-hidden="true" />
          Clear
        </button>
        <button
          v-if="livePaused"
          type="button"
          data-testid="string-analyze"
          :class="primaryButtonClass"
          @click="analyze"
        >
          <ScanText class="size-4" aria-hidden="true" />
          Analyze
        </button>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:min-h-[max(30rem,calc(100dvh-18rem))]">
        <FileDrop ref="inputDrop" class="flex min-h-0 flex-col gap-2 lg:h-full" @load="onFile">
          <div class="flex h-9 items-center">
            <span class="text-sm font-medium">Input</span>
          </div>
          <div class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
            <CodeEditor
              v-model="input"
              data-testid="string-input"
              label="Text input"
              language="plain"
              wrap
              placeholder="Paste or type text, or drop a .txt file."
            />
          </div>
        </FileDrop>

        <div class="flex min-h-0 min-w-0 flex-col gap-2 lg:h-full">
          <div class="flex h-9 items-center justify-between gap-2">
            <span class="text-sm font-medium">Stats</span>
            <div class="flex items-center gap-2">
              <CopyButton :text="statsJson" label="Copy" />
              <DownloadButton :payload="downloadPayload" label="Download" />
            </div>
          </div>
          <p v-if="livePaused" data-testid="string-paused" class="text-sm text-muted">
            Large input: press Analyze to update the stats.
          </p>
          <p v-else-if="stats && !stats.ok" role="alert" data-testid="string-error" class="text-sm text-danger">
            {{ stats.error.message }}
          </p>
          <StringStatsTable v-else-if="stats?.ok" :stats="stats.value" />
          <p v-if="notice" role="status" class="text-sm text-muted">{{ notice }}</p>
        </div>
      </div>
    </div>
  </ToolPage>
</template>
