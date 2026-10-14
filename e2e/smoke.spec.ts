import { expect, test } from '@playwright/test'

test('app loads and detects WebHID', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Razer Huntsman V3 Pro TKL' })).toBeVisible()
  await expect(page.getByTestId('webhid-support')).toHaveAttribute('data-status', 'supported')
})
