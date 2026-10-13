import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { diagnosticCount } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import CodeEditor from '~/components/CodeEditor.vue'

type EditorVm = { getView: () => EditorView | null }

async function mountEditor(props: { modelValue: string } & Record<string, unknown>) {
  const wrapper = await mountSuspended(CodeEditor, { props: { label: 'Test editor', ...props } })
  const view = (wrapper.vm as unknown as EditorVm).getView()
  if (!view) throw new Error('editor did not mount')
  return { wrapper, view }
}

describe('CodeEditor', () => {
  it('shows the initial value and labels the content for screen readers', async () => {
    const { view } = await mountEditor({ modelValue: '{"a":1}' })
    expect(view.state.doc.toString()).toBe('{"a":1}')
    expect(view.contentDOM.getAttribute('aria-label')).toBe('Test editor')
  })

  it('emits update:modelValue when the document changes', async () => {
    const { wrapper, view } = await mountEditor({ modelValue: '' })
    view.dispatch({ changes: { from: 0, insert: '[1]' } })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['[1]'])
  })

  it('replaces the document when the prop changes from outside', async () => {
    const { wrapper, view } = await mountEditor({ modelValue: 'a' })
    await wrapper.setProps({ modelValue: 'b' })
    expect(view.state.doc.toString()).toBe('b')
  })

  it('applies an external value equal to one it emitted earlier', async () => {
    const { wrapper, view } = await mountEditor({ modelValue: '' })
    view.dispatch({ changes: { from: 0, insert: 'x' } })
    await wrapper.setProps({ modelValue: 'x' })
    await wrapper.setProps({ modelValue: '' })
    await wrapper.setProps({ modelValue: 'x' })
    expect(view.state.doc.toString()).toBe('x')
  })

  it('blocks edits when readonly', async () => {
    const { view } = await mountEditor({ modelValue: 'ro', readonly: true })
    expect(view.state.readOnly).toBe(true)
    expect(view.contentDOM.getAttribute('aria-readonly')).toBe('true')
  })

  it('shows diagnostics from line/column and clears them', async () => {
    const { wrapper, view } = await mountEditor({
      modelValue: '{\n  "a": 1,\n}',
      diagnostics: [{ line: 3, column: 1, message: 'bad' }],
    })
    expect(diagnosticCount(view.state)).toBe(1)
    await wrapper.setProps({ diagnostics: [] })
    expect(diagnosticCount(view.state)).toBe(0)
  })
})
