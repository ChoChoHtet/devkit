<script setup lang="ts">
import { Eraser, Sparkles } from '@lucide/vue'
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'
import {
  applyPreset,
  decodeTimestamp,
  describeZoneOffset,
  encodeZonedDateTime,
  isNonEmptyString,
  isTimestampUnit,
  listTimeZones,
  resolveLocalTimeZone,
  TIMESTAMP_PRESETS,
} from '~/utils/timestamp/convert'
import type { EncodedTimestamp, PresetOffset, TimestampDecoded, TimestampUnit } from '~/utils/timestamp/convert'
import { copyText } from '~/utils/clipboard'
import type { Result } from '~/utils/result'

const NOTICE_MS = 2000
// 2023-11-14T22:13:20.000Z — a fixed, recognizable worked example (not time-relative).
const SAMPLE_EPOCH_SECONDS = 1_700_000_000

const tool: ToolDefinition = getTool('timestamp-converter')
useToolSeo(tool)

const notice = ref<string>('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string): void {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout((): void => {
    notice.value = ''
  }, NOTICE_MS)
}

// Explicit field options, not dateStyle/timeStyle: combining either with timeZoneName breaks in
// happy-dom (our test env), even though real browsers handle it fine.
function localDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

// ── Now panel ────────────────────────────────────────────────────────────────

// Starts null and is only set in onMounted: reading Date.now() at setup time would bake a
// server-prerendered timestamp into the SSR output, which then mismatches the client's on hydration.
const nowMs = ref<number | null>(null)
let nowTimer: ReturnType<typeof setInterval> | undefined

onMounted((): void => {
  nowMs.value = Date.now()
  nowTimer = setInterval((): void => {
    nowMs.value = Date.now()
  }, 1000)
})

const nowEpochSeconds = computed<string>(() => (nowMs.value === null ? '' : String(Math.floor(nowMs.value / 1000))))
const nowEpochMs = computed<string>(() => (nowMs.value === null ? '' : String(nowMs.value)))
const nowLocal = computed<string>(() => (nowMs.value === null ? '' : localDateTime(nowMs.value)))
const nowUtc = computed<string>(() => (nowMs.value === null ? '' : new Date(nowMs.value).toISOString()))

// ── Decode ───────────────────────────────────────────────────────────────────

const decodeInput = ref<string>('')
const decodeUnit = usePreference<TimestampUnit>('timestamp.unit', 'auto', isTimestampUnit)

const decoded = computed<Result<TimestampDecoded> | null>(() =>
  decodeInput.value.trim() === '' ? null : decodeTimestamp(decodeInput.value, decodeUnit.value, nowMs.value ?? Date.now()),
)
const decodedLocal = computed<string>(() => (decoded.value?.ok ? localDateTime(decoded.value.value.epochMs) : ''))

// ── Encode ───────────────────────────────────────────────────────────────────

const encodeInput = ref<string>('')
const encodeZone = usePreference<string>('timestamp.zone', 'UTC', isNonEmptyString)

// Both start empty/blank and are only populated in onMounted: the zone list and "what is local
// here" depend on the runtime's Intl data and the host's configured timezone, neither of which
// can be assumed to match between the server that prerenders this page and the client that
// hydrates it (same hydration-mismatch hazard as the Now panel's clock, above).
const localZoneName = ref<string>('')
const timeZones = ref<readonly string[]>([])

onMounted((): void => {
  localZoneName.value = resolveLocalTimeZone()
  timeZones.value = listTimeZones()
})

const otherTimeZones = computed<readonly string[]>(() => timeZones.value.filter((zone) => zone !== localZoneName.value))

const encoded = computed<Result<EncodedTimestamp> | null>(() =>
  encodeInput.value.trim() === '' ? null : encodeZonedDateTime(encodeInput.value, encodeZone.value),
)
const encodedOffset = computed<string>(() => {
  if (!encoded.value?.ok) return ''
  const offset = describeZoneOffset(encoded.value.value.epochMs, encodeZone.value)
  return offset.ok ? offset.value : ''
})

// ── Presets, sample, clear, shortcuts ──────────────────────────────────────────

function applyPresetToDecode(preset: PresetOffset): void {
  decodeInput.value = String(applyPreset(preset, nowMs.value ?? Date.now()))
  decodeUnit.value = 'auto'
}

function loadSample(): void {
  decodeInput.value = String(SAMPLE_EPOCH_SECONDS)
  decodeUnit.value = 'auto'
}

function clearTool(): void {
  decodeInput.value = ''
  encodeInput.value = ''
}

async function copyPrimary(): Promise<void> {
  const text = decoded.value?.ok ? String(decoded.value.value.epochSeconds) : nowEpochSeconds.value
  notify((await copyText(text)) ? 'Copied to clipboard' : 'Copy failed: clipboard unavailable')
}

useShortcuts({
  copy: (): void => void copyPrimary(),
  clear: clearTool,
})

onBeforeUnmount((): void => {
  clearInterval(nowTimer)
  clearTimeout(noticeTimer)
})

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-control-border bg-surface px-3 py-1.5 text-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const fieldClass =
  'rounded-md border border-control-border bg-background px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
const radioClass = 'size-4 accent-accent'
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon" :color="tool.color">
    <div class="flex flex-col gap-4">
      <section aria-labelledby="timestamp-now-title" class="rounded-lg border border-border p-4">
        <h2 id="timestamp-now-title" class="mb-2 text-sm font-medium text-muted uppercase">Now</h2>
        <div class="divide-y divide-border">
          <TimestampValueRow label="Epoch seconds" :value="nowEpochSeconds" testid="timestamp-now-epoch-s" />
          <TimestampValueRow label="Epoch milliseconds" :value="nowEpochMs" testid="timestamp-now-epoch-ms" />
          <TimestampValueRow label="Local" :value="nowLocal" testid="timestamp-now-local" />
          <TimestampValueRow label="UTC" :value="nowUtc" testid="timestamp-now-utc" />
        </div>
      </section>

      <div role="toolbar" aria-label="Timestamp presets" class="flex flex-wrap items-center gap-2">
        <button
          v-for="preset in TIMESTAMP_PRESETS"
          :key="preset.id"
          type="button"
          :data-testid="`timestamp-preset-${preset.id}`"
          :class="buttonClass"
          @click="applyPresetToDecode(preset)"
        >
          {{ preset.label }}
        </button>
        <span class="hidden flex-1 lg:block" />
        <button type="button" data-testid="timestamp-sample" :class="buttonClass" @click="loadSample">
          <Sparkles class="size-4" aria-hidden="true" />
          Sample
        </button>
        <button type="button" data-testid="timestamp-clear" :class="buttonClass" @click="clearTool">
          <Eraser class="size-4" aria-hidden="true" />
          Clear
        </button>
        <span aria-live="polite" data-testid="timestamp-notice" class="text-sm text-muted">{{ notice }}</span>
      </div>

      <fieldset class="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend class="px-1 text-sm font-medium">Decode</legend>
        <div class="flex flex-wrap items-end gap-4">
          <label class="flex flex-col gap-1 text-sm">
            Timestamp
            <input
              v-model="decodeInput"
              type="text"
              inputmode="numeric"
              data-testid="timestamp-decode-input"
              spellcheck="false"
              autocomplete="off"
              placeholder="1700000000"
              class="w-48 font-mono"
              :class="fieldClass"
            />
          </label>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-muted">Unit</span>
            <label class="inline-flex items-center gap-1.5">
              <input v-model="decodeUnit" type="radio" name="timestamp-unit" value="auto" :class="radioClass" />
              Auto
            </label>
            <label class="inline-flex items-center gap-1.5">
              <input v-model="decodeUnit" type="radio" name="timestamp-unit" value="s" :class="radioClass" />
              Seconds
            </label>
            <label class="inline-flex items-center gap-1.5">
              <input v-model="decodeUnit" type="radio" name="timestamp-unit" value="ms" :class="radioClass" />
              Milliseconds
            </label>
          </div>
        </div>
        <p v-if="decoded && !decoded.ok" role="alert" data-testid="timestamp-decode-error" class="text-sm text-danger">
          {{ decoded.error.message }}
        </p>
        <div v-else-if="decoded?.ok" class="divide-y divide-border">
          <TimestampValueRow label="Local" :value="decodedLocal" testid="timestamp-decode-local" />
          <TimestampValueRow label="UTC" :value="decoded.value.utcIso" testid="timestamp-decode-utc" />
          <TimestampValueRow label="Relative" :value="decoded.value.relative" testid="timestamp-decode-relative" />
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend class="px-1 text-sm font-medium">Encode</legend>
        <div class="flex flex-wrap items-end gap-4">
          <label class="flex flex-col gap-1 text-sm">
            Date/time
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="encodeInput"
                type="text"
                data-testid="timestamp-encode-input"
                spellcheck="false"
                autocomplete="off"
                placeholder="2026-01-01T00:00"
                class="w-48 font-mono"
                :class="fieldClass"
              />
              <input
                v-model="encodeInput"
                type="datetime-local"
                data-testid="timestamp-encode-picker"
                aria-label="Pick a date and time"
                :class="fieldClass"
              />
            </div>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Time zone
            <input
              v-model="encodeZone"
              type="text"
              list="timestamp-zone-options"
              data-testid="timestamp-encode-zone"
              autocomplete="off"
              spellcheck="false"
              placeholder="Search a time zone…"
              class="w-56 font-mono"
              :class="fieldClass"
            />
            <datalist id="timestamp-zone-options" data-testid="timestamp-zone-options">
              <option v-if="localZoneName" :value="localZoneName">Local ({{ localZoneName }})</option>
              <option v-for="zone in otherTimeZones" :key="zone" :value="zone" />
            </datalist>
          </label>
        </div>
        <p v-if="encoded && !encoded.ok" role="alert" data-testid="timestamp-encode-error" class="text-sm text-danger">
          {{ encoded.error.message }}
        </p>
        <div v-else-if="encoded?.ok" class="divide-y divide-border">
          <TimestampValueRow label="Epoch seconds" :value="String(encoded.value.epochSeconds)" testid="timestamp-encode-epoch-s" />
          <TimestampValueRow label="Epoch milliseconds" :value="String(encoded.value.epochMs)" testid="timestamp-encode-epoch-ms" />
          <TimestampValueRow v-if="encodedOffset" label="Zone offset" :value="encodedOffset" testid="timestamp-encode-offset" />
        </div>
      </fieldset>
    </div>
  </ToolPage>
</template>
