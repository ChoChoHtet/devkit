export type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export interface JsonTreeNode {
  key: string | number | null
  path: string
  type: JsonValueType
  value?: string | number | boolean | null
  childCount?: number
}

export interface JsonTreeChild {
  node: JsonTreeNode
  value: unknown
}

export const TREE_PAGE_SIZE = 500

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function getJsonType(value: unknown): JsonValueType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'object':
      return 'object'
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'null'
  }
}

/** Bracket notation for non-identifier keys keeps copied paths valid input for the Query tab. */
export function childPath(parentPath: string, key: string | number): string {
  if (typeof key === 'number') return `${parentPath}[${key}]`
  if (IDENTIFIER.test(key)) return `${parentPath}.${key}`
  return `${parentPath}['${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

export function createNode(key: string | number | null, path: string, value: unknown): JsonTreeNode {
  const type = getJsonType(value)
  if (type === 'array') return { key, path, type, childCount: (value as unknown[]).length }
  if (type === 'object') return { key, path, type, childCount: Object.keys(value as object).length }
  return { key, path, type, value: value as string | number | boolean | null }
}

export function createRootNode(value: unknown): JsonTreeNode {
  return createNode(null, '$', value)
}

export function buildChildren(value: unknown, path: string, start: number = 0, limit: number = Infinity): JsonTreeChild[] {
  const end = start + limit
  if (Array.isArray(value)) {
    return value.slice(start, end).map((item: unknown, i: number): JsonTreeChild => {
      const index = start + i
      return { node: createNode(index, childPath(path, index), item), value: item }
    })
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .slice(start, end)
      .map((key: string): JsonTreeChild => ({ node: createNode(key, childPath(path, key), record[key]), value: record[key] }))
  }
  return []
}

export function previewValue(value: unknown, maxLength: number = 120): string {
  if (value === undefined) return '—'
  if (Array.isArray(value)) return `[…] ${value.length} ${value.length === 1 ? 'item' : 'items'}`
  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value).length
    return `{…} ${count} ${count === 1 ? 'key' : 'keys'}`
  }
  if (typeof value === 'string') {
    const text = value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
    return JSON.stringify(text)
  }
  return JSON.stringify(value)
}

export type TreeExpandMode = 'default' | 'all' | 'none'

/** "default" opens levels 1–2 (root and its children); "none" keeps only the root open. */
export function isExpandedFor(mode: TreeExpandMode, depth: number): boolean {
  if (mode === 'all') return true
  if (mode === 'none') return depth === 0
  return depth < 2
}
