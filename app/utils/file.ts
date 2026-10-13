import { fail, ok } from './result'
import type { Result } from './result'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export interface LoadedTextFile {
  name: string
  text: string
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function readTextFile(file: Blob & { name: string }, maxBytes: number = MAX_FILE_BYTES): Promise<Result<LoadedTextFile>> {
  if (file.size > maxBytes) {
    return fail(`${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}`)
  }
  try {
    return ok({ name: file.name, text: await file.text() })
  } catch (e) {
    return fail(`Could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
