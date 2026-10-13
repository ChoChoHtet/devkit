import type { ToolDefinition } from '~/utils/tools'

export function useToolSeo(tool: ToolDefinition): void {
  useSeoMeta({
    title: tool.title,
    description: tool.description,
    ogTitle: `${tool.title} · DevKit`,
    ogDescription: tool.description,
    ogType: 'website',
    twitterCard: 'summary',
  })
}
