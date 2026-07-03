import { expect, test } from '@playwright/test'

test('home page shows greeting and counter works', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /hello, koala cub club/i }),
  ).toBeVisible()

  const button = page.getByRole('button', { name: /clicked 0 times/i })
  await button.click()

  await expect(
    page.getByRole('button', { name: /clicked 1 time/i }),
  ).toBeVisible()
})
