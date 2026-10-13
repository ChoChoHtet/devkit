import { describe, expect, it } from 'vitest'
import { absoluteUrl, buildRobots, buildSitemap, escapeXml } from '../../app/utils/seo'

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;')
  })
})

describe('absoluteUrl', () => {
  it('joins the site URL and path without doubling slashes', () => {
    expect(absoluteUrl('https://devkit.example/', '/tools/json-formatter')).toBe('https://devkit.example/tools/json-formatter')
    expect(absoluteUrl('https://devkit.example', '/')).toBe('https://devkit.example/')
  })
})

describe('buildSitemap', () => {
  it('lists every path as an absolute URL', () => {
    const xml = buildSitemap('https://devkit.example', ['/', '/tools/protobuf'])
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://devkit.example/</loc>')
    expect(xml).toContain('<loc>https://devkit.example/tools/protobuf</loc>')
  })
})

describe('buildRobots', () => {
  it('allows crawling and points at the sitemap when the site URL is set', () => {
    expect(buildRobots('https://devkit.example')).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://devkit.example/sitemap.xml\n',
    )
  })

  it('omits the sitemap line when no site URL is configured', () => {
    expect(buildRobots('')).toBe('User-agent: *\nAllow: /\n')
  })
})
