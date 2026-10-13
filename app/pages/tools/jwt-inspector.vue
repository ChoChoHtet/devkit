<script setup lang="ts">
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'

const tool: ToolDefinition = getTool('jwt-inspector')

useToolSeo(tool)
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon" :color="tool.color">
    <div
      data-testid="tool-placeholder"
      class="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted"
    >
      Not implemented yet.
    </div>
  </ToolPage>
</template>
