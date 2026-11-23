import { E2E_DRIVER_EMAIL, E2E_EMAIL, ensureStaff } from './local-supabase'

export default async function globalSetup() {
  await ensureStaff(E2E_EMAIL, 'owner')
  await ensureStaff(E2E_DRIVER_EMAIL, 'driver')
}
