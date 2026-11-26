// The admin console on the server's schema from buspilot-org/server#4: post
// categories, revoking codes with their memberships, branding upload,
// drivers and vehicles, live trips. Everything created here is labelled
// "e2e …" or belongs to the test accounts and is removed afterwards.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  deleteBrandingFiles,
  deleteDriverVehicles,
  deleteTestInviteCodes,
  deleteTestLiveTrips,
  deleteTestPosts,
  deleteUser,
  E2E_DRIVER_EMAIL,
  E2E_LABEL_PREFIX,
  ensureStaff,
  OPERATOR_ID,
  operatorBranding,
  riderRedeems,
  select,
  setOperatorBranding,
  SUPABASE_URL,
  VEHICLE_ID,
} from './local-supabase'
import { OWNER_STATE } from './global-setup'

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** Picks an entry of a Vuetify select or autocomplete. */
async function choose(page: Page, field: Locator, option: string, typed?: string) {
  await field.click()
  if (typed) await field.locator('input').first().fill(typed)
  await page.getByRole('option', { name: option, exact: true }).click()
}

const label = (what: string) => `${E2E_LABEL_PREFIX}${what} ${Date.now()}`

test.describe.configure({ mode: 'serial' })
// Signed in as the test owner (global setup); console.spec.ts tests signing in.
test.use({ storageState: OWNER_STATE })

async function openToday(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '今日の運行' })).toBeVisible()
}

test.afterAll(async () => {
  await deleteTestPosts()
  await deleteTestLiveTrips()
  await deleteTestInviteCodes()
})

test('create a post with a category', async ({ page }) => {
  await openToday(page)
  await page.goto('/news')
  await page.getByRole('button', { name: '新しい投稿' }).click()

  // The delay template sets the category and the text; the title gets our label.
  await page.getByTestId('delay-minutes').locator('input').fill('15')
  await page.getByRole('button', { name: '約…分の遅れ' }).click()
  await expect(page.getByTestId('i18n-ja').first().locator('input')).toHaveValue('バスが遅れています')
  await expect(page.getByTestId('post-category')).toContainText('遅れ')
  const title = label('遅れ')
  await page.getByTestId('i18n-ja').first().locator('input').fill(title)
  await choose(page, page.getByTestId('post-category'), 'イベント')
  await choose(page, page.getByTestId('post-category'), '遅れ')
  await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()

  const row = page.getByTestId('posts-table').locator('tbody tr').filter({ hasText: title })
  await expect(row).toContainText('遅れ')
  const [post] = await select<{ category: string, body: Record<string, string> }>('post', `title->>ja=eq.${encodeURIComponent(title)}&select=category,body`)
  expect(post!.category).toBe('delay')
  expect(post!.body.ja).toContain('約15分')

  // Filter by category.
  await page.getByTestId('category-filter').getByText('イベント').click()
  await expect(row).toBeHidden()
  await page.getByTestId('category-filter').getByText('遅れ').click()
  await page.getByTestId('category-filter').getByText('イベント').click()
  await expect(row).toBeVisible()
})

test('revoke a code together with the memberships made with it', async ({ page }) => {
  await openToday(page)
  await page.goto('/audiences')
  await page.getByRole('link', { name: '朝便A 保護者' }).click()
  await page.getByTestId('invite-new').click()
  const codeLabel = label('revoke')
  await page.getByTestId('invite-label').locator('input').fill(codeLabel)
  await page.getByTestId('invite-create').click()
  const code = (await page.getByRole('dialog').getByTestId('invite-code').textContent())!.trim()
  await page.getByTestId('invite-done').click()
  await page.getByRole('button', { name: '閉じる' }).click()

  // A rider joins with the code.
  const device = await riderRedeems(code)
  try {
    const row = page.getByTestId('invite-row').filter({ hasText: codeLabel })
    await row.getByRole('button', { name: '無効にする' }).click()
    await page.getByRole('dialog').getByLabel('このコードで参加した利用者も外す').check()
    await page.getByRole('dialog').getByRole('button', { name: '無効にする' }).click()
    await expect(page.getByText('コードを無効にし、利用者 1 人を外しました')).toBeVisible()
    await expect(row).toContainText('無効')

    const memberships = await select<{ revoked_at: string | null }>('membership', `device_id=eq.${device}&select=revoked_at`)
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.revoked_at).not.toBeNull()
  }
  finally {
    await deleteUser(device)
  }
})

test('upload a logo', async ({ page }) => {
  const before = await operatorBranding()
  const path = `${OPERATOR_ID}/logo.png`
  try {
    await openToday(page)
    await page.goto('/settings')
    await page.getByTestId('branding-logo-file').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
    const preview = page.getByTestId('branding-logo-preview')
    await expect(preview).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/operator-branding/${path}\\?v=\\d+$`))
    // The file is in the bucket and served publicly.
    const src = (await preview.getAttribute('src'))!
    const res = await page.request.get(src)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')

    if (SUPABASE_URL.startsWith('http://')) {
      // A local stack serves Storage over http, which operator.branding
      // rejects (https only): the console says so and does not save.
      await expect(page.getByTestId('branding-http')).toBeVisible()
      await expect(page.getByRole('button', { name: '保存' })).toBeDisabled()
    }
    else {
      await page.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText('保存しました')).toBeVisible()
    }
  }
  finally {
    await deleteBrandingFiles([path])
    // Only an https stack saves; restore what was there.
    if (JSON.stringify(await operatorBranding()) !== JSON.stringify(before)) await setOperatorBranding(before)
  }
})

test('assign a driver to a vehicle', async ({ page }) => {
  const driverId = await ensureStaff(E2E_DRIVER_EMAIL, 'driver')
  await deleteDriverVehicles(driverId)
  try {
    await openToday(page)
    await page.goto('/vehicles')
    const row = page.getByTestId('vehicles-table').locator('tbody tr').filter({ hasText: 'Bus 1' })
    await row.getByTestId('assign-drivers').click()
    const driverLabel = `運転手 ${driverId.slice(0, 8)}`
    await page.getByRole('dialog').getByLabel(driverLabel).check()
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await expect(row.getByTestId('vehicle-drivers')).toContainText(driverLabel)

    const rows = await select<{ vehicle_id: string }>('driver_vehicle', `user_id=eq.${driverId}&select=vehicle_id`)
    expect(rows).toEqual([{ vehicle_id: VEHICLE_ID }])
  }
  finally {
    await deleteDriverVehicles(driverId)
  }
})

test('create a live trip with two planned stops and an audience', async ({ page }) => {
  await openToday(page)
  await page.getByTestId('new-live-trip').click()
  const dialog = page.getByTestId('live-trip-dialog')
  const title = label('遠足')
  await dialog.getByTestId('i18n-ja').first().locator('input').fill(title)
  await choose(page, dialog.getByTestId('live-vehicle'), 'Bus 1')

  const rows = dialog.getByTestId('live-stop-row')
  await expect(rows).toHaveCount(2)
  await choose(page, rows.nth(0).getByTestId('live-stop'), '北野坂', '北野')
  await rows.nth(0).getByTestId('live-arrival').locator('input').fill('10:00')
  await rows.nth(0).getByTestId('live-departure').locator('input').fill('10:15')
  await choose(page, rows.nth(1).getByTestId('live-stop'), '三宮', '三宮')
  await rows.nth(1).getByTestId('live-arrival').locator('input').fill('10:40')

  const audience = dialog.getByTestId('live-audience').filter({ hasText: '朝便A 保護者' })
  await audience.getByLabel('朝便A 保護者').check()
  await audience.getByLabel('地図も表示').check()
  await dialog.getByTestId('live-save').click()
  await expect(dialog).toBeHidden()

  const row = page.getByTestId('live-trips').locator('tbody tr').filter({ hasText: title })
  await expect(row).toContainText('Bus 1')
  await expect(row).toContainText('10:00–10:40')

  const [trip] = await select<{ id: string, kind: string, vehicle_id: string, status: string }>(
    'trip_instance',
    `title->>ja=eq.${encodeURIComponent(title)}&select=id,kind,vehicle_id,status`,
  )
  expect(trip).toMatchObject({ kind: 'live', vehicle_id: VEHICLE_ID, status: 'planned' })
  const stops = await select<{ stop_sequence: number, planned_arrival: string, planned_departure: string | null }>(
    'trip_instance_stop',
    `trip_instance_id=eq.${trip!.id}&select=stop_sequence,planned_arrival,planned_departure&order=stop_sequence`,
  )
  expect(stops.map(s => s.stop_sequence)).toEqual([10, 20])
  expect(new Date(stops[0]!.planned_arrival).toISOString()).toMatch(/T01:00:00/) // 10:00 JST
  const audiences = await select<{ audience_id: string, can_see_map: boolean }>('trip_instance_audience', `trip_instance_id=eq.${trip!.id}&select=audience_id,can_see_map`)
  expect(audiences).toEqual([{ audience_id: 'd0000000-0000-4000-8000-000000000601', can_see_map: true }])
  // The engine follows planned stops through their stop events.
  const events = await select<{ stop_sequence: number }>('stop_event', `trip_instance_id=eq.${trip!.id}&select=stop_sequence&order=stop_sequence`)
  expect(events.map(e => e.stop_sequence)).toEqual([10, 20])

  // Edit: one more stop at the end; then cancel the trip.
  await row.getByTestId('edit-live-trip').click()
  await expect(dialog.getByTestId('live-stop-row')).toHaveCount(2)
  await dialog.getByTestId('live-add-stop').click()
  await choose(page, dialog.getByTestId('live-stop-row').nth(2).getByTestId('live-stop'), '新神戸駅', '新神戸')
  await dialog.getByTestId('live-stop-row').nth(2).getByTestId('live-arrival').locator('input').fill('11:00')
  await dialog.getByTestId('live-save').click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText('10:00–11:00')

  await row.getByRole('button', { name: '運休にする' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '運休にする' }).click()
  await expect(row).toContainText('運休')
})
