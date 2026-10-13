const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char: string): string => XML_ESCAPES[char] ?? char)
}

export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${path}`
}

export function buildSitemap(siteUrl: string, paths: readonly string[]): string {
  const entries: string = paths
    .map((path: string): string => `  <url><loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export function buildRobots(siteUrl: string): string {
  const lines: string[] = ['User-agent: *', 'Allow: /']
  // The sitemap line must be an absolute URL, so it's only written once the site URL is configured.
  if (siteUrl !== '') lines.push(`Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`)
  return `${lines.join('\n')}\n`
}
