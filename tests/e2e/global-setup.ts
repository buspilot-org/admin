import { mkdir, writeFile } from 'node:fs/promises'
import type { FullConfig } from '@playwright/test'
import { AUTH_STORAGE_KEY, E2E_DRIVER_EMAIL, E2E_EMAIL, E2E_LOGIN_EMAIL, ensureStaff, OPERATOR_ID, sessionFor } from './local-supabase'

export const OWNER_STATE = 'playwright/.auth/owner.json'

export default async function globalSetup(config: FullConfig) {
  await ensureStaff(E2E_EMAIL, 'owner')
  await ensureStaff(E2E_DRIVER_EMAIL, 'driver')
  await ensureStaff(E2E_LOGIN_EMAIL, 'owner')

  // A signed-in owner for the tests that do not test signing in.
  const origin = new URL(config.projects[0]!.use.baseURL!).origin
  const session = await sessionFor(E2E_EMAIL)
  await mkdir('playwright/.auth', { recursive: true })
  await writeFile(OWNER_STATE, JSON.stringify({
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
