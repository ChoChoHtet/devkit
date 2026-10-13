export type EditorLanguage = 'json' | 'plain'

export interface EditorDiagnostic {
  line: number
  column: number
  message: string
}

export interface DocLike {
  length: number
  lines: number
  line(n: number): { from: number; to: number }
}

/** Maps a 1-based line/column to a non-empty character range, clamped to the document. */
export function diagnosticRange(doc: DocLike, line: number, column: number): { from: number; to: number } {
  if (doc.length === 0) return { from: 0, to: 0 }
  const target = doc.line(Math.min(Math.max(line, 1), doc.lines))
  let from = Math.min(target.from + Math.max(column - 1, 0), target.to)
  if (from >= doc.length) from = doc.length - 1
  return { from, to: from + 1 }
}
