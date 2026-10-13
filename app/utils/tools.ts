import type { Component } from 'vue'
import { Binary, Braces, Dices, FileCode, KeyRound, ScanText } from '@lucide/vue'

export type ToolSlug = 'json-formatter' | 'jwt-inspector' | 'base64url' | 'protobuf' | 'random-string' | 'string-inspector'

export interface ToolDefinition {
  slug: ToolSlug
  title: string
  description: string
  to: string
  icon: Component
  // CSS colour, a var(--tool-*) token from main.css so light and dark themes both work.
  color: string
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Validate, pretty-print, minify and sort JSON.',
    to: '/tools/json-formatter',
    icon: Braces,
    color: 'var(--tool-blue)',
  },
  {
    slug: 'random-string',
    title: 'Random String',
    description: 'Generate cryptographically random strings for tokens, passwords and test data.',
    to: '/tools/random-string',
    icon: Dices,
    color: 'var(--tool-cyan)',
  },
  {
    slug: 'string-inspector',
    title: 'String Inspector',
    description: 'Count characters, lines and bytes, and see text length in each encoding.',
    to: '/tools/string-inspector',
    icon: ScanText,
    color: 'var(--tool-green)',
  },
  {
    slug: 'jwt-inspector',
    title: 'JWT Inspector',
    description: 'Decode JWT header and claims, check expiry, verify signatures.',
    to: '/tools/jwt-inspector',
    icon: KeyRound,
    color: 'var(--tool-purple)',
  },
  {
    slug: 'base64url',
    title: 'Base64 Encode/Decode',
    description: 'Encode and decode Base64URL / Base64 text.',
    to: '/tools/base64url',
    icon: Binary,
    color: 'var(--tool-orange)',
  },
  {
    slug: 'protobuf',
    title: 'Protobuf',
    description: 'Decode protobuf bytes raw or with a .proto schema; encode JSON.',
    to: '/tools/protobuf',
    icon: FileCode,
    color: 'var(--tool-red)',
  },
]

export function getTool(slug: ToolSlug): ToolDefinition {
  const tool: ToolDefinition | undefined = TOOLS.find((t: ToolDefinition): boolean => t.slug === slug)
  if (!tool) throw new Error(`Unknown tool: ${slug}`)
  return tool
}
