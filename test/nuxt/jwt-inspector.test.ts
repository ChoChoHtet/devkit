import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import JwtInspectorPage from '~/pages/tools/jwt-inspector.vue'
import CodeEditor from '~/components/CodeEditor.vue'
import { base64UrlEncodeBytes } from '~/utils/jwt/decode'
import { JWT_SAMPLE_SECRET } from '~/utils/jwt/sample'

type Wrapper = VueWrapper<unknown>

function encodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

// Web Crypto calls (sample signing, verification) resolve on the real event loop, not just
// microtasks, so polling is more reliable here than a fixed sleep or flushPromises().
async function waitUntil(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function setEditor(wrapper: Wrapper, testId: string, value: string): Promise<void> {
  const editor = wrapper.findAllComponents(CodeEditor).find((c) => c.attributes('data-testid') === testId)
  if (!editor) throw new Error(`No editor ${testId}`)
  editor.vm.$emit('update:modelValue', value)
  await wrapper.vm.$nextTick()
}

async function setToken(wrapper: Wrapper, value: string): Promise<void> {
  await setEditor(wrapper, 'jwt-input', value)
}

async function clickSample(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="jwt-sample"]').trigger('click')
  await waitUntil(() => wrapper.find('[data-testid="jwt-valid"], [data-testid="jwt-error"]').exists())
}

async function switchToEncode(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="jwt-mode-tab-encode"]').trigger('click')
}

async function clickGenerate(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="jwt-encode-generate"]').trigger('click')
  await waitUntil(() => wrapper.find('[data-testid="jwt-encode-result"], [data-testid="jwt-encode-error"]').exists())
}

describe('JWT Encoder/Decoder page', () => {
  it('prompts for input before anything is pasted', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    expect(wrapper.get('[data-testid="jwt-status"]').text()).toContain('Paste a JWT')
  })

  it('decodes the sample token and shows its claims', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await clickSample(wrapper)
    expect(wrapper.get('[data-testid="jwt-valid"]').text()).toContain('alg HS256')
    const table = wrapper.get('[data-testid="jwt-claims-table"]').text()
    expect(table).toContain('Ada Lovelace')
    expect(table).toContain('exp')
    expect(wrapper.get('[data-testid="jwt-timing-exp"]').text()).toContain('Active')
  })

  it('shows an error for a malformed token', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await setToken(wrapper, 'not-a-jwt')
    expect(wrapper.get('[data-testid="jwt-error"]').text()).toContain('3 dot-separated parts')
  })

  it('flags an expired token', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' })
    const payload = encodeJson({ exp: Math.floor(Date.now() / 1000) - 100 })
    await setToken(wrapper, `${header}.${payload}.sig`)
    expect(wrapper.get('[data-testid="jwt-timing-exp"]').text()).toContain('Expired')
  })

  it('clears the input back to the empty state', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await clickSample(wrapper)
    await wrapper.get('[data-testid="jwt-clear"]').trigger('click')
    expect(wrapper.get('[data-testid="jwt-status"]').text()).toContain('Paste a JWT')
  })

  it('verifies a correct HS256 secret', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await clickSample(wrapper)
    await wrapper.get('[data-testid="jwt-tab-verify"]').trigger('click')
    await wrapper.get('[data-testid="jwt-verify-key"]').setValue(JWT_SAMPLE_SECRET)
    await wrapper.get('[data-testid="jwt-verify-button"]').trigger('click')
    await waitUntil(() => wrapper.find('[data-testid="jwt-verify-result"]').exists())
    expect(wrapper.get('[data-testid="jwt-verify-result"]').text()).toContain('Signature valid')
  })

  it('reports a mismatched secret', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await clickSample(wrapper)
    await wrapper.get('[data-testid="jwt-tab-verify"]').trigger('click')
    await wrapper.get('[data-testid="jwt-verify-key"]').setValue('wrong-secret')
    await wrapper.get('[data-testid="jwt-verify-button"]').trigger('click')
    await waitUntil(() => wrapper.find('[data-testid="jwt-verify-result"]').exists())
    expect(wrapper.get('[data-testid="jwt-verify-result"]').text()).toContain('Signature does not match')
  })

  it('flags alg:none tokens as insecure without asking for a key', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    const header = encodeJson({ alg: 'none' })
    const payload = encodeJson({ sub: '1' })
    await setToken(wrapper, `${header}.${payload}.`)
    await wrapper.get('[data-testid="jwt-tab-verify"]').trigger('click')
    expect(wrapper.find('[data-testid="jwt-verify-key"]').exists()).toBe(false)
    await wrapper.get('[data-testid="jwt-verify-button"]').trigger('click')
    await waitUntil(() => wrapper.find('[data-testid="jwt-verify-result"]').exists())
    expect(wrapper.get('[data-testid="jwt-verify-result"]').text()).toContain('insecure')
  })

  it('encode mode comes prefilled with a working HS256 example', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    expect(wrapper.get('[data-testid="jwt-encode-alg"]').text()).toContain('HS256')
    await clickGenerate(wrapper)
    expect(wrapper.get('[data-testid="jwt-encode-result"]').text()).toContain('Token generated')
  })

  it('round-trips a generated token back through Decode', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    await clickGenerate(wrapper)
    await wrapper.get('[data-testid="jwt-encode-use"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="jwt-valid"]').text()).toContain('alg HS256')
    expect(wrapper.get('[data-testid="jwt-claims-table"]').text()).toContain('Ada Lovelace')
  })

  it('signs an alg:none token as insecure with no key needed', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    await setEditor(wrapper, 'jwt-encode-header', '{"alg":"none"}')
    expect(wrapper.find('[data-testid="jwt-encode-key"]').exists()).toBe(false)
    await clickGenerate(wrapper)
    expect(wrapper.get('[data-testid="jwt-encode-result"]').text()).toContain('unsigned')
  })

  it('shows a JSON parse error for an invalid header', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    await setEditor(wrapper, 'jwt-encode-header', 'not json')
    expect(wrapper.find('[data-testid="jwt-encode-alg-missing"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="jwt-encode-generate"]').attributes('disabled')).toBeDefined()
  })

  it('clears the encode fields', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    await wrapper.get('[data-testid="jwt-encode-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="jwt-encode-alg-missing"]').exists()).toBe(true)
  })

  it('restores the encode sample after clearing', async () => {
    const wrapper = await mountSuspended(JwtInspectorPage)
    await switchToEncode(wrapper)
    await wrapper.get('[data-testid="jwt-encode-clear"]').trigger('click')
    await wrapper.get('[data-testid="jwt-encode-sample"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="jwt-encode-alg"]').text()).toContain('HS256')
  })
})
