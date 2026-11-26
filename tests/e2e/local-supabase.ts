// Helpers that use the local stack's secret key: create the test staff
// account, read one-time codes, clean up. Refuse anything but localhost.
// Everything the tests create is labelled with E2E_LABEL_PREFIX (or belongs
// to the test accounts), so cleaning up never touches other data in the
// shared local database.

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
export const OPERATOR_ID = 'd0000000-0000-4000-8000-000000000001'
export const AUDIENCE_ID = 'd0000000-0000-4000-8000-000000000601'
export const E2E_EMAIL = 'e2e-owner@demo.buspilot.test'
export const E2E_DRIVER_EMAIL = 'e2e-driver@demo.buspilot.test'
// Signs in through the login page. Separate from E2E_EMAIL, whose session the
// global setup makes with an admin code: Auth refuses a second code for the
// same account within a short time.
export const E2E_LOGIN_EMAIL = 'e2e-login@demo.buspilot.test'
// A driver whose session global setup makes (live trips as a driver).
export const E2E_LIVE_DRIVER_EMAIL = 'e2e-live-driver@demo.buspilot.test'
export const E2E_LABEL_PREFIX = 'e2e '
export const VEHICLE_ID = 'd0000000-0000-4000-8000-000000000701'
export const PUBLISHABLE_KEY = process.env.SUPABASE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Set SUPABASE_SECRET_KEY to the local stack\'s secret key (npx supabase status in the server clone).')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
    throw new Error(`Refusing to use the secret key against ${SUPABASE_URL}: local Supabase only.`)
  }
  return key
}

export async function api(path: string, init: RequestInit = {}) {
  const key = secretKey()
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${text}`)
  return body
}

/** Creates a test staff account if missing and gives it a role at the demo operator. */
export async function ensureStaff(email: string, role: 'owner' | 'editor' | 'driver'): Promise<string> {
  const list = await api('/auth/v1/admin/users?per_page=1000')
  let user = (list.users as { id: string, email?: string }[]).find(u => u.email === email)
  if (!user) {
    user = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true }) })
  }
  await api('/rest/v1/staff_role?on_conflict=operator_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ operator_id: OPERATOR_ID, user_id: user!.id, role }),
  })
  return user!.id
}

/**
 * A fresh one-time code from the admin API. Independent of the email
 * template and of Mailpit, so the tests also work on a stack started with an
 * older server checkout.
 */
export async function oneTimeCode(email: string): Promise<string> {
  const body = await api('/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify({ type: 'magiclink', email }) })
  return body.email_otp as string
}

/** Removes invite codes created by the tests. */
export async function deleteTestInviteCodes() {
  await api(`/rest/v1/invite_code?label=like.${encodeURIComponent(`${E2E_LABEL_PREFIX}*`)}`, { method: 'DELETE' })
}

const like = (column: string) => `${column}=like.${encodeURIComponent(`${E2E_LABEL_PREFIX}*`)}`

/** Rows of a table, read with the secret key. */
export async function select<T>(table: string, query: string): Promise<T[]> {
  return api(`/rest/v1/${table}?${query}`)
}

/** Posts whose Japanese title starts with the prefix. */
export async function deleteTestPosts() {
  await api(`/rest/v1/post?${like('title->>ja')}`, { method: 'DELETE' })
}

/** Live trips whose Japanese title starts with the prefix (planned stops and audiences cascade). */
export async function deleteTestLiveTrips() {
  await api(`/rest/v1/trip_instance?kind=eq.live&${like('title->>ja')}`, { method: 'DELETE' })
}

export async function assignDriver(userId: string, vehicleId: string) {
  await api('/rest/v1/driver_vehicle', { method: 'POST', body: JSON.stringify({ operator_id: OPERATOR_ID, user_id: userId, vehicle_id: vehicleId }) })
}

export async function deleteDriverVehicles(userId: string) {
  await api(`/rest/v1/driver_vehicle?user_id=eq.${userId}`, { method: 'DELETE' })
}

export async function deleteBrandingFiles(paths: string[]) {
  await api('/storage/v1/object/operator-branding', { method: 'DELETE', body: JSON.stringify({ prefixes: paths }) })
}

/** The operator's branding, restored after the settings test. */
export async function operatorBranding(): Promise<unknown> {
  const rows = await select<{ branding: unknown }>('operator', `id=eq.${OPERATOR_ID}&select=branding`)
  return rows[0]?.branding
}

export async function setOperatorBranding(branding: unknown) {
  await api(`/rest/v1/operator?id=eq.${OPERATOR_ID}`, { method: 'PATCH', body: JSON.stringify({ branding }) })
}

/**
 * A rider device: an anonymous user that redeems an invite code, as the
 * rider app does. Returns its user id (delete it with deleteUser).
 */
export async function riderRedeems(code: string): Promise<string> {
  const headers = { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
  const signUp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: 'POST', headers, body: JSON.stringify({ data: {} }) })
  const session = await signUp.json()
  if (!signUp.ok) throw new Error(`anonymous sign-in: ${signUp.status} ${JSON.stringify(session)}`)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/redeem_invite_code`, {
    method: 'POST',
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ p_code: code }),
  })
  if (!res.ok) throw new Error(`redeem_invite_code: ${res.status} ${await res.text()}`)
  return session.user.id as string
}

export async function deleteUser(userId: string) {
  await api(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
}

/**
 * A session for a staff account without sending an email (admin code, then
 * verify), so the tests stay below the local auth rate limits.
 */
export async function sessionFor(email: string): Promise<unknown> {
  const token = await oneTimeCode(email)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`verify: ${res.status} ${JSON.stringify(body)}`)
  return body
}

/** Where supabase-js keeps the session in localStorage ("sb-<first host label>-auth-token"). */
export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
