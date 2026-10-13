import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RandomStringPage from '~/pages/tools/random-string.vue'

function checkbox(wrapper: { get: (selector: string) => { element: Element } }, testid: string): HTMLInputElement {
  return wrapper.get(`[data-testid="${testid}"]`).element as HTMLInputElement
}

describe('Random String page', () => {
  beforeEach(() => localStorage.clear())

  it('starts with uppercase, lowercase and digits checked, symbols off, and length 32', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    expect(checkbox(wrapper, 'random-uppercase').checked).toBe(true)
    expect(checkbox(wrapper, 'random-lowercase').checked).toBe(true)
    expect(checkbox(wrapper, 'random-digits').checked).toBe(true)
    expect(checkbox(wrapper, 'random-symbols').checked).toBe(false)
    expect((wrapper.get('[data-testid="random-length"]').element as HTMLInputElement).value).toBe('32')
  })

  it('generates the requested batch on Generate and shows the entropy estimate', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    await wrapper.get('[data-testid="random-count"]').setValue('3')
    await wrapper.get('[data-testid="random-generate"]').trigger('click')

    const lines: string[] = (wrapper.get('[data-testid="random-output"]').element as HTMLTextAreaElement).value.split('\n')
    expect(lines).toHaveLength(3)
    for (const line of lines) {
      expect(line).toMatch(/^[A-Za-z0-9]{32}$/)
    }
    expect(wrapper.get('[data-testid="random-summary"]').text()).toBe('Alphabet 62 · 190.5 bits per string')
  })

  it('shows an error instead of output when no character type is chosen', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    await wrapper.get('[data-testid="random-uppercase"]').setValue(false)
    await wrapper.get('[data-testid="random-lowercase"]').setValue(false)
    await wrapper.get('[data-testid="random-digits"]').setValue(false)

    expect(wrapper.get('[data-testid="random-alphabet-error"]').text()).toBe(
      'Pick at least one character type or enter custom characters',
    )
    await wrapper.get('[data-testid="random-generate"]').trigger('click')
    expect(wrapper.get('[data-testid="random-run-error"]').text()).toBe(
      'Pick at least one character type or enter custom characters',
    )
    expect((wrapper.get('[data-testid="random-output"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('uses custom characters alone when every type is off', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    await wrapper.get('[data-testid="random-uppercase"]').setValue(false)
    await wrapper.get('[data-testid="random-lowercase"]').setValue(false)
    await wrapper.get('[data-testid="random-digits"]').setValue(false)
    await wrapper.get('[data-testid="random-custom"]').setValue('01')
    await wrapper.get('[data-testid="random-length"]').setValue('8')
    await wrapper.get('[data-testid="random-generate"]').trigger('click')

    const output: string = (wrapper.get('[data-testid="random-output"]').element as HTMLTextAreaElement).value
    expect(output).toMatch(/^[01]{8}$/)
  })

  it('flags an out-of-range length inline', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    await wrapper.get('[data-testid="random-length"]').setValue('2000')
    expect(wrapper.get('#random-length-error').text()).toBe('Length must be between 1 and 1024')
  })

  it('remembers character types and length but not custom characters', async () => {
    const wrapper = await mountSuspended(RandomStringPage)
    await wrapper.get('[data-testid="random-symbols"]').setValue(true)
    await wrapper.get('[data-testid="random-custom"]').setValue('secret-custom')
    await wrapper.get('[data-testid="random-length"]').setValue('20')

    expect(localStorage.getItem('devkit:random.symbols')).toBe('true')
    expect(localStorage.getItem('devkit:random.length')).toBe('20')
    const stored: string[] = Array.from({ length: localStorage.length }, (_: unknown, i: number): string => {
      return `${localStorage.key(i)}=${localStorage.getItem(localStorage.key(i) ?? '')}`
    })
    expect(stored.join(' ')).not.toContain('secret-custom')
  })
})
