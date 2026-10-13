import { buildRobots } from '../../app/utils/seo'

export default defineEventHandler((event) => {
  const { siteUrl } = useRuntimeConfig(event).public
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return buildRobots(siteUrl)
})
