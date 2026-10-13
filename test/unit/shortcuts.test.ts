import { describe, expect, it } from 'vitest'
import { isTypingTarget, matchShortcut } from '../../app/utils/shortcuts'
import type { ShortcutEventLike } from '../../app/utils/shortcuts'

function key(overrides: Partial<ShortcutEventLike>): ShortcutEventLike {
  return { key: '', code: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: null, ...overrides }
}

describe('matchShortcut', () => {
  it('maps Ctrl+Enter and Cmd+Enter to run', () => {
    expect(matchShortcut(key({ key: 'Enter', ctrlKey: true }))).toBe('run')
    expect(matchShortcut(key({ key: 'Enter', metaKey: true }))).toBe('run')
    expect(matchShortcut(key({ key: 'Enter' }))).toBeNull()
  })

  it('maps Alt+Shift+letters by physical key, so macOS Option characters still match', () => {
    expect(matchShortcut(key({ key: 'Ç', code: 'KeyC', altKey: true, shiftKey: true }))).toBe('copy')
    expect(matchShortcut(key({ code: 'KeyD', altKey: true, shiftKey: true }))).toBe('download')
    expect(matchShortcut(key({ code: 'KeyX', altKey: true, shiftKey: true }))).toBe('clear')
    expect(matchShortcut(key({ code: 'KeyO', altKey: true, shiftKey: true }))).toBe('open')
    expect(matchShortcut(key({ code: 'KeyC', altKey: true, shiftKey: true, ctrlKey: true }))).toBeNull()
  })

  it('does not claim Ctrl+Shift+C (browser DevTools)', () => {
    expect(matchShortcut(key({ code: 'KeyC', ctrlKey: true, shiftKey: true }))).toBeNull()
  })

  it('opens help with ? unless the user is typing', () => {
    expect(matchShortcut(key({ key: '?', target: { tagName: 'BODY' } as unknown as EventTarget }))).toBe('help')
    expect(matchShortcut(key({ key: '?', target: { tagName: 'INPUT' } as unknown as EventTarget }))).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('detects form fields, contenteditable and CodeMirror', () => {
    expect(isTypingTarget({ tagName: 'textarea' } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', closest: (s: string) => (s === '.cm-editor' ? {} : null) } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', closest: () => null } as unknown as EventTarget)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
