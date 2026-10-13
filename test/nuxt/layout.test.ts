import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import App from '~/app.vue'
import AppHeader from '~/components/AppHeader.vue'
import { TOOLS } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'

// The color-mode client plugin relies on an inline head script the test env never injects.
const { colorMode } = vi.hoisted(() => ({
  colorMode: { preference: 'system', value: 'light' } as { preference: string; value: string },
}))

mockNuxtImport('useColorMode', () => () => colorMode)

describe('AppHeader', () => {
  it('links to every tool in registry order', async () => {
    const wrapper = await mountSuspended(AppHeader)
    const hrefs: (string | undefined)[] = wrapper.findAll('nav[aria-label="Tools"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(TOOLS.map((t) => t.to))
  })

  it('renders the brand link and theme toggle', async () => {
    const wrapper = await mountSuspended(AppHeader)
    expect(wrapper.get('[data-testid="brand-link"]').attributes('href')).toBe('/')
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
  })
})

describe('routing inside the default layout', () => {
  it('renders a card for each tool on the index page', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    for (const tool of TOOLS) {
      expect(wrapper.find(`[data-testid="tool-card-${tool.slug}"]`).exists()).toBe(true)
    }
  })

  it.each(TOOLS.map((t: ToolDefinition): [string, ToolDefinition] => [t.slug, t]))(
    'renders the %s page with header and title',
    async (_slug: string, tool: ToolDefinition) => {
      const wrapper = await mountSuspended(App, { route: tool.to })
      expect(wrapper.find('[data-testid="brand-link"]').exists()).toBe(true)
      // Active-link state (aria-current) isn't asserted: NuxtLink doesn't pick up the route that
      // mountSuspended sets, though it works in a real browser.
      expect(wrapper.get('h1').text()).toContain(tool.title)
    },
  )
})
