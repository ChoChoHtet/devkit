import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeToggle from '~/components/ThemeToggle.vue'

const { colorMode } = vi.hoisted(() => ({
  colorMode: { preference: 'system', value: 'light' } as { preference: string; value: string },
}))

mockNuxtImport('useColorMode', () => () => colorMode)

describe('ThemeToggle', () => {
  beforeEach(() => {
    colorMode.preference = 'system'
    colorMode.value = 'light'
  })

  it('switches to dark when the resolved mode is light', async () => {
    const wrapper = await mountSuspended(ThemeToggle)
    const button = wrapper.get('[data-testid="theme-toggle"]')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(colorMode.preference).toBe('dark')
  })

  it('reports pressed state and switches to light when dark', async () => {
    colorMode.value = 'dark'
    const wrapper = await mountSuspended(ThemeToggle)
    const button = wrapper.get('[data-testid="theme-toggle"]')
    expect(button.attributes('aria-pressed')).toBe('true')
    await button.trigger('click')
    expect(colorMode.preference).toBe('light')
  })

  it('has an accessible name', async () => {
    const wrapper = await mountSuspended(ThemeToggle)
    expect(wrapper.get('[data-testid="theme-toggle"]').attributes('aria-label')).toBe('Toggle dark mode')
  })
})
