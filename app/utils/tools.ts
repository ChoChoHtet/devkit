import type { Component } from 'vue'
import { Binary, Braces, FileCode, KeyRound } from '@lucide/vue'

export type ToolSlug = 'json-formatter' | 'jwt-inspector' | 'base64url' | 'protobuf'

export interface ToolDefinition {
  slug: ToolSlug
  title: string
  description: string
  to: string
  icon: Component
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Validate, pretty-print, minify and sort JSON.',
    to: '/tools/json-formatter',
    icon: Braces,
  },
  {
    slug: 'jwt-inspector',
    title: 'JWT Inspector',
    description: 'Decode JWT header and claims, check expiry, verify signatures.',
    to: '/tools/jwt-inspector',
    icon: KeyRound,
  },
  {
    slug: 'base64url',
    title: 'Base64 URL',
    description: 'Encode and decode Base64URL / Base64 text.',
    to: '/tools/base64url',
    icon: Binary,
  },
  {
    slug: 'protobuf',
    title: 'Protobuf',
    description: 'Decode protobuf bytes raw or with a .proto schema; encode JSON.',
    to: '/tools/protobuf',
    icon: FileCode,
  },
]

export function getTool(slug: ToolSlug): ToolDefinition {
  const tool: ToolDefinition | undefined = TOOLS.find((t: ToolDefinition): boolean => t.slug === slug)
  if (!tool) throw new Error(`Unknown tool: ${slug}`)
  return tool
}
