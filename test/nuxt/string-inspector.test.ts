import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import StringInspectorPage from '~/pages/tools/string-inspector.vue'
import CodeEditor from '~/components/CodeEditor.vue'

type Wrapper = VueWrapper<unknown>

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function setInput(wrapper: Wrapper, value: string): Promise<void> {
  const editor = wrapper.findAllComponents(CodeEditor).find((c) => c.attributes('data-testid') === 'string-input')
  if (!editor) throw new Error('No string input editor')
  editor.vm.$emit('update:modelValue', value)
  return wrapper.vm.$nextTick()
}

describe('String Inspector page', () => {
  it('shows zeros before any input', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    expect(wrapper.get('[data-testid="string-stats"]').text()).toContain('Characters (code points)0')
  })

  it('updates the stats after the debounce', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    await setInput(wrapper, 'héllo 👋')
    await sleep(350)
    const text: string = wrapper.get('[data-testid="string-stats"]').text()
    expect(text).toContain('Characters (code points)7')
    expect(text).toContain('UTF-8 bytes11')
    expect(text).toContain('Base64URL15')
  })

  it('pauses above 1 MB and runs on Analyze', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    await setInput(wrapper, 'a'.repeat(1_000_001))
    expect(wrapper.find('[data-testid="string-paused"]').exists()).toBe(true)
    await wrapper.get('[data-testid="string-analyze"]').trigger('click')
    expect(wrapper.get('[data-testid="string-stats"]').text()).toContain('Characters (code points)1000001')
  })

  it('wraps long input lines so the whole text stays visible', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    const editor = wrapper.findAllComponents(CodeEditor).find((c) => c.attributes('data-testid') === 'string-input')
    expect(editor?.props('wrap')).toBe(true)
  })

  it('loads the sample text', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    await wrapper.get('[data-testid="string-sample"]').trigger('click')
    expect(wrapper.get('[data-testid="string-stats"]').text()).toContain('Lines2')
  })

  it('clears the input back to zeros', async () => {
    const wrapper = await mountSuspended(StringInspectorPage)
    await wrapper.get('[data-testid="string-sample"]').trigger('click')
    await wrapper.get('[data-testid="string-clear"]').trigger('click')
    expect(wrapper.get('[data-testid="string-stats"]').text()).toContain('Characters (code points)0')
  })
})
