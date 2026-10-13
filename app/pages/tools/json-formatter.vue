<script setup lang="ts">
import {
  Eraser,
  FileBraces,
  FolderOpen,
  GitCompareArrows,
  ListTree,
  Minimize2,
  Quote,
  Search,
  Sparkles,
  TextAlignStart,
  TextQuote,
} from '@lucide/vue'
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'
import { JSON_INDENTS, inspectJson, isJsonIndent, stringifyJson } from '~/utils/json/format'
import type { JsonIndent, JsonParseInfo } from '~/utils/json/format'
import { escapeJson, unescapeJson } from '~/utils/json/escape'
import { queryJson } from '~/utils/json/query'
import type { JsonQueryResult } from '~/utils/json/query'
import { compareJsonTexts } from '~/utils/json/diff'
import type { JsonCompareResult, JsonDiffEntry } from '~/utils/json/diff'
import { JSON_SAMPLE, JSON_SAMPLE_QUERY, JSON_SAMPLE_RIGHT } from '~/utils/json/sample'
import { copyText } from '~/utils/clipboard'
import { triggerDownload } from '~/utils/download'
import { formatBytes } from '~/utils/file'
import type { LoadedTextFile } from '~/utils/file'
import type { DownloadPayload, Result, ToolError } from '~/utils/result'
import type { EditorDiagnostic } from '~/utils/editor'
import type { TabItem } from '~/utils/ui'

type JsonTab = 'output' | 'tree' | 'query' | 'diff'
type OutputKind = 'formatted' | 'minified' | 'escaped' | 'unescaped'

interface PrimaryOutput {
  text: () => string
  payload: () => DownloadPayload
}

const LIVE_LIMIT_CHARS = 1_000_000
const VALIDATE_DEBOUNCE_MS = 300
const QUERY_DEBOUNCE_MS = 300
const NOTICE_MS = 2000
const JSON_MIME = 'application/json'

const TABS: readonly TabItem<JsonTab>[] = [
  { id: 'output', label: 'Output', icon: FileBraces },
  { id: 'tree', label: 'Tree', icon: ListTree },
  { id: 'query', label: 'Query', icon: Search },
  { id: 'diff', label: 'Diff', icon: GitCompareArrows },
]

const OUTPUT_TITLES: Readonly<Record<OutputKind, string>> = {
  formatted: 'Formatted',
  minified: 'Minified',
  escaped: 'Escaped string',
  unescaped: 'Unescaped text',
}

const tool: ToolDefinition = getTool('json-formatter')
useHead({ title: tool.title })

const inputDrop = ref<{ open: () => void } | null>(null)

const input = ref<string>('')
const indent = usePreference<JsonIndent>('json.indent', 2, isJsonIndent)
const sortKeys = usePreference<boolean>('json.sortKeys', false, isBoolean)
const activeTab = ref<JsonTab>('output')

// Live analysis of the input (debounced, paused for very large inputs).
const info = shallowRef<JsonParseInfo | null>(null)
const parsedValue = shallowRef<unknown>(undefined)
const livePaused = ref<boolean>(false)
let analyzedInput: string | null = null
let validateTimer: ReturnType<typeof setTimeout> | undefined

const output = ref<string>('')
const outputKind = ref<OutputKind>('formatted')
const outputError = ref<ToolError | null>(null)
const unescapedIsJson = ref<boolean>(false)

const queryExpression = ref<string>('')
const appliedQuery = ref<string>('')
let queryTimer: ReturnType<typeof setTimeout> | undefined

const rightInput = ref<string>('')
const diffResult = shallowRef<JsonCompareResult | null>(null)
const comparedTexts = shallowRef<{ left: string; right: string } | null>(null)
const showDiffSides = ref<boolean>(false)

const notice = ref<string>('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function analyze(): void {
  clearTimeout(validateTimer)
  const inspection = inspectJson(input.value)
  info.value = inspection.info
  parsedValue.value = inspection.value
  livePaused.value = false
  analyzedInput = input.value
}

function ensureAnalyzed(): void {
  if (input.value.trim() !== '' && analyzedInput !== input.value) analyze()
}

watch(input, (value: string): void => {
  clearTimeout(validateTimer)
  if (value.trim() === '') {
    info.value = null
    parsedValue.value = undefined
    livePaused.value = false
    analyzedInput = null
    return
  }
  if (value.length > LIVE_LIMIT_CHARS) {
    info.value = null
    parsedValue.value = undefined
    livePaused.value = true
    analyzedInput = null
    return
  }
  validateTimer = setTimeout(analyze, VALIDATE_DEBOUNCE_MS)
})

function describeError(error: ToolError): string {
  return error.line !== undefined ? `Line ${error.line}, column ${error.column ?? 1}: ${error.message}` : error.message
}

const inputDiagnostics = computed<EditorDiagnostic[]>(() => {
  const error = info.value?.error
  if (error?.line !== undefined) return [{ line: error.line, column: error.column ?? 1, message: error.message }]
  if (diffResult.value && !diffResult.value.ok && diffResult.value.side === 'left') {
    const e = diffResult.value.error
    if (e.line !== undefined) return [{ line: e.line, column: e.column ?? 1, message: e.message }]
  }
  return []
})

const rightDiagnostics = computed<EditorDiagnostic[]>(() => {
  const result = diffResult.value
  if (!result || result.ok || result.side !== 'right' || result.error.line === undefined) return []
  return [{ line: result.error.line, column: result.error.column ?? 1, message: result.error.message }]
})

function notify(message: string): void {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout((): void => {
    notice.value = ''
  }, NOTICE_MS)
}

// ── Output tab actions ─────────────────────────────────────────────────────

function writeStringified(kind: 'formatted' | 'minified', switchTab: boolean): void {
  ensureAnalyzed()
  if (switchTab) activeTab.value = 'output'
  if (!info.value?.valid) {
    output.value = ''
    outputError.value = info.value?.error ?? { message: 'Input is empty' }
    return
  }
  output.value = stringifyJson(parsedValue.value, kind === 'formatted' ? indent.value : null, sortKeys.value)
  outputKind.value = kind
  outputError.value = null
}

function format(): void {
  writeStringified('formatted', true)
}

function minify(): void {
  writeStringified('minified', true)
}

function escape(): void {
  activeTab.value = 'output'
  const result: Result<string> = escapeJson(input.value)
  if (!result.ok) {
    outputError.value = result.error
    return
  }
  output.value = result.value
  outputKind.value = 'escaped'
  outputError.value = null
}

function unescape(): void {
  activeTab.value = 'output'
  const result = unescapeJson(input.value)
  if (!result.ok) {
    outputError.value = result.error
    return
  }
  output.value = result.value.text
  outputKind.value = 'unescaped'
  unescapedIsJson.value = result.value.validJson
  outputError.value = null
}

watch([indent, sortKeys], (): void => {
  if (output.value !== '' && (outputKind.value === 'formatted' || outputKind.value === 'minified')) {
    writeStringified(outputKind.value, false)
  }
})

function outputPayload(): DownloadPayload {
  const isJson = outputKind.value !== 'escaped' && !(outputKind.value === 'unescaped' && !unescapedIsJson.value)
  return {
    filename: `${outputKind.value}.${isJson ? 'json' : 'txt'}`,
    mimeType: isJson ? JSON_MIME : 'text/plain',
    data: output.value,
  }
}

// ── Tree tab ───────────────────────────────────────────────────────────────

const treeReady = computed<boolean>(() => info.value?.valid === true)
const treeHint = computed<string>(() => {
  if (input.value.trim() === '') return 'Paste JSON to see its tree.'
  if (livePaused.value) return 'Large input: press Ctrl/⌘ + Enter to build the tree.'
  if (info.value && !info.value.valid) return 'Fix the JSON input to see the tree.'
  return 'Checking…'
})

// ── Query tab ──────────────────────────────────────────────────────────────

watch(queryExpression, (expression: string): void => {
  clearTimeout(queryTimer)
  queryTimer = setTimeout((): void => {
    appliedQuery.value = expression
  }, QUERY_DEBOUNCE_MS)
})

function runQuery(): void {
  clearTimeout(queryTimer)
  ensureAnalyzed()
  appliedQuery.value = queryExpression.value
}

const queryResult = computed<Result<JsonQueryResult> | null>(() => {
  if (activeTab.value !== 'query' || appliedQuery.value.trim() === '') return null
  if (!treeReady.value) return { ok: false, error: { message: treeHint.value } }
  return queryJson(parsedValue.value, appliedQuery.value)
})

const queryOutput = computed<string>(() =>
  queryResult.value?.ok ? stringifyJson(queryResult.value.value.matches, indent.value, false) : '',
)

// ── Diff tab ───────────────────────────────────────────────────────────────

function compare(): void {
  activeTab.value = 'diff'
  diffResult.value = compareJsonTexts(input.value, rightInput.value)
  comparedTexts.value = { left: input.value, right: rightInput.value }
  showDiffSides.value = false
}

const diffEntries = computed<JsonDiffEntry[]>(() => (diffResult.value?.ok ? diffResult.value.value.entries : []))
const diffStale = computed<boolean>(
  () =>
    comparedTexts.value !== null &&
    (comparedTexts.value.left !== input.value || comparedTexts.value.right !== rightInput.value),
)
const diffSummary = computed<string>(() => {
  const counts: Record<string, number> = { added: 0, removed: 0, changed: 0 }
  for (const entry of diffEntries.value) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
  const total = diffEntries.value.length
  return `${total} ${total === 1 ? 'difference' : 'differences'} · ${counts.added} added · ${counts.removed} removed · ${counts.changed} changed`
})

function diffSide(side: 'left' | 'right'): string {
  const result = diffResult.value
  return result?.ok ? stringifyJson(result.value[side], indent.value, true) : ''
}

// ── Shared: copy, download, clear, sample, files, shortcuts ────────────────

const primaryOutput = computed<PrimaryOutput | null>(() => {
  switch (activeTab.value) {
    case 'output':
      return output.value === '' ? null : { text: (): string => output.value, payload: outputPayload }
    case 'tree': {
      if (!treeReady.value) return null
      const text = (): string => stringifyJson(parsedValue.value, indent.value, sortKeys.value)
      return { text, payload: (): DownloadPayload => ({ filename: 'formatted.json', mimeType: JSON_MIME, data: text() }) }
    }
    case 'query':
      if (!queryResult.value?.ok) return null
      return {
        text: (): string => queryOutput.value,
        payload: (): DownloadPayload => ({ filename: 'query-result.json', mimeType: JSON_MIME, data: queryOutput.value }),
      }
    case 'diff': {
      if (!diffResult.value?.ok) return null
      const text = (): string => stringifyJson(diffEntries.value, 2, false)
      return { text, payload: (): DownloadPayload => ({ filename: 'diff.json', mimeType: JSON_MIME, data: text() }) }
    }
  }
  return null
})

async function copyPrimary(): Promise<void> {
  const primary = primaryOutput.value
  if (!primary) return notify('Nothing to copy yet')
  notify((await copyText(primary.text())) ? 'Copied to clipboard' : 'Copy failed: clipboard unavailable')
}

function downloadPrimary(): void {
  const primary = primaryOutput.value
  if (!primary) return notify('Nothing to download yet')
  const payload = primary.payload()
  triggerDownload(payload)
  notify(`Downloaded ${payload.filename}`)
}

function clearAll(): void {
  input.value = ''
  output.value = ''
  outputError.value = null
  queryExpression.value = ''
  appliedQuery.value = ''
  rightInput.value = ''
  diffResult.value = null
  comparedTexts.value = null
}

function loadSample(): void {
  input.value = JSON_SAMPLE
  rightInput.value = JSON_SAMPLE_RIGHT
  queryExpression.value = JSON_SAMPLE_QUERY
  appliedQuery.value = JSON_SAMPLE_QUERY
  analyze()
}

function onInputFile(file: LoadedTextFile): void {
  input.value = file.text
  if (file.text.length <= LIVE_LIMIT_CHARS) analyze()
  notify(`Loaded ${file.name}`)
}

function onRightFile(file: LoadedTextFile): void {
  rightInput.value = file.text
  notify(`Loaded ${file.name} as Right`)
}

function runActive(): void {
  switch (activeTab.value) {
    case 'output':
      return outputKind.value === 'minified' ? minify() : format()
    case 'tree':
      return ensureAnalyzed()
    case 'query':
      return runQuery()
    case 'diff':
      return compare()
  }
}

useShortcuts({
  run: runActive,
  copy: (): void => void copyPrimary(),
  download: downloadPrimary,
  clear: clearAll,
  open: (): void => inputDrop.value?.open(),
})

onBeforeUnmount((): void => {
  clearTimeout(validateTimer)
  clearTimeout(queryTimer)
  clearTimeout(noticeTimer)
})

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon">
    <div class="flex flex-col gap-4 lg:flex-1">
      <div role="toolbar" aria-label="JSON actions" class="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="json-format" :class="primaryButtonClass" @click="format">
          <TextAlignStart class="size-4" aria-hidden="true" />
          Format
        </button>
        <button type="button" data-testid="json-minify" :class="buttonClass" @click="minify">
          <Minimize2 class="size-4" aria-hidden="true" />
          Minify
        </button>
        <button type="button" data-testid="json-escape" :class="buttonClass" @click="escape">
          <Quote class="size-4" aria-hidden="true" />
          Escape
        </button>
        <button type="button" data-testid="json-unescape" :class="buttonClass" @click="unescape">
          <TextQuote class="size-4" aria-hidden="true" />
          Unescape
        </button>
        <label class="ml-1 flex items-center gap-1.5 text-sm">
          Indent
          <select
            v-model="indent"
            data-testid="json-indent"
            class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option v-for="option in JSON_INDENTS" :key="option" :value="option">
              {{ option === 'tab' ? 'Tab' : `${option} spaces` }}
            </option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-sm">
          <input v-model="sortKeys" type="checkbox" data-testid="json-sort" class="size-4 accent-accent" />
          Sort keys
        </label>
        <span class="hidden flex-1 lg:block" />
        <button type="button" data-testid="json-sample" :class="buttonClass" @click="loadSample">
          <Sparkles class="size-4" aria-hidden="true" />
          Sample
        </button>
        <button type="button" data-testid="json-clear" :class="buttonClass" @click="clearAll">
          <Eraser class="size-4" aria-hidden="true" />
          Clear
        </button>
        <button type="button" data-testid="json-open" :class="buttonClass" @click="inputDrop?.open()">
          <FolderOpen class="size-4" aria-hidden="true" />
          Open file
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:min-h-[max(30rem,calc(100dvh-24rem))] lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        <FileDrop ref="inputDrop" class="lg:h-full" accept=".json,application/json,text/plain" @load="onInputFile">
          <div class="flex h-9 items-center">
            <span class="text-sm font-medium">{{ activeTab === 'diff' ? 'Left (input)' : 'Input' }}</span>
          </div>
          <div class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
            <CodeEditor
              v-model="input"
              data-testid="json-input"
              :label="activeTab === 'diff' ? 'Left JSON (input)' : 'JSON input'"
              :diagnostics="inputDiagnostics"
              placeholder="Paste JSON here, or drop a .json file…"
            />
          </div>
        </FileDrop>

        <div class="flex min-h-0 min-w-0 flex-col gap-2 lg:h-full">
          <TabList v-model="activeTab" :tabs="TABS" label="JSON views" id-prefix="json" />

          <div
            v-show="activeTab === 'output'"
            id="json-panel-output"
            role="tabpanel"
            aria-labelledby="json-tab-output"
            class="flex flex-col gap-2 lg:min-h-0 lg:flex-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium" data-testid="json-output-title">{{ OUTPUT_TITLES[outputKind] }}</span>
              <div class="flex gap-2">
                <CopyButton :text="output" />
                <DownloadButton :payload="output === '' ? null : outputPayload" />
              </div>
            </div>
            <p v-if="outputError" role="alert" data-testid="json-output-error" class="text-sm text-danger">
              {{ describeError(outputError) }}
            </p>
            <StatusBadge
              v-if="outputKind === 'unescaped' && output !== '' && !outputError"
              data-testid="json-unescape-status"
              :tone="unescapedIsJson ? 'success' : 'warning'"
            >
              {{ unescapedIsJson ? 'Unescaped text is valid JSON' : 'Unescaped text is not valid JSON' }}
            </StatusBadge>
            <div class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
              <CodeEditor
                :model-value="output"
                data-testid="json-output"
                label="Output"
                readonly
                :language="outputKind === 'escaped' || (outputKind === 'unescaped' && !unescapedIsJson) ? 'plain' : 'json'"
                placeholder="Press Format, Minify, Escape or Unescape to see the result."
              />
            </div>
          </div>

          <div
            v-if="activeTab === 'tree'"
            id="json-panel-tree"
            role="tabpanel"
            aria-labelledby="json-tab-tree"
            class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size"
          >
            <JsonTree v-if="treeReady" :value="parsedValue" />
            <p v-else data-testid="json-tree-empty" class="text-sm text-muted">{{ treeHint }}</p>
          </div>

          <div
            v-if="activeTab === 'query'"
            id="json-panel-query"
            role="tabpanel"
            aria-labelledby="json-tab-query"
            class="flex flex-col gap-2 lg:min-h-0 lg:flex-1"
          >
            <label for="json-query-input" class="text-sm font-medium">JSONPath expression</label>
            <input
              id="json-query-input"
              v-model="queryExpression"
              data-testid="json-query-input"
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder="$.items[?(@.price > 10)].name"
              class="w-full rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              @keydown.enter.prevent="runQuery"
            />
            <div class="flex min-h-7 items-center justify-between gap-2">
              <p v-if="queryResult && !queryResult.ok" role="alert" data-testid="json-query-error" class="text-sm text-danger">
                {{ queryResult.error.message }}
              </p>
              <StatusBadge v-else-if="queryResult?.ok" data-testid="json-query-count" tone="muted">
                {{ queryResult.value.count }} {{ queryResult.value.count === 1 ? 'match' : 'matches' }}
              </StatusBadge>
              <p v-else class="text-sm text-muted">Results update as you type.</p>
              <div class="flex gap-2">
                <CopyButton :text="queryOutput" />
                <DownloadButton :payload="primaryOutput && activeTab === 'query' ? primaryOutput.payload : null" />
              </div>
            </div>
            <div class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
              <CodeEditor :model-value="queryOutput" data-testid="json-query-output" label="Query matches" readonly />
            </div>
          </div>

          <div
            v-if="activeTab === 'diff'"
            id="json-panel-diff"
            role="tabpanel"
            aria-labelledby="json-tab-diff"
            class="flex flex-col gap-2 lg:min-h-0 lg:flex-1"
          >
            <FileDrop class="lg:min-h-0 lg:flex-1" accept=".json,application/json,text/plain" @load="onRightFile">
              <div class="flex h-9 items-center justify-between gap-2">
                <span class="text-sm font-medium">Right</span>
                <button type="button" data-testid="json-compare" :class="primaryButtonClass" @click="compare">
                  <GitCompareArrows class="size-4" aria-hidden="true" />
                  Compare
                </button>
              </div>
              <div class="h-80 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
                <CodeEditor
                  v-model="rightInput"
                  data-testid="json-diff-right"
                  label="Right JSON"
                  :diagnostics="rightDiagnostics"
                  placeholder="Paste the JSON to compare against the input…"
                />
              </div>
            </FileDrop>
          </div>
        </div>
      </div>

      <div class="flex min-h-6 flex-wrap items-center gap-x-6 gap-y-1" data-testid="json-status">
        <StatusBadge v-if="input.trim() === ''" tone="muted">Paste JSON, drop a .json file, or load the sample.</StatusBadge>
        <StatusBadge v-else-if="livePaused" tone="muted">
          Large input ({{ formatBytes(input.length) }}): live validation paused. Press Format or Ctrl/⌘ + Enter.
        </StatusBadge>
        <template v-else-if="info">
          <StatusBadge v-if="info.valid" tone="success" data-testid="json-valid">
            Valid JSON · {{ info.size.toLocaleString() }} chars
          </StatusBadge>
          <div v-else class="flex flex-wrap items-center gap-2" role="alert">
            <StatusBadge tone="danger" data-testid="json-invalid">Invalid JSON</StatusBadge>
            <span data-testid="json-error" class="text-sm text-danger">{{ describeError(info.error ?? { message: 'Unknown error' }) }}</span>
          </div>
          <StatusBadge v-if="info.hasUnsafeIntegers" tone="warning" data-testid="json-unsafe-warning">
            Some numbers are too large and may lose precision.
          </StatusBadge>
        </template>
        <span aria-live="polite" data-testid="json-notice" class="text-sm text-muted">{{ notice }}</span>
      </div>

      <section
        v-if="activeTab === 'diff' && diffResult"
        aria-labelledby="json-diff-title"
        data-testid="json-diff-results"
        class="space-y-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="json-diff-title" class="text-base font-semibold">Differences</h2>
          <div v-if="diffResult.ok" class="flex gap-2">
            <CopyButton :text="primaryOutput?.text ?? ''" label="Copy diff" />
            <DownloadButton :payload="primaryOutput?.payload ?? null" />
          </div>
        </div>
        <StatusBadge v-if="diffStale" tone="warning">Inputs changed since the last comparison. Press Compare to refresh.</StatusBadge>
        <p v-if="!diffResult.ok" role="alert" data-testid="json-diff-error" class="text-sm text-danger">
          {{ describeError(diffResult.error) }}
        </p>
        <template v-else>
          <StatusBadge v-if="diffEntries.length === 0" tone="success" data-testid="json-diff-none">No differences</StatusBadge>
          <template v-else>
            <p class="text-sm text-muted" data-testid="json-diff-summary">{{ diffSummary }}</p>
            <JsonDiffTable :entries="diffEntries" />
          </template>
          <button
            type="button"
            data-testid="json-diff-sides-toggle"
            :aria-expanded="showDiffSides"
            class="text-sm text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            @click="showDiffSides = !showDiffSides"
          >
            {{ showDiffSides ? 'Hide' : 'Show' }} both sides formatted (keys sorted)
          </button>
          <div v-if="showDiffSides" class="grid gap-4 lg:grid-cols-2">
            <div class="h-80">
              <CodeEditor :model-value="diffSide('left')" label="Left, formatted" readonly />
            </div>
            <div class="h-80">
              <CodeEditor :model-value="diffSide('right')" label="Right, formatted" readonly />
            </div>
          </div>
        </template>
      </section>
    </div>
  </ToolPage>
</template>
