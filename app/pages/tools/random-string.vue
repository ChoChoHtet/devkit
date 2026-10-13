<script setup lang="ts">
import { Dices, Eraser, Sparkles } from '@lucide/vue'
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'
import { copyText } from '~/utils/clipboard'
import { triggerDownload } from '~/utils/download'
import type { DownloadPayload, Result } from '~/utils/result'
import { buildAlphabet } from '~/utils/random/charset'
import {
  COUNT_RANGE,
  DEFAULT_LENGTH,
  LENGTH_RANGE,
  generateStrings,
  isCount,
  isLength,
  rangeError,
} from '~/utils/random/generate'
import type { RandomStringOptions, RandomStringResult } from '~/utils/random/generate'

const NOTICE_MS = 2000
const TEXT_MIME = 'text/plain'

const tool: ToolDefinition = getTool('random-string')
useToolSeo(tool)

const uppercase = usePreference<boolean>('random.uppercase', true, isBoolean)
const lowercase = usePreference<boolean>('random.lowercase', true, isBoolean)
const digits = usePreference<boolean>('random.digits', true, isBoolean)
const symbols = usePreference<boolean>('random.symbols', false, isBoolean)
const length = usePreference<number>('random.length', DEFAULT_LENGTH, isLength)
const count = usePreference<number>('random.count', 1, isCount)
const unique = usePreference<boolean>('random.unique', false, isBoolean)
// Custom characters are never stored (RS-11).
const customChars = ref<string>('')

const outcome = shallowRef<Result<RandomStringResult> | null>(null)
const notice = ref<string>('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const options = computed<RandomStringOptions>(
  (): RandomStringOptions => ({
    uppercase: uppercase.value,
    lowercase: lowercase.value,
    digits: digits.value,
    symbols: symbols.value,
    customChars: customChars.value,
    length: length.value,
    count: count.value,
    unique: unique.value,
  }),
)

const alphabetError = computed<string | null>((): string | null => {
  const alphabet: Result<string> = buildAlphabet(options.value)
  return alphabet.ok ? null : alphabet.error.message
})
const lengthError = computed<string | null>((): string | null =>
  rangeError(length.value, LENGTH_RANGE, 'Length'),
)
const countError = computed<string | null>((): string | null => rangeError(count.value, COUNT_RANGE, 'Count'))

const runError = computed<string | null>((): string | null => {
  if (outcome.value && !outcome.value.ok) return outcome.value.error.message
  return null
})

const outputText = computed<string>((): string =>
  outcome.value?.ok ? outcome.value.value.values.join('\n') : '',
)

const summary = computed<string>((): string => {
  if (!outcome.value?.ok) return ''
  const { alphabetSize, entropyBits } = outcome.value.value
  return `Alphabet ${alphabetSize} · ${entropyBits.toFixed(1)} bits per string`
})

const downloadPayload = computed<(() => DownloadPayload) | null>((): (() => DownloadPayload) | null => {
  if (outputText.value === '') return null
  const data: string = outputText.value
  return (): DownloadPayload => ({ filename: 'random.txt', mimeType: TEXT_MIME, data })
})

function generate(): void {
  outcome.value = generateStrings(options.value)
}

function loadSample(): void {
  uppercase.value = true
  lowercase.value = true
  digits.value = true
  symbols.value = false
  length.value = DEFAULT_LENGTH
  count.value = 1
  unique.value = false
  customChars.value = ''
  generate()
}

function clearTool(): void {
  outcome.value = null
  customChars.value = ''
}

function notify(message: string): void {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout((): void => {
    notice.value = ''
  }, NOTICE_MS)
}

async function copyOutput(): Promise<void> {
  if (outputText.value === '') return
  notify((await copyText(outputText.value)) ? 'Copied to clipboard' : 'Clipboard unavailable')
}

function downloadOutput(): void {
  if (downloadPayload.value) triggerDownload(downloadPayload.value())
}

useShortcuts({
  run: generate,
  copy: (): void => void copyOutput(),
  download: downloadOutput,
  clear: clearTool,
})

onBeforeUnmount((): void => clearTimeout(noticeTimer))

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-control-border bg-surface px-3 py-1.5 text-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'
const fieldClass =
  'rounded-md border border-control-border bg-background px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
const checkboxClass = 'size-4 accent-accent'
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon" :color="tool.color">
    <div class="flex flex-col gap-4">
      <fieldset class="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend class="px-1 text-sm font-medium">Character types</legend>
        <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label class="inline-flex items-center gap-2">
            <input v-model="uppercase" type="checkbox" data-testid="random-uppercase" :class="checkboxClass" />
            Uppercase (A–Z)
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="lowercase" type="checkbox" data-testid="random-lowercase" :class="checkboxClass" />
            Lowercase (a–z)
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="digits" type="checkbox" data-testid="random-digits" :class="checkboxClass" />
            Digits (0–9)
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="symbols" type="checkbox" data-testid="random-symbols" :class="checkboxClass" />
            Symbols
          </label>
        </div>
        <p v-if="alphabetError" role="alert" data-testid="random-alphabet-error" class="text-xs text-danger">
          {{ alphabetError }}
        </p>
        <div class="flex flex-wrap items-end gap-4">
          <label class="flex flex-col gap-1 text-sm">
            Custom characters
            <input
              v-model="customChars"
              type="text"
              data-testid="random-custom"
              class="w-56 font-mono"
              :class="fieldClass"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Length
            <input
              v-model.number="length"
              type="number"
              data-testid="random-length"
              :min="LENGTH_RANGE.min"
              :max="LENGTH_RANGE.max"
              step="1"
              class="w-24"
              :class="fieldClass"
              :aria-invalid="lengthError !== null"
              aria-describedby="random-length-error"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Count
            <input
              v-model.number="count"
              type="number"
              data-testid="random-count"
              :min="COUNT_RANGE.min"
              :max="COUNT_RANGE.max"
              step="1"
              class="w-24"
              :class="fieldClass"
              :aria-invalid="countError !== null"
              aria-describedby="random-count-error"
            />
          </label>
        </div>
        <p v-if="lengthError" id="random-length-error" role="alert" class="text-xs text-danger">
          {{ lengthError }}
        </p>
        <p v-if="countError" id="random-count-error" role="alert" class="text-xs text-danger">{{ countError }}</p>
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="unique" type="checkbox" data-testid="random-unique" :class="checkboxClass" />
          Unique per batch
        </label>
      </fieldset>

      <div role="toolbar" aria-label="Random string actions" class="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="random-generate" :class="primaryButtonClass" @click="generate">
          <Dices class="size-4" aria-hidden="true" />
          Generate
        </button>
        <button type="button" data-testid="random-sample" :class="buttonClass" @click="loadSample">
          <Sparkles class="size-4" aria-hidden="true" />
          Sample
        </button>
        <button type="button" data-testid="random-clear" :class="buttonClass" @click="clearTool">
          <Eraser class="size-4" aria-hidden="true" />
          Clear
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Output</h2>
          <div class="flex items-center gap-2">
            <CopyButton :text="outputText" label="Copy" />
            <DownloadButton :payload="downloadPayload" label="Download" />
          </div>
        </div>
        <textarea
          :value="outputText"
          readonly
          rows="8"
          data-testid="random-output"
          aria-label="Generated strings"
          spellcheck="false"
          class="w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-sm"
          placeholder="Press Generate to create random strings."
        />
        <p v-if="runError" role="alert" data-testid="random-run-error" class="text-sm text-danger">{{ runError }}</p>
        <p v-else-if="summary" data-testid="random-summary" class="text-sm text-muted">{{ summary }}</p>
        <p v-if="notice" role="status" class="text-sm text-muted">{{ notice }}</p>
      </div>
    </div>
  </ToolPage>
</template>
