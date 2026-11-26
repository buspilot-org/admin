import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { oneTimeCode } from './local-supabase'

/** Signs in with an email one-time code and waits for Today. */
export async function signIn(page: Page, email: string) {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByRole('button', { name: 'コードを送信' }).click()
  await expect(page.getByLabel('ワンタイムコード')).toBeVisible()
  await page.getByLabel('ワンタイムコード').fill(await oneTimeCode(email))
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page.getByRole('heading', { name: '今日の運行' })).toBeVisible()
}
