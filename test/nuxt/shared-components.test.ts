import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TabList from '~/components/TabList.vue'
import FileDrop from '~/components/FileDrop.vue'
import ShortcutHelp from '~/components/ShortcutHelp.vue'
import { isJsonIndent } from '~/utils/json/format'

describe('TabList', () => {
  const tabs = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ] as const

  it('marks the selected tab and uses a roving tabindex', async () => {
    const wrapper = await mountSuspended(TabList, { props: { tabs, modelValue: 'b', label: 'Views', idPrefix: 't' } })
    const buttons = wrapper.findAll('[role="tab"]')
    expect(buttons.map((b) => b.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(buttons.map((b) => b.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(buttons[1]?.attributes('aria-controls')).toBe('t-panel-b')
  })

  it('moves selection with arrow, Home and End keys, wrapping around', async () => {
    const wrapper = await mountSuspended(TabList, { props: { tabs, modelValue: 'c', label: 'Views', idPrefix: 't' } })
    await wrapper.findAll('[role="tab"]')[2]?.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'End' })
    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['a'], ['c'], ['c']])
  })
})

describe('FileDrop', () => {
  it('emits the loaded text file', async () => {
    const wrapper = await mountSuspended(FileDrop)
    await (wrapper.vm as unknown as { load: (f: File) => Promise<void> }).load(new File(['{"a":1}'], 'a.json'))
    expect(wrapper.emitted('load')).toEqual([[{ name: 'a.json', text: '{"a":1}' }]])
  })

  it('shows an error for files over the limit', async () => {
    const wrapper = await mountSuspended(FileDrop, { props: { maxBytes: 4 } })
    await (wrapper.vm as unknown as { load: (f: File) => Promise<void> }).load(new File(['12345'], 'big.json'))
    expect(wrapper.emitted('load')).toBeUndefined()
    expect(wrapper.get('[data-testid="file-drop-error"]').text()).toContain('big.json is 5 B')
  })
})

describe('ShortcutHelp', () => {
  it('lists every shortcut and opens on "?"', async () => {
    const wrapper = await mountSuspended(ShortcutHelp, { attachTo: document.body })
    expect(wrapper.findAll('dt')).toHaveLength(6)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
    expect((wrapper.get('[data-testid="shortcut-help"]').element as HTMLDialogElement).open).toBe(true)
    wrapper.unmount()
  })
})

describe('usePreference', () => {
  const Probe = defineComponent({
    setup() {
      const indent = usePreference('test.indent', 2, isJsonIndent)
      return { indent }
    },
    render() {
      return h('span', String(this.indent))
    },
  })

  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('reads a stored value after mount and writes changes back under the devkit: prefix', async () => {
    localStorage.setItem('devkit:test.indent', '4')
    const wrapper = await mountSuspended(Probe)
    expect(wrapper.text()).toBe('4')
    ;(wrapper.vm as unknown as { indent: number | string }).indent = 'tab'
    await wrapper.vm.$nextTick()
    expect(localStorage.getItem('devkit:test.indent')).toBe('"tab"')
  })

  it('ignores corrupt or invalid stored values', async () => {
    localStorage.setItem('devkit:test.indent', '{oops')
    expect((await mountSuspended(Probe)).text()).toBe('2')
    localStorage.setItem('devkit:test.indent', '3')
    expect((await mountSuspended(Probe)).text()).toBe('2')
  })
})
