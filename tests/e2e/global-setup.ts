import { mkdir, writeFile } from 'node:fs/promises'
import type { FullConfig } from '@playwright/test'
import { AUTH_STORAGE_KEY, E2E_DRIVER_EMAIL, E2E_EDITOR_EMAIL, E2E_EMAIL, E2E_LIVE_DRIVER_EMAIL, E2E_LOGIN_EMAIL, ensureStaff, OPERATOR_ID, sessionFor } from './local-supabase'

export const OWNER_STATE = 'playwright/.auth/owner.json'
export const DRIVER_STATE = 'playwright/.auth/driver.json'
export const EDITOR_STATE = 'playwright/.auth/editor.json'

async function saveState(origin: string, email: string, path: string) {
  const session = await sessionFor(email)
  await writeFile(path, JSON.stringify({
    cookies: [],
    origins: [{
      origin,
      localStorage: [
        { name: AUTH_STORAGE_KEY, value: JSON.stringify(session) },
        { name: 'buspilot_operator', value: OPERATOR_ID },
      ],
    }],
  }))
}

export default async function globalSetup(config: FullConfig) {
  await ensureStaff(E2E_EMAIL, 'owner')
  await ensureStaff(E2E_DRIVER_EMAIL, 'driver')
  await ensureStaff(E2E_LOGIN_EMAIL, 'owner')
  await ensureStaff(E2E_LIVE_DRIVER_EMAIL, 'driver')
  await ensureStaff(E2E_EDITOR_EMAIL, 'editor')

  // Signed-in sessions for the tests that do not test signing in
  // (console.spec.ts signs in through the login page with other accounts).
  const origin = new URL(config.projects[0]!.use.baseURL!).origin
  await mkdir('playwright/.auth', { recursive: true })
  await saveState(origin, E2E_EMAIL, OWNER_STATE)
  await saveState(origin, E2E_LIVE_DRIVER_EMAIL, DRIVER_STATE)
  await saveState(origin, E2E_EDITOR_EMAIL, EDITOR_STATE)
}
