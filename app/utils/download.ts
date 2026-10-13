import type { DownloadPayload } from './result'

export function toBlob(payload: DownloadPayload): Blob {
  const data: BlobPart = typeof payload.data === 'string' ? payload.data : new Uint8Array(payload.data)
  return new Blob([data], { type: payload.mimeType })
}

export function triggerDownload(payload: DownloadPayload): void {
  const url = URL.createObjectURL(toBlob(payload))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout((): void => URL.revokeObjectURL(url), 1000)
}
