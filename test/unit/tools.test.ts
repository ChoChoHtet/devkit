import { describe, expect, it } from 'vitest'
import { getTool, TOOLS } from '../../app/utils/tools'
import type { ToolSlug } from '../../app/utils/tools'

describe('TOOLS', () => {
  it('has unique slugs', () => {
    const slugs: string[] = TOOLS.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('routes every tool under /tools/<slug>', () => {
    for (const tool of TOOLS) {
      expect(tool.to).toBe(`/tools/${tool.slug}`)
    }
  })
})

describe('getTool', () => {
  it('returns the matching tool', () => {
    expect(getTool('jwt-inspector').title).toBe('JWT Inspector')
  })

  it('throws on an unknown slug', () => {
    expect(() => getTool('nope' as ToolSlug)).toThrow('Unknown tool: nope')
  })
})
