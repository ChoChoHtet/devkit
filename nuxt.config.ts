import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  // Pages are prerendered at build time so crawlers get real HTML (see PROJECT_SPEC §3.5).
  ssr: true,
  devtools: { enabled: true },
  modules: ['@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // Used for absolute URLs in sitemap.xml and robots.txt. NUXT_PUBLIC_SITE_URL overrides it at build time.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'https://devkit-tau-seven.vercel.app',
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/robots.txt'],
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'devkit-color-mode',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: 'Free developer tools that run entirely in your browser. Nothing is sent to a server.' },
        { property: 'og:site_name', content: 'DevKit' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
