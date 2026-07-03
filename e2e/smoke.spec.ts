import { expect, test } from '@playwright/test'

test('landing page renders hero and social links', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/koala cub club/i)

  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toContainText(/she sees/i)

  await expect(page.getByText(/a tabby with opinions/i).first()).toBeVisible()

  await expect(
    page.getByRole('link', { name: /instagram/i }).first(),
  ).toHaveAttribute('href', 'https://www.instagram.com/koalacubclub/')
})
