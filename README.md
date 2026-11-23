# Buspilot admin console

Web app for operator staff of [Buspilot](https://buspilot.org), a bus tracking service for privately operated buses (schools, kindergartens, driving schools, hotel shuttles, sports clubs): set up routes and schedules, run the day, manage vehicles and invite codes, and post announcements.

Built with Nuxt on the Supabase backend in [buspilot-org/server](https://github.com/buspilot-org/server). Japanese first, with English and German.

## What it does

| Screen | For | What |
|---|---|---|
| Today | all staff | Today's trips per vehicle (status, current stop, delay), warnings (off route, stale position), and what the schedule says when the engine has not created the day's trips yet |
| Routes and stops | owners, editors | Routes with colour and visibility; per route the stops in pattern order (a stop served twice is listed twice) on a MapLibre map |
| Schedule | owners, editors | Trips per pattern, "copy with another start time", calendars with weekdays, validity and exceptions as date ranges, preview "which trips run on date X" |
| Vehicles | owners, editors | Vehicles with their current state; the Traccar device ID is read-only (set by the Buspilot team) |
| Audiences and invite codes | owners, editors | Audiences with routes and map permission, member counts (never who), invite codes shown once with QR code and a printable ja/en/de sheet, revoke |
| News | owners, editors | Posts in the operator's languages for an audience or route, publish and expiry times; links and contact information |
| Operator settings | owners | Display name per language, languages, time zone, default visibility, brand colour with contrast check, logo |

Every request runs with the signed-in staff member's own Supabase session, so the database's row-level security decides what they can read and change. The navigation only mirrors those rules.

## Development

You need Node.js 24+, pnpm, and a running local Supabase from a clone of [buspilot-org/server](https://github.com/buspilot-org/server) (`npx supabase start` there; it loads the demo school seed).

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The console runs on <http://localhost:3100>. `.env.example` holds the local stack's URL and publishable key; nothing secret belongs in `.env`.

### A local staff account

Sign-in uses an email one-time code; the console never creates accounts. Create a user in Studio (<http://127.0.0.1:55323>, Authentication → Add user, with "auto confirm") and give it a role at the demo school, as in the server README:

```sql
insert into public.staff_role (operator_id, user_id, role)
values ('d0000000-0000-4000-8000-000000000001', '<auth user id>', 'owner');
```

Emails go to Mailpit (<http://127.0.0.1:55324>). The local email template sends a sign-in link without the 6-digit code (a server change is pending), so get a code for the console with the local secret key instead:

```bash
SUPABASE_SECRET_KEY=$(cd ../server && npx supabase status -o json | jq -r .SECRET_KEY) node scripts/dev-otp.mjs you@example.test
```

The script refuses to run against anything but a local Supabase.

### Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Development server on port 3100 |
| `pnpm lint` | ESLint (`@nuxt/eslint`) |
| `pnpm typecheck` | `vue-tsc` through `nuxt typecheck` |
| `pnpm test` | Vitest: unit tests (`tests/unit`) and component tests in a Nuxt environment (`tests/components`) |
| `pnpm test:e2e` | Playwright against the local Supabase seed (see below) |
| `pnpm build` / `pnpm generate` | Production build / static site in `.output/public` |
| `pnpm db:types` | Regenerate `app/types/database.types.ts` from the local database |

### End-to-end tests

The Playwright tests sign in as a test owner and a test driver of the demo school, open the demo route and create an invite code. They create the test accounts with the local secret key and delete the invite codes they made:

```bash
pnpm exec playwright install chromium
SUPABASE_SECRET_KEY=$(cd ../server && npx supabase status -o json | jq -r .SECRET_KEY) pnpm test:e2e
```

They build and start the console unless one already runs on port 3100 (or set `E2E_BASE_URL`).

### Configuration

| Variable | Default | |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | — | Supabase API URL and publishable key |
| `NUXT_PUBLIC_MAP_STYLE_URL` | OpenFreeMap "liberty" | MapLibre style; free and keyless for development |
| `NUXT_PUBLIC_RIDER_JOIN_URL` | `https://app.buspilot.org/join#code={code}` | Link in invite QR codes; the code sits in the fragment, so it does not reach server logs |
| `NUXT_PUBLIC_STALE_POSITION_SECONDS` | `120` | Age after which a position during a trip counts as stale |

The console is a static single-page app (`ssr: false`); `NUXT_PUBLIC_*` values are read at build time for a static deployment.

### Layout

`app/pages` one file per screen, `app/components` dialogs and shared pieces (map, QR code, invite sheet, translatable text field), `app/composables` operator and role state, `app/utils` pure logic (calendars, times in the operator's time zone, WKB geometry from PostgREST, contrast, warnings) with unit tests, `i18n/locales` ja (default), en, de.

## Contributing

Every pull request gets at least one thorough self-review before merge; see the [Buspilot agent policy](https://github.com/buspilot-org/.github/blob/main/docs/agent-policy.md).

## License

[GNU Affero General Public License v3.0](LICENSE)
