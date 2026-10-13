export interface ToolError {
  message: string
  line?: number
  column?: number
  offset?: number
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError }

export interface DownloadPayload {
  filename: string
  mimeType: string
  data: string | Uint8Array
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T>(message: string, location: Omit<ToolError, 'message'> = {}): Result<T> {
  return { ok: false, error: { message, ...location } }
}
