export type ShortcutAction = 'run' | 'copy' | 'download' | 'clear' | 'open' | 'help'

export interface ShortcutDefinition {
  action: ShortcutAction
  keys: string
  description: string
}

export interface ShortcutEventLike {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  target: EventTarget | null
}

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { action: 'run', keys: 'Ctrl/⌘ + Enter', description: "Run the tool's main action" },
  { action: 'copy', keys: 'Alt/⌥ + Shift + C', description: 'Copy the main output' },
  { action: 'download', keys: 'Alt/⌥ + Shift + D', description: 'Download the main output' },
  { action: 'clear', keys: 'Alt/⌥ + Shift + X', description: 'Clear the tool' },
  { action: 'open', keys: 'Alt/⌥ + Shift + O', description: 'Open a file' },
  { action: 'help', keys: '?', description: 'Show keyboard shortcuts' },
]

// event.code, not event.key: on macOS Option+Shift+C produces "Ç" as the key.
const ALT_SHIFT_ACTIONS: Readonly<Record<string, ShortcutAction>> = {
  KeyC: 'copy',
  KeyD: 'download',
  KeyX: 'clear',
  KeyO: 'open',
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null
  if (!el) return false
  const tag = el.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return typeof el.closest === 'function' && el.closest('.cm-editor') !== null
}

export function matchShortcut(event: ShortcutEventLike): ShortcutAction | null {
  const mod = event.metaKey || event.ctrlKey
  if (mod && !event.altKey && !event.shiftKey && event.key === 'Enter') return 'run'
  if (event.altKey && event.shiftKey && !mod) return ALT_SHIFT_ACTIONS[event.code] ?? null
  if (event.key === '?' && !mod && !event.altKey && !isTypingTarget(event.target)) return 'help'
  return null
}
