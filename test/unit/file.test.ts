import { describe, expect, it } from 'vitest'
import { formatBytes, readTextFile } from '../../app/utils/file'
import { toBlob } from '../../app/utils/download'
import { diagnosticRange } from '../../app/utils/editor'
import type { DocLike } from '../../app/utils/editor'

describe('readTextFile', () => {
  it('reads UTF-8 text', async () => {
    const file = new File(['{"a":"é"}'], 'a.json', { type: 'application/json' })
    expect(await readTextFile(file)).toEqual({ ok: true, value: { name: 'a.json', text: '{"a":"é"}' } })
  })

  it('rejects files over the limit with a readable size', async () => {
    const file = new File(['x'.repeat(2048)], 'big.json')
    const result = await readTextFile(file, 1024)
    expect(result).toEqual({ ok: false, error: { message: 'big.json is 2.0 KB; the limit is 1.0 KB' } })
  })
})

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect([512, 1536, 5 * 1024 * 1024].map(formatBytes)).toEqual(['512 B', '1.5 KB', '5.0 MB'])
  })
})

describe('toBlob', () => {
  it('keeps the MIME type and content', async () => {
    const blob = toBlob({ filename: 'x.json', mimeType: 'application/json', data: '{}' })
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe('{}')
  })
})

describe('diagnosticRange', () => {
  function doc(text: string): DocLike {
    const lines = text.split('\n')
    const starts: number[] = []
    let offset = 0
    for (const line of lines) {
      starts.push(offset)
      offset += line.length + 1
    }
    return {
      length: text.length,
      lines: lines.length,
      line: (n: number) => ({ from: starts[n - 1] ?? 0, to: (starts[n - 1] ?? 0) + (lines[n - 1]?.length ?? 0) }),
    }
  }

  it('maps line/column to a one-character range', () => {
    expect(diagnosticRange(doc('{\n  "a": 1,\n}'), 3, 1)).toEqual({ from: 12, to: 13 })
  })

  it('clamps positions past the end of the document', () => {
    expect(diagnosticRange(doc('{"a":'), 1, 6)).toEqual({ from: 4, to: 5 })
    expect(diagnosticRange(doc('ab'), 99, 99)).toEqual({ from: 1, to: 2 })
    expect(diagnosticRange(doc(''), 1, 1)).toEqual({ from: 0, to: 0 })
  })
})
