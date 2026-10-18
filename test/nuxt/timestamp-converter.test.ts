import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import TimestampConverterPage from '~/pages/tools/timestamp-converter.vue'

type Wrapper = VueWrapper<unknown>

async function setDecodeInput(wrapper: Wrapper, value: string): Promise<void> {
  await wrapper.get('[data-testid="timestamp-decode-input"]').setValue(value)
}

describe('Unix Timestamp Converter page', () => {
  it('shows a live Now panel with well-formed values', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    const epochSeconds = wrapper.get('[data-testid="timestamp-now-epoch-s"]').text()
    const epochMs = wrapper.get('[data-testid="timestamp-now-epoch-ms"]').text()
    const utc = wrapper.get('[data-testid="timestamp-now-utc"]').text()
    expect(epochSeconds).toMatch(/^\d{10}$/)
    expect(epochMs).toMatch(/^\d{13}$/)
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('decodes a known epoch to the expected UTC string', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await setDecodeInput(wrapper, '1700000000')
    expect(wrapper.get('[data-testid="timestamp-decode-utc"]').text()).toBe('2023-11-14T22:13:20.000Z')
  })

  it('shows an error for invalid decode input', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await setDecodeInput(wrapper, 'not-a-number')
    expect(wrapper.get('[data-testid="timestamp-decode-error"]').text()).toContain('Not a valid number')
  })

  it('a preset button fills the decode field with the expected epoch seconds', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    const beforeNow = Math.floor(Date.now() / 1000)
    await wrapper.get('[data-testid="timestamp-preset-plus-1h"]').trigger('click')
    const input = wrapper.get<HTMLInputElement>('[data-testid="timestamp-decode-input"]')
    const value = Number(input.element.value)
    expect(value).toBeGreaterThanOrEqual(beforeNow + 3600)
    expect(value).toBeLessThanOrEqual(beforeNow + 3605)
  })

  it('round-trips a known UTC date typed into the text field', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await wrapper.get('[data-testid="timestamp-encode-input"]').setValue('2026-01-01T00:00')
    expect(wrapper.get('[data-testid="timestamp-encode-epoch-s"]').text()).toBe(String(Date.UTC(2026, 0, 1, 0, 0) / 1000))
    expect(wrapper.get('[data-testid="timestamp-encode-epoch-ms"]').text()).toBe(String(Date.UTC(2026, 0, 1, 0, 0)))
  })

  it('keeps the text field and the native picker in sync', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await wrapper.get('[data-testid="timestamp-encode-picker"]').setValue('2026-01-01T00:00')
    expect(wrapper.get<HTMLInputElement>('[data-testid="timestamp-encode-input"]').element.value).toBe('2026-01-01T00:00')
    expect(wrapper.get('[data-testid="timestamp-encode-epoch-s"]').text()).toBe(String(Date.UTC(2026, 0, 1, 0, 0) / 1000))
  })

  it('clears Decode and Encode but leaves the Now panel ticking', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await setDecodeInput(wrapper, '1700000000')
    await wrapper.get('[data-testid="timestamp-encode-input"]').setValue('2026-01-01T00:00')
    await wrapper.get('[data-testid="timestamp-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="timestamp-decode-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="timestamp-decode-local"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="timestamp-encode-epoch-s"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="timestamp-now-epoch-s"]').text()).toMatch(/^\d{10}$/)
  })

  it('loads the sample into Decode', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await wrapper.get('[data-testid="timestamp-sample"]').trigger('click')
    expect(wrapper.get('[data-testid="timestamp-decode-utc"]').text()).toBe('2023-11-14T22:13:20.000Z')
  })

  it('defaults the encode time zone to UTC, with a "Local" option available', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    const input = wrapper.get<HTMLInputElement>('[data-testid="timestamp-encode-zone"]')
    expect(input.element.value).toBe('UTC')
    const datalist = wrapper.get('[data-testid="timestamp-zone-options"]')
    const labels = datalist.findAll('option').map((o) => o.text())
    expect(labels.some((label) => label.startsWith('Local ('))).toBe(true)
  })

  it('encodes against the selected time zone, not just UTC', async () => {
    const wrapper = await mountSuspended(TimestampConverterPage)
    await wrapper.get('[data-testid="timestamp-encode-zone"]').setValue('Asia/Tokyo')
    await wrapper.get('[data-testid="timestamp-encode-input"]').setValue('2026-01-01T00:00')
    expect(wrapper.get('[data-testid="timestamp-encode-epoch-s"]').text()).toBe(String(Date.UTC(2025, 11, 31, 15, 0) / 1000))
    expect(wrapper.get('[data-testid="timestamp-encode-offset"]').text()).toBe('GMT+9')
  })
})
