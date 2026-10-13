import { TOOLS } from '../../app/utils/tools'
import { buildSitemap } from '../../app/utils/seo'

export default defineEventHandler((event) => {
  const { siteUrl } = useRuntimeConfig(event).public
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return buildSitemap(siteUrl, ['/', ...TOOLS.map((tool) => tool.to)])
})
