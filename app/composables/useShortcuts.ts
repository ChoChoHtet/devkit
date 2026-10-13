import { matchShortcut } from '~/utils/shortcuts'
import type { ShortcutAction } from '~/utils/shortcuts'

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>

/**
 * Listens in the capture phase so tool shortcuts win over CodeMirror's own keymap
 * (which binds Mod-Enter to "insert blank line").
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  function onKeydown(event: KeyboardEvent): void {
    const action = matchShortcut(event)
    if (!action) return
    const handler = handlers[action]
    if (!handler) return
    event.preventDefault()
    event.stopPropagation()
    handler()
  }

  onMounted((): void => window.addEventListener('keydown', onKeydown, { capture: true }))
  onBeforeUnmount((): void => window.removeEventListener('keydown', onKeydown, { capture: true }))
}
