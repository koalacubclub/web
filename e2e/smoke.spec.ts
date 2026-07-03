import { expect, test } from '@playwright/test'

// Smoke test: verifies the app shell and outbound links render. It does not
// validate third-party TikTok embed loading (that depends on tiktok.com).
test('landing page renders hero and social links', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/koala cub club/i)

  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toContainText(/she sees/i)

  await expect(page.getByText(/a tabby with opinions/i).first()).toBeVisible()

  await expect(
    page.getByRole('link', { name: /instagram/i }).first(),
  ).toHaveAttribute('href', 'https://www.instagram.com/koalacubclub/')

  await expect(
    page.getByRole('link', { name: /tiktok/i }).first(),
  ).toHaveAttribute('href', 'https://tiktok.com/@koalacubclub')

  await expect(page.getByRole('link', { name: /source/i })).toHaveAttribute(
    'href',
    'https://github.com/koalacubclub/web',
  )

  await expect(
    page.getByRole('link', { name: /hello@koalacub\.club/i }),
  ).toHaveAttribute('href', 'mailto:hello@koalacub.club')
})
