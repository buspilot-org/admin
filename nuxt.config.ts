// Buspilot admin console. A static single-page app (no server rendering):
// every request to Supabase runs with the signed-in staff member's own
// session, so row-level security decides what they may read and change.
import brand from './app/assets/brand/colors.json'

// Vuetify themes from the Buspilot brand tokens (app/assets/brand/).
// error is not a brand token; dark mode gets a lighter red so that error text
// on the dark surface meets WCAG AA (Vuetify's #CF6679 is 4.4:1 there).
function vuetifyColors(c: typeof brand.light, error?: string) {
  return {
    ...(error ? { error } : {}),
    'primary': c.primary,
    'on-primary': c.onPrimary,
    'secondary': c.primaryStrong,
    'on-secondary': c.onPrimary,
    'background': c.background,
    'on-background': c.text,
    'surface': c.surface,
    'on-surface': c.text,
    'success': c.onTime,
    'on-success': c.onStatus,
    // Warnings (delays, stale positions) use the brand's delayed colour.
    'warning': c.delayed,
    'on-warning': c.onStatus,
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  devtools: { enabled: false },

  modules: ['@nuxt/eslint', '@nuxtjs/supabase', '@nuxtjs/i18n', 'vuetify-nuxt-module'],

  css: ['@mdi/font/css/materialdesignicons.css', 'maplibre-gl/dist/maplibre-gl.css', '~/assets/fonts.css', '~/assets/brand/tokens.css', '~/assets/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      title: 'Buspilot',
      meta: [
        { name: 'robots', content: 'noindex' },
        { name: 'theme-color', content: brand.light.primary, media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: brand.dark.background, media: '(prefers-color-scheme: dark)' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // MapLibre style. The default is OpenFreeMap (free, no key), fine for
      // development; production uses the same tile provider as the rider app.
      mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      // Link the rider app opens from an invite QR code. {code} is replaced.
      // The code is in the fragment, so it never reaches a server log.
      riderJoinUrl: 'https://app.buspilot.org/join#code={code}',
      // A vehicle position older than this (seconds) during an active trip is
      // reported as stale on the Today page.
      stalePositionSeconds: 120,
    },
  },

  supabase: {
    // SUPABASE_URL and SUPABASE_KEY (publishable key) from the environment.
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
      saveRedirectToCookie: true,
    },
    // Static SPA: the session lives in the browser only.
    useSsrCookies: false,
  },

  i18n: {
    locales: [
      { code: 'ja', language: 'ja-JP', name: '日本語', file: 'ja.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
    ],
    defaultLocale: 'ja',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'buspilot_locale',
      fallbackLocale: 'ja',
    },
  },

  vuetify: {
    // Vuetify's useLayout clashes with Nuxt's; components import what they need.
    moduleOptions: { importComposables: false },
    vuetifyOptions: {
      icons: { defaultSet: 'mdi' },
      defaults: {
        VTextField: { density: 'compact', variant: 'outlined' },
        VTextarea: { density: 'compact', variant: 'outlined' },
        VSelect: { density: 'compact', variant: 'outlined' },
        VAutocomplete: { density: 'compact', variant: 'outlined' },
      },
      theme: {
        defaultTheme: 'system',
        themes: {
          light: {
            dark: false,
            colors: vuetifyColors(brand.light),
          },
          dark: {
            dark: true,
            colors: vuetifyColors(brand.dark, '#F2808E'),
          },
        },
      },
    },
  },

  typescript: {
    strict: true,
  },
})
