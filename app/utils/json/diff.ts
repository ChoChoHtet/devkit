import diff from 'microdiff'
import type { ToolError } from '../result'
import { parseJson } from './format'
import { childPath } from './tree'

export type JsonDiffKind = 'added' | 'removed' | 'changed'

export interface JsonDiffEntry {
  path: string
  kind: JsonDiffKind
  left?: unknown
  right?: unknown
}

export function pathToJsonPath(segments: readonly (string | number)[]): string {
  return segments.reduce<string>((path: string, segment: string | number): string => childPath(path, segment), '$')
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object'
}

/** Structural comparison: object key order is ignored, arrays are compared index by index. */
export function diffJson(left: unknown, right: unknown): JsonDiffEntry[] {
  if (!isContainer(left) || !isContainer(right) || Array.isArray(left) !== Array.isArray(right)) {
    // Both sides are JSON values, so stringify equality is exact for primitives.
    if (!isContainer(left) && !isContainer(right) && JSON.stringify(left) === JSON.stringify(right)) return []
    return [{ path: '$', kind: 'changed', left, right }]
  }
  // JSON can't contain cycles, so skip microdiff's cycle tracking for speed.
  return diff(left, right, { cyclesFix: false }).map((change): JsonDiffEntry => {
    const path = pathToJsonPath(change.path)
    switch (change.type) {
      case 'CREATE':
        return { path, kind: 'added', right: change.value }
      case 'REMOVE':
        return { path, kind: 'removed', left: change.oldValue }
      case 'CHANGE':
        return { path, kind: 'changed', left: change.oldValue, right: change.value }
    }
  })
}

export interface JsonComparison {
  entries: JsonDiffEntry[]
  left: unknown
  right: unknown
}

export type JsonCompareResult =
  | { ok: true; value: JsonComparison }
  | { ok: false; side: 'left' | 'right'; error: ToolError }

export function compareJsonTexts(leftText: string, rightText: string): JsonCompareResult {
  const left = parseJson(leftText)
  if (!left.ok) return { ok: false, side: 'left', error: { ...left.error, message: `Left: ${left.error.message}` } }
  const right = parseJson(rightText)
  if (!right.ok) return { ok: false, side: 'right', error: { ...right.error, message: `Right: ${right.error.message}` } }
  return { ok: true, value: { entries: diffJson(left.value, right.value), left: left.value, right: right.value } }
}
