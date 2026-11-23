// Helpers that use the local stack's secret key: create the test staff
// account, read one-time codes, clean up. Refuse anything but localhost.

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
export const OPERATOR_ID = 'd0000000-0000-4000-8000-000000000001'
export const AUDIENCE_ID = 'd0000000-0000-4000-8000-000000000601'
export const E2E_EMAIL = 'e2e-owner@demo.buspilot.test'
export const E2E_DRIVER_EMAIL = 'e2e-driver@demo.buspilot.test'
export const E2E_LABEL_PREFIX = 'e2e '

function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Set SUPABASE_SECRET_KEY to the local stack\'s secret key (npx supabase status in the server clone).')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
    throw new Error(`Refusing to use the secret key against ${SUPABASE_URL}: local Supabase only.`)
  }
  return key
}

async function api(path: string, init: RequestInit = {}) {
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

/** A fresh one-time code (the local email template has no code; see README). */
export async function oneTimeCode(email: string): Promise<string> {
  const body = await api('/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify({ type: 'magiclink', email }) })
  return body.email_otp as string
}

/** Removes invite codes created by the tests. */
export async function deleteTestInviteCodes() {
  await api(`/rest/v1/invite_code?label=like.${encodeURIComponent(`${E2E_LABEL_PREFIX}*`)}`, { method: 'DELETE' })
}
