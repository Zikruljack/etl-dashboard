export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],
  build: {
    transpile: [/echarts/, /vue-echarts/, /zrender/, /resize-detector/, /vue-grid-layout/],
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
    // Server-side only — used for SSR requests inside Docker (calls server container directly)
    apiBaseInternal: process.env.NUXT_API_BASE_INTERNAL || '',
    public: {
      // Client-side (browser) URL — must be publicly accessible
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'ETL Dashboard',
      meta: [
        { name: 'description', content: 'ETL Dashboard - Data visualization platform' },
      ],
      link: [
        { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' },
      ],
    },
  },
});
