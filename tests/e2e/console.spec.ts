import { expect, test } from '@playwright/test'
import { deleteTestInviteCodes, E2E_DRIVER_EMAIL, E2E_LABEL_PREFIX, E2E_LOGIN_EMAIL } from './local-supabase'
import { signIn } from './sign-in'

test.afterAll(deleteTestInviteCodes)

test('sign in, see the demo route, create an invite code', async ({ page }) => {
  // Sign in with an email one-time code; Today, for the demo school.
  await signIn(page, E2E_LOGIN_EMAIL)
  await expect(page.getByTestId('operator-name')).toHaveText('北野デモ国際学校')

  // The demo route: a loop that serves Kitano-zaka twice.
  await page.goto('/routes')
  await page.getByRole('link', { name: /朝便A/ }).click()
  const stops = page.getByTestId('pattern-stops').locator('tbody tr')
  await expect(stops).toHaveCount(6)
  await expect(stops.filter({ hasText: '北野坂' })).toHaveCount(2)

  // Create an invite code for the demo audience.
  await page.goto('/audiences')
  await page.getByRole('link', { name: '朝便A 保護者' }).click()
  await page.getByTestId('invite-new').click()
  const label = `${E2E_LABEL_PREFIX}${Date.now()}`
  await page.getByTestId('invite-label').locator('input').fill(label)
  await page.getByTestId('invite-create').click()

  const code = page.getByRole('dialog').getByTestId('invite-code')
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
  await expect(page.getByRole('dialog').getByRole('img', { name: '参加用 QR コード' })).toBeVisible()
  await expect(page.getByRole('dialog').locator('section[lang="de"]')).toContainText('So treten Sie bei')

  // Closing asks first, because the code is never shown again.
  await page.getByTestId('invite-done').click()
  await page.getByRole('button', { name: '閉じる' }).click()
  await expect(page.getByTestId('invite-row').filter({ hasText: label })).toContainText('有効')
})

test('a driver sees today only', async ({ page }) => {
  await signIn(page, E2E_DRIVER_EMAIL)
  const nav = page.locator('nav .v-list-item')
  await expect(nav).toHaveCount(1)
  await expect(nav).toHaveText('今日の運行')
  // Editor pages send drivers back to Today.
  await page.goto('/audiences')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '今日の運行' })).toBeVisible()
})
