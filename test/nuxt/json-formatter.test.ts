import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import JsonFormatterPage from '~/pages/tools/json-formatter.vue'
import FileDrop from '~/components/FileDrop.vue'
import CodeEditor from '~/components/CodeEditor.vue'

// ToolPage → no ThemeToggle here, but keep color-mode deterministic if the layout is ever involved.
const { colorMode } = vi.hoisted(() => ({ colorMode: { preference: 'system', value: 'light' } }))
mockNuxtImport('useColorMode', () => () => colorMode)

type Wrapper = VueWrapper<unknown>

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function editor(wrapper: Wrapper, testId: string): VueWrapper<InstanceType<typeof CodeEditor>> {
  const found = wrapper.findAllComponents(CodeEditor).find((c) => c.attributes('data-testid') === testId)
  if (!found) throw new Error(`No CodeEditor with data-testid="${testId}"`)
  return found
}

function setEditor(wrapper: Wrapper, testId: string, value: string): Promise<void> {
  editor(wrapper, testId).vm.$emit('update:modelValue', value)
  return wrapper.vm.$nextTick()
}

function editorValue(wrapper: Wrapper, testId: string): string {
  return editor(wrapper, testId).props('modelValue')
}

async function click(wrapper: Wrapper, testId: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
}

function press(init: KeyboardEventInit): Promise<void> {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('JSON Formatter page', () => {
  let wrapper: Wrapper

  beforeEach(async () => {
    localStorage.clear()
    wrapper = (await mountSuspended(JsonFormatterPage, { attachTo: document.body })) as Wrapper
  })

  afterEach(() => {
    wrapper.unmount()
    vi.restoreAllMocks()
  })

  describe('core (J1)', () => {
    it('formats with the chosen indent and sorted keys', async () => {
      await setEditor(wrapper, 'json-input', '{"b":1,"a":{"d":1,"c":2}}')
      await wrapper.get('[data-testid="json-sort"]').setValue(true)
      await click(wrapper, 'json-format')
      expect(editorValue(wrapper, 'json-output')).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}')
      expect(wrapper.get('[data-testid="json-output-title"]').text()).toBe('Formatted')
    })

    it('re-formats the output when the indent preference changes, and remembers it', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await click(wrapper, 'json-format')
      await wrapper.get('[data-testid="json-indent"]').setValue('4')
      expect(editorValue(wrapper, 'json-output')).toBe('{\n    "a": 1\n}')
      expect(localStorage.getItem('devkit:json.indent')).toBe('4')
    })

    it('minifies', async () => {
      await setEditor(wrapper, 'json-input', '{ "a" : [1, 2] }')
      await click(wrapper, 'json-minify')
      expect(editorValue(wrapper, 'json-output')).toBe('{"a":[1,2]}')
    })

    it('shows live validity after the debounce', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await sleep(350)
      expect(wrapper.get('[data-testid="json-valid"]').text()).toContain('Valid JSON · 7 chars')
    })

    it('reports invalid JSON with line and column, in the status bar and the editor', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1,}')
      await click(wrapper, 'json-format')
      expect(wrapper.get('[data-testid="json-invalid"]').text()).toBe('Invalid JSON')
      expect(wrapper.get('[data-testid="json-error"]').text()).toContain('Line 1, column 8')
      expect(wrapper.get('[data-testid="json-output-error"]').text()).toContain('Line 1, column 8')
      expect(editor(wrapper, 'json-input').props('diagnostics')).toEqual([
        expect.objectContaining({ line: 1, column: 8 }),
      ])
    })

    it('warns about integers that lose precision but still formats', async () => {
      await setEditor(wrapper, 'json-input', '{"id": 9007199254740993}')
      await click(wrapper, 'json-format')
      expect(wrapper.get('[data-testid="json-unsafe-warning"]').text()).toBe('Some numbers are too large and may lose precision.')
      expect(editorValue(wrapper, 'json-output')).toContain('"id"')
    })

    it('pauses live validation above 1 MB and validates on Format', async () => {
      const big = `[${'1,'.repeat(500_001)}1]`
      await setEditor(wrapper, 'json-input', big)
      expect(wrapper.get('[data-testid="json-status"]').text()).toContain('live validation paused')
      await click(wrapper, 'json-minify')
      expect(wrapper.find('[data-testid="json-valid"]').exists()).toBe(true)
      expect(editorValue(wrapper, 'json-output')).toBe(big)
    })

    it('loads a file through FileDrop', async () => {
      const drop = wrapper.findComponent(FileDrop)
      await (drop.vm as unknown as { load: (f: File) => Promise<void> }).load(new File(['{"x":true}'], 'x.json'))
      await wrapper.vm.$nextTick()
      expect(editorValue(wrapper, 'json-input')).toBe('{"x":true}')
      expect(wrapper.get('[data-testid="json-notice"]').text()).toBe('Loaded x.json')
      expect(wrapper.find('[data-testid="json-valid"]').exists()).toBe(true)
    })

    it('loads the sample and clears everything', async () => {
      await click(wrapper, 'json-sample')
      expect(editorValue(wrapper, 'json-input')).toContain('"ord_8f2k3"')
      expect(wrapper.find('[data-testid="json-valid"]').exists()).toBe(true)
      await click(wrapper, 'json-format')
      await click(wrapper, 'json-clear')
      expect(editorValue(wrapper, 'json-input')).toBe('')
      expect(editorValue(wrapper, 'json-output')).toBe('')
    })
  })

  describe('shortcuts', () => {
    it('Ctrl/Cmd+Enter formats', async () => {
      await setEditor(wrapper, 'json-input', '[1,2]')
      await press({ key: 'Enter', metaKey: true })
      expect(editorValue(wrapper, 'json-output')).toBe('[\n  1,\n  2\n]')
    })

    it('Alt+Shift+C copies the output', async () => {
      const writeText = vi.fn(async (): Promise<void> => {})
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await click(wrapper, 'json-minify')
      await press({ key: 'Ç', code: 'KeyC', altKey: true, shiftKey: true })
      await sleep(0)
      expect(writeText).toHaveBeenCalledWith('{"a":1}')
      expect(wrapper.get('[data-testid="json-notice"]').text()).toBe('Copied to clipboard')
    })

    it('Alt+Shift+D downloads the output with a sensible filename', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:devkit')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((): void => {})
      // A real click would navigate happy-dom's window to the blob: URL and break later tests.
      const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement): void {
        expect(this.download).toBe('minified.json')
      })
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await click(wrapper, 'json-minify')
      await press({ code: 'KeyD', altKey: true, shiftKey: true })
      expect(createObjectURL).toHaveBeenCalledOnce()
      expect(anchorClick).toHaveBeenCalledOnce()
      expect(wrapper.get('[data-testid="json-notice"]').text()).toBe('Downloaded minified.json')
    })

    it('Alt+Shift+X clears the tool', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await press({ code: 'KeyX', altKey: true, shiftKey: true })
      expect(editorValue(wrapper, 'json-input')).toBe('')
    })
  })

  describe('explore (J2)', () => {
    it('shows a tree with levels 1–2 expanded and copyable paths', async () => {
      await click(wrapper, 'json-sample')
      await click(wrapper, 'json-tab-tree')
      expect(wrapper.find('[data-path="$"]').exists()).toBe(true)
      // Root (level 1) and its children (level 2) are expanded, so level-3 rows show but stay collapsed.
      expect(wrapper.find('[data-path="$.items"]').exists()).toBe(true)
      expect(wrapper.find('[data-path="$.items[0]"]').exists()).toBe(true)
      expect(wrapper.find('[data-path="$.items[0].sku"]').exists()).toBe(false)
      await click(wrapper, 'json-tree-expand-all')
      expect(wrapper.find('[data-path="$.items[0].sku"]').exists()).toBe(true)
      await click(wrapper, 'json-tree-collapse-all')
      expect(wrapper.find('[data-path="$.items"]').exists()).toBe(true)
      expect(wrapper.find('[data-path="$.items[0]"]').exists()).toBe(false)
    })

    it('pages large arrays with "Show more"', async () => {
      await setEditor(wrapper, 'json-input', JSON.stringify(Array.from({ length: 1200 }, (_, i) => i)))
      await click(wrapper, 'json-format')
      await click(wrapper, 'json-tab-tree')
      expect(wrapper.findAll('[data-path^="$["]')).toHaveLength(500)
      expect(wrapper.get('[data-testid="json-tree-show-more"]').text()).toBe('Show 500 more (700 hidden)')
      await click(wrapper, 'json-tree-show-more')
      expect(wrapper.findAll('[data-path^="$["]')).toHaveLength(1000)
    })

    it('tells the user to fix invalid input before showing the tree', async () => {
      await setEditor(wrapper, 'json-input', '{')
      await click(wrapper, 'json-format')
      await click(wrapper, 'json-tab-tree')
      expect(wrapper.get('[data-testid="json-tree-empty"]').text()).toBe('Fix the JSON input to see the tree.')
    })

    it('runs JSONPath queries and reports the match count', async () => {
      await click(wrapper, 'json-sample')
      await click(wrapper, 'json-tab-query')
      expect(wrapper.get('[data-testid="json-query-count"]').text()).toBe('2 matches')
      expect(JSON.parse(editorValue(wrapper, 'json-query-output'))).toEqual(['Keyboard', 'Mouse'])
      await wrapper.get('[data-testid="json-query-input"]').setValue('$.items[?(@.price >')
      await wrapper.get('[data-testid="json-query-input"]').trigger('keydown', { key: 'Enter' })
      expect(wrapper.get('[data-testid="json-query-error"]').text()).toMatch(/^Invalid JSONPath expression/)
    })
  })

  describe('transform & compare (J3)', () => {
    it('escapes and unescapes round-trip', async () => {
      await setEditor(wrapper, 'json-input', '{"a":"x"}')
      await click(wrapper, 'json-escape')
      const escaped = editorValue(wrapper, 'json-output')
      expect(escaped).toBe('"{\\"a\\":\\"x\\"}"')
      await setEditor(wrapper, 'json-input', escaped)
      await click(wrapper, 'json-unescape')
      expect(editorValue(wrapper, 'json-output')).toBe('{"a":"x"}')
      expect(wrapper.get('[data-testid="json-unescape-status"]').text()).toBe('Unescaped text is valid JSON')
    })

    it('shows an error when unescaping something that is not a string literal', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1}')
      await click(wrapper, 'json-unescape')
      expect(wrapper.get('[data-testid="json-output-error"]').text()).toMatch(/not a valid escaped JSON string/)
    })

    it('compares structurally, ignoring key order', async () => {
      await click(wrapper, 'json-sample')
      await click(wrapper, 'json-tab-diff')
      await click(wrapper, 'json-compare')
      expect(wrapper.get('[data-testid="json-diff-summary"]').text()).toBe('4 differences · 1 added · 1 removed · 2 changed')
      const paths = wrapper.findAll('[data-testid="json-diff-table"] tbody tr td:first-child').map((td) => td.text())
      expect(paths).toEqual(['$.status', '$.items[1].qty', '$.tags[1]', '$.refundedAt'])
    })

    it('says "No differences" for deeply equal documents', async () => {
      await setEditor(wrapper, 'json-input', '{"a":1,"b":[1,2]}')
      await click(wrapper, 'json-tab-diff')
      await setEditor(wrapper, 'json-diff-right', '{"b":[1,2],"a":1}')
      await click(wrapper, 'json-compare')
      expect(wrapper.get('[data-testid="json-diff-none"]').text()).toBe('No differences')
    })

    it('flags which side is invalid and marks it in that editor', async () => {
      await setEditor(wrapper, 'json-input', '{}')
      await click(wrapper, 'json-tab-diff')
      await setEditor(wrapper, 'json-diff-right', '{\n  oops\n}')
      await click(wrapper, 'json-compare')
      expect(wrapper.get('[data-testid="json-diff-error"]').text()).toMatch(/^Line 2, column \d+: Right: /)
      expect(editor(wrapper, 'json-diff-right').props('diagnostics')).toHaveLength(1)
    })
  })
})
