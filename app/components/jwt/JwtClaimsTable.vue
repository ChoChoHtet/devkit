<script setup lang="ts">
import type { ClaimTiming } from '~/utils/jwt/decode'
import type { StatusTone } from '~/utils/ui'

interface ClaimRow {
  key: string
  value: string
  timing?: ClaimTiming
}

interface ClaimSection {
  title: string
  rows: ClaimRow[]
}

const props = defineProps<{
  header: Record<string, unknown>
  payload: Record<string, unknown>
  timings: readonly ClaimTiming[]
}>()

const TIMING_TONE: Readonly<Record<ClaimTiming['status'], StatusTone>> = {
  expired: 'danger',
  'not-yet-valid': 'warning',
  active: 'success',
}

const TIMING_LABEL: Readonly<Record<ClaimTiming['status'], string>> = {
  expired: 'Expired',
  'not-yet-valid': 'Not yet valid',
  active: 'Active',
}

function describe(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function localDate(timing: ClaimTiming): string {
  // Explicit fields, not dateStyle/timeStyle: combining either with timeZoneName breaks in happy-dom (our test env).
  return new Date(timing.seconds * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

function toRows(record: Record<string, unknown>, timings: readonly ClaimTiming[]): ClaimRow[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    value: describe(value),
    timing: timings.find((t) => t.claim === key),
  }))
}

const sections = computed<ClaimSection[]>(() => [
  { title: 'Header', rows: toRows(props.header, []) },
  { title: 'Payload claims', rows: toRows(props.payload, props.timings) },
])
</script>

<template>
  <table data-testid="jwt-claims-table" class="w-full border-collapse text-sm">
    <caption class="sr-only">JWT header and claims</caption>
    <tbody v-for="section in sections" :key="section.title">
      <tr>
        <th colspan="2" scope="colgroup" class="pt-4 pb-1 text-left text-xs font-medium tracking-wide text-muted uppercase">
          {{ section.title }}
        </th>
      </tr>
      <tr v-if="section.rows.length === 0">
        <td colspan="2" class="py-1.5 text-muted">No fields</td>
      </tr>
      <tr v-for="row in section.rows" :key="row.key" class="border-b border-border align-top">
        <th scope="row" class="py-1.5 pr-4 text-left font-mono font-normal whitespace-nowrap">{{ row.key }}</th>
        <td class="py-1.5 text-right">
          <div class="flex flex-col items-end gap-1">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <span class="font-mono break-all">{{ row.value }}</span>
              <StatusBadge v-if="row.timing" :tone="TIMING_TONE[row.timing.status]" :data-testid="`jwt-timing-${row.key}`">
                {{ TIMING_LABEL[row.timing.status] }}
              </StatusBadge>
            </div>
            <div v-if="row.timing" class="text-xs text-muted" :data-testid="`jwt-timing-${row.key}-date`">
              Local: {{ localDate(row.timing) }} · UTC: {{ row.timing.date }}
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
