import { defineConfig, defineProject } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// Two projects: plain unit tests for pure utilities (fast, no Nuxt), and
// component tests in a Nuxt environment (auto-imports, Vuetify, i18n).
// Test files are outside the tsconfig includes, so the transform would look
// for a tsconfig in parent directories (wrong in a nested git worktree).
const tsconfig = './tsconfig.json'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        tsconfig,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      }),
      await defineVitestProject({
        tsconfig,
        test: {
          name: 'nuxt',
          include: ['tests/components/**/*.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
              overrides: {
                // Component tests never talk to Supabase.
                supabase: { url: 'http://127.0.0.1:1', key: 'test', redirect: false },
              },
            },
          },
        },
      }),
    ],
  },
})
