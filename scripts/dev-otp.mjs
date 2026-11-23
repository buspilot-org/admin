// Prints a fresh one-time sign-in code for a local staff account.
//
// The local Supabase email template sends a link without the 6-digit code
// (server change listed in the README). Until then, use this after pressing
// "Send code" in the console:
//
//   SUPABASE_SECRET_KEY=$(cd ../server && npx supabase status -o json | jq -r .SECRET_KEY) \
//     node scripts/dev-otp.mjs owner@demo.buspilot.test
//
// Local development only: it needs the secret key of the local stack.
const email = process.argv[2]
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const key = process.env.SUPABASE_SECRET_KEY

if (!email || !key) {
  console.error('Usage: SUPABASE_SECRET_KEY=… node scripts/dev-otp.mjs <email>')
  process.exit(1)
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to run against ${url}: local Supabase only.`)
  process.exit(1)
}

const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email }),
})
const body = await res.json()
if (!res.ok || !body.email_otp) {
  console.error('Could not create a code:', body.msg ?? body.error_description ?? res.status)
  process.exit(1)
}
console.log(body.email_otp)
