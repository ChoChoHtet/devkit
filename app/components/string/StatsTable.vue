<script setup lang="ts">
import { formatBytes } from '~/utils/file'
import type { StringStats } from '~/utils/string/stats'

interface StatRow {
  label: string
  value: string
}

interface StatSection {
  title: string
  rows: StatRow[]
}

const props = defineProps<{ stats: StringStats }>()

const sections = computed<StatSection[]>((): StatSection[] => {
  const s: StringStats = props.stats
  return [
    {
      title: 'Counts',
      rows: [
        { label: 'Characters (code points)', value: String(s.characters) },
        { label: 'UTF-16 code units', value: String(s.codeUnits) },
        { label: 'Lines', value: String(s.lines) },
        { label: 'Whitespace characters', value: String(s.whitespace) },
      ],
    },
    {
      title: 'Size',
      rows: [
        { label: 'UTF-8 bytes', value: `${s.utf8Bytes} (${formatBytes(s.utf8Bytes)})` },
        { label: 'UTF-16 bytes', value: `${s.utf16Bytes} (${formatBytes(s.utf16Bytes)})` },
      ],
    },
    {
      title: 'Encoded length (characters)',
      rows: [
        { label: 'Base64', value: String(s.encodings.base64) },
        { label: 'Base64URL', value: String(s.encodings.base64url) },
        { label: 'Hex', value: String(s.encodings.hex) },
        { label: 'URL-encoded', value: String(s.encodings.urlEncoded) },
        { label: 'JSON-escaped', value: String(s.encodings.jsonEscaped) },
      ],
    },
  ]
})
</script>

<template>
  <table data-testid="string-stats" class="w-full border-collapse text-sm">
    <caption class="sr-only">String statistics</caption>
    <tbody v-for="section in sections" :key="section.title">
      <tr>
        <th colspan="2" scope="colgroup" class="pt-4 pb-1 text-left text-xs font-medium tracking-wide text-muted uppercase">
          {{ section.title }}
        </th>
      </tr>
      <tr v-for="row in section.rows" :key="row.label" class="border-b border-border">
        <th scope="row" class="py-1.5 pr-4 text-left font-normal">{{ row.label }}</th>
        <td class="py-1.5 text-right font-mono tabular-nums">{{ row.value }}</td>
      </tr>
    </tbody>
  </table>
</template>
